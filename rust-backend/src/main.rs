mod handlers;
mod middleware;
mod models;
mod openapi;
mod scan_engine;
mod services;

use axum::{
    extract::Extension,
    middleware as axum_middleware,
    routing::{delete, get, post, put},
    Router,
};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{fmt, EnvFilter};

use middleware::rate_limiter::RateLimiter;
use middleware::security_headers::security_headers;
use services::service_manager::ServiceManager;
use services::monitor::SiteMonitor;

/// Shared application state available in all handlers.
pub struct AppState {
    pub db: PgPool,
    pub jwt_secret: String,
    pub rate_limiter: RateLimiter,
    pub scan_output_tx: broadcast::Sender<String>,
    pub service_manager: Arc<ServiceManager>,
    pub site_monitor: Arc<SiteMonitor>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env
    dotenvy::dotenv().ok();

    // Initialize tracing
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    // Database — PostgreSQL (DATABASE_URL is required)
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL environment variable must be set");
    let db = services::db::init_db(&database_url).await?;

    // Seed Z4nzu/hackingtool catalog (~185 zero-code tools, idempotent upsert).
    match services::hackingtool_seed::seed_hackingtools(&db).await {
        Ok((ins, upd)) => tracing::info!("hackingtool registry seeded: {ins} inserted, {upd} updated"),
        Err(e) => tracing::warn!("hackingtool seeding failed: {e}"),
    }
    // Seed modern catalog (~210 cloud / k8s / supply-chain / AI / web3 tools).
    match services::hackingtool_seed_modern::seed_modern_tools(&db).await {
        Ok((ins, upd)) => tracing::info!("modern tool registry seeded: {ins} inserted, {upd} updated"),
        Err(e) => tracing::warn!("modern tool seeding failed: {e}"),
    }

    // JWT secret (required — must be at least 32 chars)
    let jwt_secret = std::env::var("JWT_SECRET_KEY")
        .or_else(|_| std::env::var("SECRET_KEY"))
        .expect("JWT_SECRET_KEY environment variable must be set");
    if jwt_secret.len() < 32 {
        panic!("JWT_SECRET_KEY must be at least 32 characters long");
    }

    // Rate limiter
    let rate_limiter = RateLimiter::new();

    // Broadcast channel for scan SSE streaming
    let (scan_output_tx, _rx) = broadcast::channel::<String>(1024);

    // Initialize Service Manager (auto-recovery watchdog)
    let service_manager = ServiceManager::new();

    // Initialize Site Monitor
    let site_monitor = SiteMonitor::new();

    // Build shared state
    let state = Arc::new(AppState {
        db,
        jwt_secret,
        rate_limiter,
        scan_output_tx,
        service_manager: service_manager.clone(),
        site_monitor: site_monitor.clone(),
    });

    // Spawn Service Manager monitoring loop (every 10s — auto-recovers crashed services)
    {
        let mgr = service_manager.clone();
        tokio::spawn(async move {
            // Give services a moment to start
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            tracing::info!("🛡️  Service Manager watchdog started — monitoring all services");
            mgr.monitor_loop().await;
        });
    }

    // Spawn Site Monitor loop (every 60s — checks HTTP endpoints)
    {
        let mon = site_monitor.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            tracing::info!("📡 Site Monitor started — checking service endpoints");
            mon.monitor_loop().await;
        });
    }

    // Spawn rate limiter cleanup task (every 5 minutes)
    {
        let state_clone = state.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
            loop {
                interval.tick().await;
                state_clone
                    .rate_limiter
                    .cleanup(std::time::Duration::from_secs(600));
            }
        });
    }

    // Spawn Scheduled Scan Engine (checks every 30s for due cron scans)
    {
        let db = state.db.clone();
        let scan_tx = state.scan_output_tx.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(15)).await;
            services::scheduler::run_scheduler(db, scan_tx).await;
        });
    }

    // Spawn CyberSec AI worker (autonomous pentest job processor)
    {
        let db = Arc::new(state.db.clone());
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(8)).await;
            services::cybersec_ai_worker::run(db).await;
        });
    }

    // Build router
    let app = build_router(state.clone())
        .layer(axum_middleware::from_fn(security_headers))
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin([
                    "http://localhost:3000".parse().unwrap(),
                    "http://localhost:3001".parse().unwrap(),
                    "http://localhost:5001".parse().unwrap(),
                    "https://app.cyber-sec-pro.com".parse().unwrap(),
                ])
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                    axum::http::Method::PATCH,
                    axum::http::Method::OPTIONS,
                ])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::AUTHORIZATION,
                    axum::http::header::ACCEPT,
                    axum::http::header::ORIGIN,
                    axum::http::header::COOKIE,
                ])
                .allow_credentials(true),
        )
        .layer(Extension(state));

    // Start server
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "5001".to_string());
    let addr = format!("{}:{}", host, port);

    tracing::info!("🚀 CyberSec Pro Rust Backend v4.0.0 starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn build_router(state: Arc<AppState>) -> Router {
    use handlers::*;

    let swagger_ui = utoipa_swagger_ui::SwaggerUi::new("/api/docs")
        .url("/api/docs/openapi.json", openapi::openapi_spec());

    Router::new()
        // ── Health / Root ─────────────────────────────────────
        .route("/", get(health_handlers::index))
        .route("/health", get(health_handlers::health))
        .route("/ready", get(health_handlers::ready))
        // ── Public agent install scripts (no auth) ────────────
        .route("/api/v1/agents/install.sh", get(agent_handlers::install_sh))
        .route("/api/v1/agents/install.ps1", get(agent_handlers::install_ps1))
        .route("/api/v1/agents/binary/:platform", get(agent_handlers::agent_binary))
        .route("/api/v1/agents/enroll", post(agent_handlers::enroll_agent))
        // ── Auth ──────────────────────────────────────────────
        .route("/api/v1/auth/register", post(auth_handlers::register))
        .route("/api/v1/auth/login", post(auth_handlers::login))
        .route("/api/v1/auth/refresh", post(auth_handlers::refresh))
        .route("/api/v1/auth/logout", post(auth_handlers::logout))
        .route("/api/v1/auth/me", get(auth_handlers::me))
        .route("/api/v1/auth/profile", put(auth_handlers::update_profile))
        .route("/api/v1/auth/mfa/setup", post(auth_handlers::mfa_setup))
        .route("/api/v1/auth/mfa/verify", post(auth_handlers::mfa_verify))
        .route(
            "/api/v1/auth/mfa/disable",
            post(auth_handlers::mfa_disable),
        )
        .route("/api/v1/auth/mfa/status", get(auth_handlers::mfa_status))
        // ── Password Reset ────────────────────────────────────
        .route("/api/v1/auth/forgot-password", post(auth_handlers::forgot_password))
        .route("/api/v1/auth/reset-password", post(auth_handlers::reset_password))
        // ── Tools ─────────────────────────────────────────────
        .route("/api/v1/tools", get(tool_handlers::list_tools))
        .route("/api/v1/tools/count", get(tool_handlers::tools_count))
        .route("/api/v1/tools/stats", get(tool_handlers::tools_stats))
        .route(
            "/api/v1/tools/available",
            get(tool_handlers::available_tools),
        )
        .route(
            "/api/v1/tools/health",
            get(tool_handlers::all_tools_health),
        )
        .route(
            "/api/v1/tools/business-categories",
            get(tool_handlers::business_categories),
        )
        .route(
            "/api/v1/tools/business-categories/:category",
            get(tool_handlers::business_category_tools),
        )
        .route("/api/v1/tools/groups", get(tool_handlers::tool_groups))
        .route("/api/v1/tools/groups/:group_id", get(tool_handlers::group_tools))
        .route("/api/v1/tools/search", get(tool_handlers::search_tools))
        .route("/api/v1/tools/:tool_id", get(tool_handlers::get_tool))
        .route(
            "/api/v1/tools/:tool_id/health",
            get(tool_handlers::tool_health),
        )
        // ── Scans ─────────────────────────────────────────────
        .route(
            "/api/v1/scans",
            get(scan_handlers::list_scans).post(scan_handlers::start_scan),
        )
        .route("/api/v1/scans/create", post(scan_handlers::create_scan))
        .route("/api/v1/scans/:scan_id", get(scan_handlers::get_scan).delete(scan_handlers::delete_scan))
        .route(
            "/api/v1/scans/:scan_id/output",
            get(scan_handlers::scan_output_stream),
        )
        .route(
            "/api/v1/scans/:scan_id/cancel",
            post(scan_handlers::cancel_scan),
        )
        .route(
            "/api/v1/scans/:scan_id/delete",
            delete(scan_handlers::delete_scan),
        )
        // ── Reports ───────────────────────────────────────────
        .route(
            "/api/v1/reports",
            get(report_handlers::list_reports).post(report_handlers::create_report),
        )
        .route(
            "/api/v1/reports/templates",
            get(report_handlers::report_templates),
        )
        .route(
            "/api/v1/reports/:report_id",
            get(report_handlers::get_report).delete(report_handlers::delete_report),
        )
        // ── Organization Logo ─────────────────────────────────
        .route(
            "/api/v1/organization/logo",
            get(report_handlers::get_org_logo)
                .post(report_handlers::upload_org_logo)
                .delete(report_handlers::delete_org_logo),
        )
        // ── Agents ────────────────────────────────────────────
        .route(
            "/api/v1/agents",
            get(agent_handlers::list_agents).post(agent_handlers::create_agent),
        )
        .route(
            "/api/v1/agents/:agent_id",
            get(agent_handlers::get_agent).put(stub_handlers::update_agent).delete(agent_handlers::delete_agent),
        )
        .route(
            "/api/v1/agents/:agent_id/heartbeat",
            post(agent_handlers::agent_heartbeat),
        )
        .route(
            "/api/v1/agents/:agent_id/jobs/next",
            get(agent_handlers::agent_next_job),
        )
        .route(
            "/api/v1/agents/:agent_id/jobs/:job_id/result",
            post(agent_handlers::agent_job_result),
        )
        .route(
            "/api/v1/agents/:agent_id/jobs",
            post(agent_handlers::queue_agent_job),
        )
        .route(
            "/api/v1/agents/jobs",
            get(agent_handlers::list_agent_jobs),
        )
        // ── Billing / Subscriptions ───────────────────────────
        .route(
            "/api/v1/billing/subscription",
            get(billing_handlers::get_subscription),
        )
        .route(
            "/api/v1/billing/checkout",
            post(billing_handlers::create_checkout),
        )
        .route(
            "/api/v1/billing/webhook",
            post(billing_handlers::stripe_webhook),
        )
        .route(
            "/api/v1/billing/sync-plan",
            post(billing_handlers::sync_plan),
        )
        // ── Dashboard ─────────────────────────────────────────
        .route(
            "/api/v1/dashboard/security-summary",
            get(dashboard_handlers::security_summary),
        )
        .route(
            "/api/v1/dashboard/analytics",
            get(dashboard_handlers::analytics_overview),
        )
        // ── Notifications ─────────────────────────────────────
        .route(
            "/api/v1/notifications",
            get(notification_handlers::list_notifications),
        )
        .route(
            "/api/v1/notifications/read-all",
            post(notification_handlers::read_all_notifications),
        )
        .route(
            "/api/v1/notifications/:id/read",
            post(notification_handlers::read_notification),
        )
        // ── Projects ──────────────────────────────────────────
        .route(
            "/api/v1/projects",
            get(project_handlers::list_projects).post(project_handlers::create_project),
        )
        .route(
            "/api/v1/projects/:project_id",
            get(project_handlers::get_project).delete(project_handlers::delete_project),
        )
        // ── SSO ───────────────────────────────────────────────
        .route(
            "/api/v1/sso/config",
            get(sso_handlers::get_sso_config)
                .post(sso_handlers::create_sso_config)
                .delete(sso_handlers::delete_sso_config),
        )
        .route("/api/v1/sso/toggle", post(sso_handlers::toggle_sso))
        .route("/api/v1/sso/test", post(sso_handlers::test_sso_connection))
        // ── SSO Auth Flows ────────────────────────────────────
        .route("/api/v1/auth/sso/ldap", post(sso_handlers::sso_ldap_login))
        .route("/api/v1/auth/sso/saml/init", get(sso_handlers::sso_saml_init))
        .route("/api/v1/auth/sso/saml/callback", post(sso_handlers::sso_saml_callback))
        .route("/api/v1/auth/sso/oidc/init", get(sso_handlers::sso_oidc_init))
        // ── Settings: Notification Preferences ────────────────
        .route("/api/v1/settings/notifications", get(settings_handlers::get_notification_preferences).put(settings_handlers::update_notification_preferences))
        // ── Settings: API Keys ────────────────────────────────
        .route("/api/v1/settings/api-keys", get(settings_handlers::list_api_keys).post(settings_handlers::create_api_key))
        .route("/api/v1/settings/api-keys/:key_id", delete(settings_handlers::delete_api_key))
        .route("/api/v1/settings/api-keys/:key_id/rotate", post(settings_handlers::rotate_api_key))
        .route("/api/v1/settings/api-keys/stats", get(settings_handlers::api_key_stats))
        // ── Settings: Team Management ─────────────────────────
        .route("/api/v1/settings/team", get(settings_handlers::list_team_members))
        .route("/api/v1/settings/team/invite", post(settings_handlers::invite_team_member))
        .route("/api/v1/settings/team/:member_id", delete(settings_handlers::remove_team_member))
        .route("/api/v1/settings/team/:member_id/role", put(settings_handlers::change_member_role))
        .route(
            "/api/v1/settings/purple-team/profile",
            get(settings_handlers::get_purple_team_profile)
                .put(settings_handlers::update_purple_team_profile),
        )
        // ── Settings: Password Change ─────────────────────────
        .route("/api/v1/auth/change-password", post(settings_handlers::change_password))
        // ── Plan Config ───────────────────────────────────────
        .route("/api/v1/plans", get(plan_config_handler))
        .route("/api/v1/plan/info", get(stub_handlers::plan_info))
        .route("/api/v1/plan/features", get(stub_handlers::plan_features))
        .route("/api/v1/roles", get(stub_handlers::roles_list))
        // ── Auth extras ───────────────────────────────────────
        .route("/api/v1/auth/google", post(stub_handlers::social_auth))
        .route("/api/v1/auth/github", post(stub_handlers::social_auth))
        .route("/api/v1/auth/resend-verification", post(stub_handlers::resend_verification))
        .route("/api/v1/auth/verify-email", get(stub_handlers::verify_email))
        .route("/api/v1/auth/avatar", post(stub_handlers::upload_avatar))
        .route("/api/v1/auth/mfa/verify-setup", post(stub_handlers::mfa_verify_setup))
        .route("/api/v1/auth/mfa/regenerate-backup", post(stub_handlers::mfa_regenerate_backup))
        // ── Tool extras ───────────────────────────────────────
        .route("/api/v1/tools/catalog", get(stub_handlers::tools_catalog))
        .route("/api/v1/tools/:tool_id/config", get(stub_handlers::tool_config))
        .route("/api/v1/tools/:tool_id/execution-mode", get(stub_handlers::tool_execution_mode))
        .route("/api/v1/tools/:slug/build-command", get(stub_handlers::tool_build_command))
        .route("/api/v2/tools", get(stub_handlers::v2_tools))
        .route("/api/v2/tools/:tool_id", get(stub_handlers::v2_tool_detail))
        // ── Scan singular variants ────────────────────────────
        .route("/api/v1/scan/start", post(scan_handlers::start_scan))
        .route("/api/v1/scan/:scan_id/output", get(scan_handlers::scan_output_stream))
        .route("/api/v1/scan/:scan_id/result", get(stub_handlers::scan_result))
        .route("/api/v1/scan/:scan_id/stop", post(scan_handlers::cancel_scan))
        .route("/api/v1/scans/:scan_id/rerun", post(stub_handlers::scan_rerun))
        .route("/api/v1/scans/:scan_id/business-report", get(stub_handlers::scan_business_report))
        .route("/api/v1/scans/:scan_id/status", get(stub_handlers::scan_status))
        .route("/api/v1/scans/execute", post(stub_handlers::scans_execute))
        // ── Agent extras ──────────────────────────────────────
        .route("/api/v1/agents/:agent_id/test", post(stub_handlers::test_agent))
        .route("/api/v1/agents/:agent_id/execute", post(agent_handlers::agent_execute))
        .route("/api/v1/agents/dashboard", get(stub_handlers::agents_dashboard))
        .route("/api/v1/agents/discover", post(agent_handlers::network_discover))
        .route("/api/v1/agents/enrollment-token", post(agent_handlers::issue_enrollment_token))
        // ── Scheduled scans ───────────────────────────────────
        .route("/api/v1/schedules", get(stub_handlers::list_schedules).post(stub_handlers::create_schedule))
        .route("/api/v1/schedules/:id", put(stub_handlers::update_schedule).delete(stub_handlers::delete_schedule))
        .route("/api/v1/schedules/:schedule_id/toggle", post(stub_handlers::toggle_schedule))
        .route("/api/v1/monitoring/continuous", post(stub_handlers::enable_continuous_monitoring))
        // ── Targets ───────────────────────────────────────────
        .route("/api/v1/targets", get(stub_handlers::list_targets))
        .route("/api/v1/target-groups", get(stub_handlers::list_target_groups))
        // ── Analytics / Activity ──────────────────────────────
        .route("/api/v1/analytics/overview", get(stub_handlers::analytics_overview))
        .route("/api/v1/activity", get(stub_handlers::activity_feed))
        // ── Usage ─────────────────────────────────────────────
        .route("/api/v1/usage/stats", get(stub_handlers::usage_stats))
        // ── Billing extras ────────────────────────────────────
        .route("/api/v1/billing/create-checkout", post(billing_handlers::create_checkout))
        .route("/api/v1/billing/portal", post(billing_handlers::billing_portal))
        .route("/api/create-checkout-session", post(billing_handlers::create_checkout_public))
        // ── Public marketing endpoints (no auth) ──────────────
        .route("/api/v1/blog/feed", get(news_handlers::list_blog_public))
        .route("/api/v1/newsletter/subscribe", post(newsletter_handlers::subscribe_newsletter))
        // ── Admin ─────────────────────────────────────────────
        .route("/api/v1/admin/overview", get(stub_handlers::admin_overview))
        .route("/api/v1/admin/impersonate", post(stub_handlers::admin_impersonate))
        .route("/api/v1/admin/change-plan", post(stub_handlers::admin_change_plan))
        .route("/api/v1/admin/users/:user_id", delete(stub_handlers::admin_delete_user))
        .route("/api/v1/admin/users/:user_id/toggle", put(stub_handlers::admin_toggle_user))
        .route("/api/v1/admin/users/:user_id/role", put(stub_handlers::admin_change_role))
        .route("/api/v1/admin/organizations/:org_id", delete(stub_handlers::admin_delete_organization))
        .route("/api/v1/admin/service-manager/dashboard", get(stub_handlers::admin_service_dashboard))
        .route("/api/v1/admin/service-manager/services", get(stub_handlers::admin_service_list))
        .route("/api/v1/admin/service-manager/services/:service_id/action", post(stub_handlers::admin_service_action))
        .route("/api/v1/admin/service-manager/system", get(stub_handlers::admin_system_info))
        .route("/api/v1/admin/service-manager/processes", get(stub_handlers::admin_processes))
        .route("/api/v1/admin/service-manager/alerts", get(stub_handlers::admin_alerts))
        .route("/api/v1/admin/service-manager/alerts/:alert_id/acknowledge", post(stub_handlers::admin_ack_alert))
        // ── Superadmin God Mode (realtime) ───────────────────
        .route("/api/v1/superadmin/telemetry", get(superadmin_handlers::telemetry))
        .route("/api/v1/superadmin/db-stats", get(superadmin_handlers::db_stats))
        .route("/api/v1/superadmin/logs", get(superadmin_handlers::logs))
        .route("/api/v1/superadmin/feature-flags", get(superadmin_handlers::list_feature_flags))
        .route("/api/v1/superadmin/feature-flags/:key", put(superadmin_handlers::upsert_feature_flag))
        .route("/api/v1/superadmin/kill-switch", get(superadmin_handlers::kill_switch_status).post(superadmin_handlers::kill_switch))
        .route("/api/v1/superadmin/organizations", get(superadmin_handlers::list_organizations))
        .route("/api/v1/superadmin/organizations/:org_id/plan", put(superadmin_handlers::change_org_plan))
        // ── AI ────────────────────────────────────────────────
        .route("/api/v1/ai/suggest", post(stub_handlers::ai_suggest))
        .route("/api/v1/ai/remediation", post(stub_handlers::ai_remediation))
        .route("/api/v1/ai/report-summary", post(stub_handlers::ai_report_summary))
        // ── CyberSec Pro AI (intelligent assistant) ───────────
        .route("/api/v1/ai/tools", get(ai_handlers::list_tools))
        .route("/api/v1/ai/suggest-tools", post(ai_handlers::suggest_tools))
        .route("/api/v1/ai/generate-command", post(ai_handlers::generate_command))
        .route("/api/v1/ai/playbook", post(ai_handlers::generate_playbook))
        .route("/api/v1/ai/explain", post(ai_handlers::explain))
        .route("/api/v1/ai/interpret-results", post(ai_handlers::interpret_results))
        .route("/api/v1/ai/validate-command", post(ai_handlers::validate))
        // ── Purple Team ───────────────────────────────────────
        .route("/api/v1/purple-team/dashboard", get(stub_handlers::purple_team_dashboard))
        .route("/api/v1/purple-team/chains", get(stub_handlers::purple_team_chains))
        .route("/api/v1/purple-team/playbooks", get(stub_handlers::purple_team_playbooks))
        .route("/api/v1/purple-team/exercises", get(stub_handlers::purple_team_exercises).post(stub_handlers::purple_team_create_exercise))
        .route("/api/v1/purple-team/exercises/:id", get(stub_handlers::purple_team_exercise_detail))
        .route("/api/v1/purple-team/exercises/:id/abort", post(stub_handlers::purple_team_abort_exercise))
        .route("/api/v1/purple-team/exercises/:id/telemetry", post(stub_handlers::purple_team_ingest_telemetry))
        .route("/api/v1/purple-team/mitre-matrix", get(stub_handlers::purple_team_mitre))
        // ── Terminal ──────────────────────────────────────────
        .route("/api/v1/terminal/agents", get(stub_handlers::terminal_agents))
        .route("/api/v1/terminal/execute", post(stub_handlers::terminal_execute))
        .route("/api/v1/terminal/test-connection", post(stub_handlers::terminal_test_connection))
        // ── Chatbot / Feedback ────────────────────────────────
        .route("/api/v1/chatbot/message", post(stub_handlers::chatbot_message))
        .route("/api/v1/feedback", post(stub_handlers::feedback))
        // ── Email ─────────────────────────────────────────────
        .route("/api/v1/email/send-license", post(email_handlers::send_license_email))
        .route("/api/v1/email/send-welcome", post(email_handlers::send_welcome_email))
        .route("/api/v1/email/config", get(email_handlers::email_config_status))
        // ── Site Monitor ──────────────────────────────────────
        .route("/api/v1/monitor/status", get(monitor_handlers::monitor_status))
        // ── Sales API (replaces Python cybersec-sales) ────────
        .route("/api/health", get(health_handlers::health))
        .route("/api/plans", get(sales_plans_handler))
        // ── GDPR ──────────────────────────────────────────────
        .route("/api/v1/gdpr/export", post(stub_handlers::gdpr_export))
        .route("/api/v1/gdpr/delete-account", post(stub_handlers::gdpr_delete_account))
        // ── Integrations ──────────────────────────────────────
        .route("/api/v1/integrations", get(stub_handlers::list_integrations).post(stub_handlers::create_integration))
        .route("/api/v1/integrations/:id", put(stub_handlers::update_integration).delete(stub_handlers::delete_integration))
        .route("/api/v1/integrations/:id/toggle", post(stub_handlers::toggle_integration))
        .route("/api/v1/integrations/:id/test", post(stub_handlers::test_integration))
        // ── Security News (real RSS aggregator) ───────────────
        .route("/api/v1/security-news", get(news_handlers::list_security_news))
        // ── Threat Intelligence (real CISA KEV + URLhaus + ThreatFox) ──
        .route("/api/v1/threat-intel", get(threat_intel_handlers::get_threat_intel))
        .route("/api/v1/vulnerability-db", get(vulnerability_db_handlers::get_vulnerability_db))
        // ── Phase 22: real Community / Forum ──────────────────────────────
        .route("/api/v1/community/posts",
               get(community_handlers::list_posts)
               .post(community_handlers::create_post))
        .route("/api/v1/community/posts/:id/like", post(community_handlers::toggle_like))
        .route("/api/v1/community/stats", get(community_handlers::get_stats))
        .route("/api/v1/community/leaderboard", get(community_handlers::get_leaderboard))
        .route("/api/v1/community/me/rank", get(community_handlers::get_my_rank))
        // ── Phase 23: real Compliance dashboard ───────────────────────────
        .route("/api/v1/compliance/dashboard", get(compliance_handlers::get_dashboard))
        // ── Phase 1: Security (Login History, IP Whitelist, Audit) ────────
        .route("/api/v1/security/login-history", get(security_handlers::get_login_history))
        .route("/api/v1/security/sessions", get(security_handlers::get_active_sessions))
        .route("/api/v1/security/audit-logs", get(security_handlers::get_audit_logs))
        .route("/api/v1/security/ip-whitelist", get(security_handlers::list_ip_whitelist).post(security_handlers::add_ip_whitelist))
        .route("/api/v1/security/ip-whitelist/:ip_id", delete(security_handlers::remove_ip_whitelist))
        // ── Phase 3: Scan Templates ────────────────────────────────────────
        .route("/api/v1/scan-templates", get(security_handlers::list_scan_templates).post(security_handlers::create_scan_template))
        .route("/api/v1/scan-templates/:template_id", delete(security_handlers::delete_scan_template))
        // ── Phase 5: Analytics Trend ──────────────────────────────────────
        .route("/api/v1/analytics/trend", get(security_handlers::get_analytics_trend))
        // ── Phase 6: Strix AI Jobs ────────────────────────────────────────
        .route("/api/v1/cybersec-ai/jobs", get(security_handlers::list_cybersec_ai_jobs).post(security_handlers::create_cybersec_ai_job))
        .route("/api/v1/cybersec-ai/jobs/:job_id", get(security_handlers::get_cybersec_ai_job).delete(security_handlers::delete_cybersec_ai_job))
        .route("/api/v1/cybersec-ai/jobs/:job_id/cancel", post(security_handlers::cancel_cybersec_ai_job))
        .merge(swagger_ui)
        .with_state(state)
}

/// Simple handler to expose plan configurations.
async fn plan_config_handler() -> impl axum::response::IntoResponse {
    axum::Json(serde_json::json!({
        "plans": services::plan::get_plan_configs()
    }))
}

/// Sales-site compatible plans endpoint (replaces Python /api/plans).
async fn sales_plans_handler() -> impl axum::response::IntoResponse {
    let plans = services::plan::get_plan_configs();
    let sales_plans: std::collections::HashMap<&str, serde_json::Value> = plans
        .iter()
        .map(|(name, cfg)| {
            (
                *name,
                serde_json::json!({
                    "name": match *name {
                        "trial" => "Trial",
                        "starter" => "Starter",
                        "professional" => "Professional",
                        "enterprise" => "Enterprise",
                        _ => name,
                    },
                    "price": cfg.price_eur,
                    "currency": "eur",
                    "interval": "month",
                    "monthly_scan_limit": cfg.monthly_scan_limit,
                    "daily_scan_limit": cfg.daily_scan_limit,
                    "concurrent_scans": cfg.concurrent_scans,
                    "max_team_members": cfg.max_team_members,
                    "stripe_price_id": match *name {
                        "starter" => std::env::var("STRIPE_STARTER_PRICE_ID").unwrap_or_default(),
                        "professional" => std::env::var("STRIPE_PROFESSIONAL_PRICE_ID").unwrap_or_default(),
                        "enterprise" => std::env::var("STRIPE_ENTERPRISE_PRICE_ID").unwrap_or_default(),
                        _ => String::new(),
                    },
                }),
            )
        })
        .collect();
    axum::Json(serde_json::json!({
        "plans": sales_plans,
        "currency": "eur",
        "billing_cycle": "monthly"
    }))
}

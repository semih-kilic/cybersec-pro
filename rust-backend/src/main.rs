#![allow(dead_code)]
mod handlers;
mod middleware;
mod models;
mod scan_engine;
mod services;

use axum::{
    extract::Extension,
    middleware as axum_middleware,
    routing::{delete, get, post, put},
    Router,
};
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{fmt, EnvFilter};

use middleware::rate_limiter::RateLimiter;
use middleware::security_headers::security_headers;

/// Shared application state available in all handlers.
pub struct AppState {
    pub db: SqlitePool,
    pub jwt_secret: String,
    pub rate_limiter: RateLimiter,
    pub scan_output_tx: broadcast::Sender<String>,
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

    // Database — use existing Flask SQLite database
    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "sqlite:../saas-backend/instance/cybersec_saas.db?mode=rwc".to_string()
    });
    let db = services::db::init_db(&database_url).await?;

    // JWT secret
    let jwt_secret = std::env::var("JWT_SECRET_KEY")
        .or_else(|_| std::env::var("SECRET_KEY"))
        .unwrap_or_else(|_| "cybersec-pro-secret-key-change-in-production".to_string());

    // Rate limiter
    let rate_limiter = RateLimiter::new();

    // Broadcast channel for scan SSE streaming
    let (scan_output_tx, _rx) = broadcast::channel::<String>(1024);

    // Build shared state
    let state = Arc::new(AppState {
        db,
        jwt_secret,
        rate_limiter,
        scan_output_tx,
    });

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
                    "https://semihkilic.com".parse().unwrap(),
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

    Router::new()
        // ── Health / Root ─────────────────────────────────────
        .route("/", get(health_handlers::index))
        .route("/health", get(health_handlers::health))
        .route("/ready", get(health_handlers::ready))
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
        .route("/api/v1/scans/:scan_id", get(scan_handlers::get_scan).delete(stub_handlers::scan_delete))
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
        // ── Agents ────────────────────────────────────────────
        .route(
            "/api/v1/agents",
            get(agent_handlers::list_agents).post(agent_handlers::create_agent),
        )
        .route(
            "/api/v1/agents/:agent_id",
            get(agent_handlers::get_agent).delete(agent_handlers::delete_agent),
        )
        .route(
            "/api/v1/agents/:agent_id/heartbeat",
            post(agent_handlers::agent_heartbeat),
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
        .route("/api/v1/sso/test", post(stub_handlers::sso_test))
        // ── Plan Config ───────────────────────────────────────
        .route("/api/v1/plans", get(plan_config_handler))
        .route("/api/v1/plan/info", get(stub_handlers::plan_info))
        .route("/api/v1/plan/features", get(stub_handlers::plan_features))
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
        .route("/api/v1/scan/start", post(stub_handlers::scan_start))
        .route("/api/v1/scan/:scan_id/output", get(scan_handlers::scan_output_stream))
        .route("/api/v1/scan/:scan_id/result", get(stub_handlers::scan_result))
        .route("/api/v1/scan/:scan_id/stop", post(stub_handlers::scan_stop))
        .route("/api/v1/scans/:scan_id/rerun", post(stub_handlers::scan_rerun))
        .route("/api/v1/scans/:scan_id/business-report", get(stub_handlers::scan_business_report))
        .route("/api/v1/scans/:scan_id/status", get(stub_handlers::scan_status))
        .route("/api/v1/scans/execute", post(stub_handlers::scans_execute))
        // ── Agent extras ──────────────────────────────────────
        .route("/api/v1/agents/:agent_id/update", put(stub_handlers::update_agent))
        .route("/api/v1/agents/:agent_id/test", post(stub_handlers::test_agent))
        .route("/api/v1/agents/dashboard", get(stub_handlers::agents_dashboard))
        // ── Scheduled scans ───────────────────────────────────
        .route("/api/v1/schedules", get(stub_handlers::list_schedules).post(stub_handlers::create_schedule))
        .route("/api/v1/schedules/:id", put(stub_handlers::update_schedule).delete(stub_handlers::delete_schedule))
        .route("/api/v1/schedules/:schedule_id/toggle", post(stub_handlers::toggle_schedule))
        // ── Targets ───────────────────────────────────────────
        .route("/api/v1/targets", get(stub_handlers::list_targets))
        .route("/api/v1/target-groups", get(stub_handlers::list_target_groups))
        // ── Analytics / Activity ──────────────────────────────
        .route("/api/v1/analytics/overview", get(stub_handlers::analytics_overview))
        .route("/api/v1/activity", get(stub_handlers::activity_feed))
        // ── Usage ─────────────────────────────────────────────
        .route("/api/v1/usage/stats", get(stub_handlers::usage_stats))
        // ── Billing extras ────────────────────────────────────
        .route("/api/v1/billing/create-checkout", post(stub_handlers::create_checkout_session))
        .route("/api/create-checkout-session", post(stub_handlers::create_checkout_session))
        // ── Admin ─────────────────────────────────────────────
        .route("/api/v1/admin/overview", get(stub_handlers::admin_overview))
        .route("/api/v1/admin/impersonate", post(stub_handlers::admin_impersonate))
        .route("/api/v1/admin/change-plan", post(stub_handlers::admin_change_plan))
        .route("/api/v1/admin/service-manager/dashboard", get(stub_handlers::admin_service_dashboard))
        .route("/api/v1/admin/service-manager/services", get(stub_handlers::admin_service_list))
        .route("/api/v1/admin/service-manager/services/:service_id/action", post(stub_handlers::admin_service_action))
        .route("/api/v1/admin/service-manager/system", get(stub_handlers::admin_system_info))
        .route("/api/v1/admin/service-manager/processes", get(stub_handlers::admin_processes))
        .route("/api/v1/admin/service-manager/alerts", get(stub_handlers::admin_alerts))
        .route("/api/v1/admin/service-manager/alerts/:alert_id/acknowledge", post(stub_handlers::admin_ack_alert))
        // ── AI ────────────────────────────────────────────────
        .route("/api/v1/ai/suggest", post(stub_handlers::ai_suggest))
        .route("/api/v1/ai/remediation", post(stub_handlers::ai_remediation))
        .route("/api/v1/ai/report-summary", post(stub_handlers::ai_report_summary))
        // ── Purple Team ───────────────────────────────────────
        .route("/api/v1/purple-team/dashboard", get(stub_handlers::purple_team_dashboard))
        .route("/api/v1/purple-team/chains", get(stub_handlers::purple_team_chains))
        .route("/api/v1/purple-team/playbooks", get(stub_handlers::purple_team_playbooks))
        .route("/api/v1/purple-team/exercises", get(stub_handlers::purple_team_exercises).post(stub_handlers::purple_team_create_exercise))
        .route("/api/v1/purple-team/exercises/:id", get(stub_handlers::purple_team_exercise_detail))
        .route("/api/v1/purple-team/mitre-matrix", get(stub_handlers::purple_team_mitre))
        // ── Terminal ──────────────────────────────────────────
        .route("/api/v1/terminal/agents", get(stub_handlers::terminal_agents))
        .route("/api/v1/terminal/execute", post(stub_handlers::terminal_execute))
        .route("/api/v1/terminal/test-connection", post(stub_handlers::terminal_test_connection))
        // ── Chatbot / Feedback ────────────────────────────────
        .route("/api/v1/chatbot/message", post(stub_handlers::chatbot_message))
        .route("/api/v1/feedback", post(stub_handlers::feedback))
        // ── GDPR ──────────────────────────────────────────────
        .route("/api/v1/gdpr/export", post(stub_handlers::gdpr_export))
        .route("/api/v1/gdpr/delete-account", post(stub_handlers::gdpr_delete_account))
        .with_state(state)
}

/// Simple handler to expose plan configurations.
async fn plan_config_handler() -> impl axum::response::IntoResponse {
    axum::Json(serde_json::json!({
        "plans": services::plan::get_plan_configs()
    }))
}

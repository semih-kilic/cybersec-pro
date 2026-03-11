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
use tower_http::cors::{Any, CorsLayer};
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
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
                .allow_credentials(false),
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
        .route("/api/v1/scans/:scan_id", get(scan_handlers::get_scan))
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
        // ── Plan Config ───────────────────────────────────────
        .route("/api/v1/plans", get(plan_config_handler))
        .with_state(state)
}

/// Simple handler to expose plan configurations.
async fn plan_config_handler() -> impl axum::response::IntoResponse {
    axum::Json(serde_json::json!({
        "plans": services::plan::get_plan_configs()
    }))
}

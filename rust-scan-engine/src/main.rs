use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod scanner;
mod auth;
mod error;
mod models;

use scanner::ScanEngine;

/// Shared application state
pub struct AppState {
    pub scan_engine: ScanEngine,
    pub jwt_secret: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| "cybersec_scan_engine=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load config
    dotenvy::dotenv().ok();
    let jwt_secret = std::env::var("JWT_SECRET_KEY")
        .expect("JWT_SECRET_KEY must be set");
    let port = std::env::var("SCAN_ENGINE_PORT")
        .unwrap_or_else(|_| "5002".to_string());

    // Initialize scan engine
    let state = Arc::new(AppState {
        scan_engine: ScanEngine::new(8), // 8 concurrent workers
        jwt_secret,
    });

    // Build routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/v3/scan", post(start_scan))
        .route("/api/v3/scan/:scan_id/status", get(scan_status))
        .route("/api/v3/scan/:scan_id/cancel", post(cancel_scan))
        .route("/api/v3/scan/:scan_id/output", get(scan_output))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("🦀 CyberSec Scan Engine starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Health check endpoint
async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "engine": "rust-scan-engine",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Start a new scan
async fn start_scan(
    State(state): State<Arc<AppState>>,
    Json(req): Json<models::ScanRequest>,
) -> Result<impl IntoResponse, error::AppError> {
    let scan_id = state.scan_engine.execute(req).await?;
    Ok((StatusCode::ACCEPTED, Json(serde_json::json!({
        "scan_id": scan_id,
        "status": "running",
    }))))
}

/// Get scan status
async fn scan_status(
    State(state): State<Arc<AppState>>,
    Path(scan_id): Path<String>,
) -> Result<impl IntoResponse, error::AppError> {
    let status = state.scan_engine.get_status(&scan_id).await?;
    Ok(Json(status))
}

/// Cancel a running scan
async fn cancel_scan(
    State(state): State<Arc<AppState>>,
    Path(scan_id): Path<String>,
) -> Result<impl IntoResponse, error::AppError> {
    state.scan_engine.cancel(&scan_id).await?;
    Ok(Json(serde_json::json!({"status": "cancelled"})))
}

/// Get scan output stream
async fn scan_output(
    State(state): State<Arc<AppState>>,
    Path(scan_id): Path<String>,
) -> Result<impl IntoResponse, error::AppError> {
    let output = state.scan_engine.get_output(&scan_id).await?;
    Ok(Json(serde_json::json!({"output": output})))
}

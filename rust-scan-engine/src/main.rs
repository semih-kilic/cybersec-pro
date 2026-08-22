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

mod grpc_server;
use scanner::ScanEngine;

/// Shared application state
pub struct AppState {
    pub scan_engine: Arc<ScanEngine>,
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
        .unwrap_or_else(|_| {
            tracing::warn!("JWT_SECRET_KEY not set, using insecure default (development only)");
            "dev-insecure-jwt-secret-change-in-production".to_string()
        });
    let port = std::env::var("SCAN_ENGINE_PORT")
        .unwrap_or_else(|_| "5002".to_string());

    // Initialize scan engine
    let state = Arc::new(AppState {
        scan_engine: Arc::new(ScanEngine::new(8)), // 8 concurrent workers
        jwt_secret,
    });

    // Build routes — health check is unauthenticated, scan endpoints require auth
    let app = Router::new()
        .route("/health", get(health_check))
        .merge(
            Router::new()
                .route("/api/v3/scan", post(start_scan))
                .route("/api/v3/scan/:scan_id/status", get(scan_status))
                .route("/api/v3/scan/:scan_id/cancel", post(cancel_scan))
                .route("/api/v3/scan/:scan_id/output", get(scan_output))
                .route("/api/v3/tools/check", post(tool_check))
                .layer(middleware::from_fn_with_state(state.clone(), auth::auth_middleware))
        )
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state.clone());

    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("🦀 CyberSec Scan Engine starting on {}", addr);

    
    // ─── gRPC server (port = SCAN_ENGINE_PORT + 1) ──────────────
    let grpc_port: u16 = port.parse::<u16>().unwrap_or(5002) + 1;
    let grpc_addr = format!("0.0.0.0:{}", grpc_port);
    tracing::info!("🦀 Initializing gRPC server on {}", grpc_addr);
    let grpc_state = grpc_server::GrpcScanState {
        scan_engine: Arc::clone(&state.scan_engine),
    };
    let grpc_app = grpc_server::grpc_router(grpc_state);
    tracing::info!("🦀 gRPC router built successfully, spawning listener");
    tokio::spawn(async move {
        tracing::info!("🦀 gRPC task: binding to {}", grpc_addr);
        match tokio::net::TcpListener::bind(&grpc_addr).await {
            Ok(listener) => {
                tracing::info!("🦀 gRPC server listening on {}", grpc_addr);
                if let Err(e) = axum::serve(listener, grpc_app).await {
                    tracing::error!("gRPC server error: {}", e);
                }
            }
            Err(e) => {
                tracing::error!("❌ Failed to bind gRPC on {}: {}", grpc_addr, e);
            }
        }
    });
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

#[derive(Deserialize)]
struct ToolCheckRequest {
    binary: String,
    quick_test_cmd: Option<String>,
}

/// POST /api/v3/tools/check — runs availability probes for one CLI tool inside
/// the engine container. Replaces backend `docker exec` health checks so the
/// API container no longer needs a docker.sock mount.
async fn tool_check(Json(body): Json<ToolCheckRequest>) -> impl IntoResponse {
    use std::process::Stdio;

    let binary = body.binary.trim().to_string();
    let valid = !binary.is_empty()
        && binary.len() <= 64
        && binary.chars().all(|ch| ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == '.');
    if !valid {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "invalid binary name"}))).into_response();
    }

    let installed = match tokio::process::Command::new("which")
        .arg(&binary)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
    {
        Ok(o) => o.status.success(),
        Err(_) => false,
    };

    let mut version: Option<String> = None;
    let mut runtime_ok = false;
    let mut runtime_output: Option<String> = None;

    if installed {
        if let Ok(out) = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            tokio::process::Command::new(&binary)
                .arg("--version")
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output(),
        ).await {
            if let Ok(o) = out {
                let combined = format!("{}{}", String::from_utf8_lossy(&o.stdout), String::from_utf8_lossy(&o.stderr));
                let first = combined.lines().next().unwrap_or("").chars().take(100).collect::<String>();
                if !first.is_empty() { version = Some(first); }
            }
        }

        let (cmd, args): (String, Vec<String>) = match body.quick_test_cmd.as_deref() {
            Some(qt) if !qt.trim().is_empty() => {
                let parts: Vec<String> = qt.split_whitespace().map(String::from).collect();
                (parts[0].clone(), parts[1..].to_vec())
            }
            _ => (binary.clone(), vec!["--help".to_string()]),
        };

        match tokio::time::timeout(
            std::time::Duration::from_secs(10),
            tokio::process::Command::new(&cmd)
                .args(&args)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output(),
        ).await {
            Ok(Ok(o)) => {
                runtime_ok = true;
                let combined = format!("{}{}", String::from_utf8_lossy(&o.stdout), String::from_utf8_lossy(&o.stderr));
                runtime_output = Some(combined.chars().take(500).collect());
            }
            _ => {
                runtime_ok = false;
                runtime_output = Some("runtime probe failed/timed out".to_string());
            }
        }
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "installed": installed,
            "version": version,
            "runtime_ok": runtime_ok,
            "runtime_output": runtime_output,
        })),
    ).into_response()
}

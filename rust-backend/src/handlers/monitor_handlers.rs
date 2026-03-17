/// CyberSec Pro — Monitor API Handlers (Rust)
/// Replaces Python site_monitor.py endpoints
use axum::{extract::State, response::IntoResponse, Json};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

/// GET /api/v1/monitor/status — get all monitored service statuses
pub async fn monitor_status(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let statuses = state.site_monitor.get_status().await;
    Json(json!({
        "services": statuses,
        "total": statuses.len(),
        "healthy": statuses.iter().filter(|s| s.is_up).count(),
        "unhealthy": statuses.iter().filter(|s| !s.is_up).count(),
    }))
}

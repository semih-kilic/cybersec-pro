use axum::{response::IntoResponse, Json};
use serde_json::json;

// ── Pure helpers (testable without DB) ─────────────────────────────────

pub fn api_info_body() -> serde_json::Value {
    json!({"name": "CyberSec Pro API", "version": "4.0.0", "engine": "Rust/Axum", "status": "operational"})
}

pub fn health_body() -> serde_json::Value {
    json!({"status": "healthy", "engine": "rust-axum", "version": "4.0.0"})
}

pub fn ready_body() -> serde_json::Value {
    json!({"ready": true, "engine": "rust-axum"})
}
pub async fn index() -> impl IntoResponse {
    Json(api_info_body())
}

pub async fn health() -> impl IntoResponse {
    Json(health_body())
}

pub async fn ready() -> impl IntoResponse {
    Json(ready_body())
}

#[cfg(test)]
mod tests {
    use super::{api_info_body, health_body, ready_body};

    #[test]
    fn api_info_body_has_expected_fields() {
        let body = api_info_body();
        assert_eq!(body["name"], "CyberSec Pro API");
        assert_eq!(body["version"], "4.0.0");
        assert_eq!(body["engine"], "Rust/Axum");
        assert_eq!(body["status"], "operational");
    }

    #[test]
    fn health_body_reports_healthy_status() {
        let body = health_body();
        assert_eq!(body["status"], "healthy");
        assert_eq!(body["engine"], "rust-axum");
        assert_eq!(body["version"], "4.0.0");
    }

    #[test]
    fn ready_body_reports_ready_true() {
        let body = ready_body();
        assert_eq!(body["ready"], true);
        assert_eq!(body["engine"], "rust-axum");
    }

    #[test]
    fn health_body_engine_differs_from_api_info_body_engine_case() {
        // api_info uses "Rust/Axum", health uses "rust-axum" — verify they stay distinct
        assert_ne!(api_info_body()["engine"], health_body()["engine"]);
    }
}

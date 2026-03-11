use axum::{response::IntoResponse, Json};
use serde_json::json;

pub async fn index() -> impl IntoResponse {
    Json(json!({
        "name": "CyberSec Pro API",
        "version": "4.0.0",
        "engine": "Rust/Axum",
        "status": "operational"
    }))
}

pub async fn health() -> impl IntoResponse {
    Json(json!({
        "status": "healthy",
        "engine": "rust-axum",
        "version": "4.0.0"
    }))
}

pub async fn ready() -> impl IntoResponse {
    Json(json!({
        "ready": true,
        "engine": "rust-axum"
    }))
}

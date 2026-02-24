use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

/// Application error types
#[derive(Debug)]
pub enum AppError {
    /// Input validation failed
    Validation(String),
    /// Resource not found
    NotFound(String),
    /// Scan execution error
    ScanExec(String),
    /// Authentication error
    Auth(String),
    /// Internal server error
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::ScanExec(msg) => {
                tracing::error!("Scan execution error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Scan execution failed".to_string())
            }
            AppError::Auth(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}

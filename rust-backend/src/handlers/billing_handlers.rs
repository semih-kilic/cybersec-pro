use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::AppState;

// ── Get Subscription ───────────────────────────────────────

pub async fn get_subscription(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let org: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT plan_type, stripe_customer_id FROM organizations WHERE id = $1"
    )
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (plan, stripe_id) = org.unwrap_or(("trial".into(), None));
    let configs = crate::services::plan::get_plan_configs();
    let config = configs.get(plan.as_str());

    (StatusCode::OK, Json(json!({
        "plan_type": plan,
        "stripe_customer_id": stripe_id,
        "config": config
    }))).into_response()
}

// ── Create Checkout Session ────────────────────────────────

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct CheckoutRequest {
    pub plan: String,
    pub success_url: Option<String>,
    pub cancel_url: Option<String>,
}

pub async fn create_checkout(
    State(_state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CheckoutRequest>,
) -> impl IntoResponse {
    // This is a stub — full Stripe integration requires stripe-rust
    // In production, create a Stripe checkout session here
    let _org_id = auth.org_id.as_deref().unwrap_or("");

    // Get or create Stripe customer
    let price_id = match body.plan.as_str() {
        "starter" => std::env::var("STRIPE_STARTER_PRICE_ID").unwrap_or_default(),
        "professional" => std::env::var("STRIPE_PROFESSIONAL_PRICE_ID").unwrap_or_default(),
        "enterprise" => std::env::var("STRIPE_ENTERPRISE_PRICE_ID").unwrap_or_default(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid plan"}))).into_response(),
    };

    if price_id.is_empty() {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": "Stripe not configured"}))).into_response();
    }

    // TODO: Implement full Stripe checkout session creation
    (StatusCode::OK, Json(json!({
        "message": "Checkout session would be created",
        "plan": body.plan,
        "price_id": price_id
    }))).into_response()
}

// ── Stripe Webhook ─────────────────────────────────────────

pub async fn stripe_webhook(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: String,
) -> impl IntoResponse {
    let webhook_secret = std::env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default();

    if webhook_secret.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Webhook not configured"}))).into_response();
    }

    // Verify Stripe signature
    let _sig = headers.get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // TODO: Verify signature using stripe_webhook_secret
    // For now, parse the event
    let event: serde_json::Value = match serde_json::from_str(&body) {
        Ok(e) => e,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid JSON"}))).into_response(),
    };

    let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");

    match event_type {
        "checkout.session.completed" => {
            // Update organization plan
            if let Some(data) = event.get("data").and_then(|d| d.get("object")) {
                let customer_id = data.get("customer").and_then(|c| c.as_str()).unwrap_or("");
                let _metadata = data.get("metadata");
                tracing::info!("Checkout completed for customer: {}", customer_id);
            }
        }
        "customer.subscription.updated" => {
            tracing::info!("Subscription updated");
        }
        "customer.subscription.deleted" => {
            // Reset to trial
            if let Some(data) = event.get("data").and_then(|d| d.get("object")) {
                let customer_id = data.get("customer").and_then(|c| c.as_str()).unwrap_or("");
                let _ = sqlx::query("UPDATE organizations SET plan_type = 'trial' WHERE stripe_customer_id = $1")
                    .bind(customer_id)
                    .execute(&state.db)
                    .await;
            }
        }
        "invoice.payment_failed" => {
            tracing::warn!("Payment failed");
        }
        _ => {}
    }

    (StatusCode::OK, Json(json!({"received": true}))).into_response()
}

// ── Sync Plan ──────────────────────────────────────────────

pub async fn sync_plan(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id,
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let org: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT plan_type, stripe_customer_id FROM organizations WHERE id = $1"
    )
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match org {
        Some((plan, stripe_id)) => (StatusCode::OK, Json(json!({
            "plan_type": plan,
            "stripe_customer_id": stripe_id,
            "synced": true
        }))).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Organization not found"}))).into_response(),
    }
}

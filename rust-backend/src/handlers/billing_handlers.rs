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
    pub billing: Option<String>,
    pub success_url: Option<String>,
    pub cancel_url: Option<String>,
}

pub async fn create_checkout(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<CheckoutRequest>,
) -> impl IntoResponse {
    let org_id = auth.org_id.as_deref().unwrap_or("");

    let stripe_secret = std::env::var("STRIPE_SECRET_KEY").unwrap_or_default();
    if stripe_secret.is_empty() {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": "Stripe not configured"}))).into_response();
    }

    let price_id = match body.plan.as_str() {
        "starter" => std::env::var("STRIPE_STARTER_PRICE_ID").unwrap_or_default(),
        "professional" => std::env::var("STRIPE_PROFESSIONAL_PRICE_ID").unwrap_or_default(),
        "enterprise" => std::env::var("STRIPE_ENTERPRISE_PRICE_ID").unwrap_or_default(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid plan"}))).into_response(),
    };

    if price_id.is_empty() {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": "Price not configured for this plan"}))).into_response();
    }

    // Get user email for Stripe customer
    let user_email: Option<(String,)> = sqlx::query_as("SELECT email FROM users WHERE id = $1")
        .bind(&auth.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let email = user_email.map(|u| u.0).unwrap_or_default();

    let success_url = body.success_url.unwrap_or_else(|| {
        format!("{}/dashboard/settings?tab=billing&success=true",
            std::env::var("DOMAIN").unwrap_or_else(|_| "https://semihkilic.com".into()))
    });
    let cancel_url = body.cancel_url.unwrap_or_else(|| {
        format!("{}/dashboard/upgrade",
            std::env::var("DOMAIN").unwrap_or_else(|_| "https://semihkilic.com".into()))
    });

    // Create Stripe Checkout Session via Stripe API
    let client = reqwest::Client::new();
    let mut params = vec![
        ("mode", "subscription".to_string()),
        ("line_items[0][price]", price_id.clone()),
        ("line_items[0][quantity]", "1".to_string()),
        ("success_url", success_url),
        ("cancel_url", cancel_url),
        ("metadata[org_id]", org_id.to_string()),
        ("metadata[plan]", body.plan.clone()),
        ("metadata[user_id]", auth.user_id.clone()),
    ];

    if !email.is_empty() {
        params.push(("customer_email", email));
    }

    let res = client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .basic_auth(&stripe_secret, None::<&str>)
        .form(&params)
        .send()
        .await;

    match res {
        Ok(response) => {
            let status = response.status();
            let body_text = response.text().await.unwrap_or_default();

            if status.is_success() {
                let session: serde_json::Value = serde_json::from_str(&body_text).unwrap_or_default();
                let checkout_url = session.get("url").and_then(|u| u.as_str()).unwrap_or("");

                if checkout_url.is_empty() {
                    return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "No checkout URL returned"}))).into_response();
                }

                (StatusCode::OK, Json(json!({
                    "checkout_url": checkout_url,
                    "session_id": session.get("id").and_then(|i| i.as_str()).unwrap_or("")
                }))).into_response()
            } else {
                tracing::error!("Stripe API error ({}): {}", status, body_text);
                let stripe_err: serde_json::Value = serde_json::from_str(&body_text).unwrap_or_default();
                let msg = stripe_err.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).unwrap_or("Stripe error");
                (StatusCode::BAD_GATEWAY, Json(json!({"error": msg}))).into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to reach Stripe: {}", e);
            (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to connect to payment provider"}))).into_response()
        }
    }
}

// Unauthenticated checkout for sales site
pub async fn create_checkout_public(
    State(_state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let stripe_secret = std::env::var("STRIPE_SECRET_KEY").unwrap_or_default();
    if stripe_secret.is_empty() {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": "Stripe not configured"}))).into_response();
    }

    let plan = body.get("plan").and_then(|p| p.as_str()).unwrap_or("");
    let price_id = match plan {
        "starter" => std::env::var("STRIPE_STARTER_PRICE_ID").unwrap_or_default(),
        "professional" => std::env::var("STRIPE_PROFESSIONAL_PRICE_ID").unwrap_or_default(),
        "enterprise" => std::env::var("STRIPE_ENTERPRISE_PRICE_ID").unwrap_or_default(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid plan"}))).into_response(),
    };

    if price_id.is_empty() {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": "Price not configured"}))).into_response();
    }

    let domain = std::env::var("DOMAIN").unwrap_or_else(|_| "https://semihkilic.com".into());
    let success_url = format!("{}/dashboard/login?checkout=success", domain);
    let cancel_url = format!("{}/new-pricing.html", domain);

    let client = reqwest::Client::new();
    let params = vec![
        ("mode", "subscription".to_string()),
        ("line_items[0][price]", price_id),
        ("line_items[0][quantity]", "1".to_string()),
        ("success_url", success_url),
        ("cancel_url", cancel_url),
        ("metadata[plan]", plan.to_string()),
    ];

    let res = client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .basic_auth(&stripe_secret, None::<&str>)
        .form(&params)
        .send()
        .await;

    match res {
        Ok(response) if response.status().is_success() => {
            let body_text = response.text().await.unwrap_or_default();
            let session: serde_json::Value = serde_json::from_str(&body_text).unwrap_or_default();
            let url = session.get("url").and_then(|u| u.as_str()).unwrap_or("");
            (StatusCode::OK, Json(json!({"url": url, "checkout_url": url}))).into_response()
        }
        Ok(response) => {
            let body_text = response.text().await.unwrap_or_default();
            tracing::error!("Stripe error: {}", body_text);
            (StatusCode::BAD_GATEWAY, Json(json!({"error": "Payment provider error"}))).into_response()
        }
        Err(e) => {
            tracing::error!("Stripe connection error: {}", e);
            (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to connect to payment provider"}))).into_response()
        }
    }
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

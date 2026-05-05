use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::AppState;
/// Constant-time byte comparison to prevent timing-side-channel leakage when
/// validating Stripe webhook signatures.
fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() { return false; }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) { diff |= x ^ y; }
    diff == 0
}
// ── Pure helpers (testable without DB) ────────────────────

/// Resolve plan name from a Stripe price ID using env-configured price IDs.
/// Returns empty string if price_id is unrecognized or env vars are not set.
pub fn resolve_plan_from_price_id(price_id: &str) -> &'static str {
    if price_id.is_empty() {
        return "";
    }
    let starter = std::env::var("STRIPE_STARTER_PRICE_ID").unwrap_or_default();
    let pro     = std::env::var("STRIPE_PROFESSIONAL_PRICE_ID").unwrap_or_default();
    let ent     = std::env::var("STRIPE_ENTERPRISE_PRICE_ID").unwrap_or_default();

    if !starter.is_empty() && price_id == starter { return "starter"; }
    if !pro.is_empty()     && price_id == pro     { return "professional"; }
    if !ent.is_empty()     && price_id == ent     { return "enterprise"; }
    ""
}

/// Extract the first price ID from a Stripe subscription event's items array.
pub fn extract_price_id_from_subscription(data: &serde_json::Value) -> &str {
    data.get("items")
        .and_then(|i| i.get("data"))
        .and_then(|d| d.as_array())
        .and_then(|arr| arr.first())
        .and_then(|item| item.get("price"))
        .and_then(|p| p.get("id"))
        .and_then(|id| id.as_str())
        .unwrap_or("")
}

/// Parse the Stripe-Signature header into (timestamp, v1_signature).
/// Returns None if the header is malformed or missing required parts.
pub fn parse_stripe_signature(sig_header: &str) -> Option<(&str, &str)> {
    let mut timestamp = None;
    let mut sig_v1 = None;
    for part in sig_header.split(',') {
        let part = part.trim();
        if let Some(t) = part.strip_prefix("t=") {
            timestamp = Some(t);
        } else if let Some(v) = part.strip_prefix("v1=") {
            sig_v1 = Some(v);
        }
    }
    match (timestamp, sig_v1) {
        (Some(t), Some(v)) if !t.is_empty() && !v.is_empty() => Some((t, v)),
        _ => None,
    }
}

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
        ("metadata[plan_type]", body.plan.clone()),   // was "plan" — webhook reads "plan_type"
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
    headers: HeaderMap,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Rate limit: 10 checkout attempts per IP per hour (prevent Stripe API abuse)
    let ip = headers.get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    if _state.rate_limiter.is_limited(&format!("checkout:{}", ip), 10, std::time::Duration::from_secs(3600)) {
        return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many checkout attempts. Try again later."}))).into_response();
    }

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
        ("metadata[plan_type]", plan.to_string()),   // consistent with webhook handler
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
    let sig_header = headers.get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if sig_header.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Missing signature"}))).into_response();
    }

    // Parse signature header: t=timestamp,v1=signature
    let (timestamp, sig_v1) = match parse_stripe_signature(sig_header) {
        Some(pair) => pair,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid signature format"}))).into_response(),
    };

    // Verify HMAC-SHA256: signed_payload = timestamp + "." + body
    let signed_payload = format!("{}.{}", timestamp, &body);
    let mut mac = match Hmac::<Sha256>::new_from_slice(webhook_secret.as_bytes()) {
        Ok(m) => m,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Webhook config error"}))).into_response(),
    };
    mac.update(signed_payload.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());

    if !ct_eq(expected.as_bytes(), sig_v1.as_bytes()) {
        tracing::warn!("Stripe webhook signature mismatch");
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid signature"}))).into_response();
    }

    // Check timestamp tolerance (5 minutes)
    if let Ok(ts) = timestamp.parse::<i64>() {
        let now = chrono::Utc::now().timestamp();
        if (now - ts).abs() > 300 {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": "Timestamp too old"}))).into_response();
        }
    }

    let event: serde_json::Value = match serde_json::from_str(&body) {
        Ok(e) => e,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid JSON"}))).into_response(),
    };

    let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");
    let event_id = event.get("id").and_then(|i| i.as_str()).unwrap_or("");

    // Idempotency: skip already-processed events
    if !event_id.is_empty() {
        let already_processed: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM stripe_events WHERE event_id = $1"
        )
        .bind(event_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

        if already_processed.is_some() {
            tracing::info!("Stripe event {} already processed, skipping", event_id);
            return (StatusCode::OK, Json(json!({"received": true, "duplicate": true}))).into_response();
        }

        // Record event as processed
        let _ = sqlx::query(
            "INSERT INTO stripe_events (event_id, event_type, processed_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (event_id) DO NOTHING"
        )
        .bind(event_id)
        .bind(event_type)
        .execute(&state.db)
        .await;
    }

    match event_type {
        "checkout.session.completed" => {
            // Update organization plan based on metadata
            if let Some(data) = event.get("data").and_then(|d| d.get("object")) {
                let customer_id = data.get("customer").and_then(|c| c.as_str()).unwrap_or("");
                let metadata = data.get("metadata");

                // Get plan_type and org_id from checkout metadata
                let plan_type = metadata
                    .and_then(|m| m.get("plan_type"))
                    .and_then(|p| p.as_str())
                    .unwrap_or("");
                let org_id = metadata
                    .and_then(|m| m.get("org_id"))
                    .and_then(|o| o.as_str())
                    .unwrap_or("");

                let mut effective_plan = String::new();
                let mut effective_amount: i64 = data.get("amount_total").and_then(|a| a.as_i64()).unwrap_or(0);
                let currency = data.get("currency").and_then(|c| c.as_str()).unwrap_or("eur").to_uppercase();
                let customer_email = data.get("customer_email").and_then(|e| e.as_str()).unwrap_or("").to_string();

                if !plan_type.is_empty() && !org_id.is_empty() {
                    // Update org plan and store stripe_customer_id
                    let _ = sqlx::query(
                        "UPDATE organizations SET plan_type = $1, stripe_customer_id = $2 WHERE id = $3"
                    )
                    .bind(plan_type)
                    .bind(customer_id)
                    .bind(org_id)
                    .execute(&state.db)
                    .await;
                    tracing::info!("Plan updated: org={} plan={} customer={}", org_id, plan_type, customer_id);
                    effective_plan = plan_type.to_string();
                } else if !customer_id.is_empty() {
                    // Fallback: resolve plan from amount_total when metadata is missing
                    if effective_amount > 0 {
                        let resolved_plan = match effective_amount {
                            9900 => "starter",
                            29900 => "professional",
                            79900 => "enterprise",
                            _ => ""
                        };
                        if !resolved_plan.is_empty() {
                            let _ = sqlx::query(
                                "UPDATE organizations SET plan_type = $1, stripe_customer_id = $2 WHERE stripe_customer_id = $2 OR id IN (SELECT organization_id FROM users WHERE email = $3)"
                            )
                            .bind(resolved_plan)
                            .bind(customer_id)
                            .bind(&customer_email)
                            .execute(&state.db)
                            .await;
                            tracing::info!("Plan resolved from amount: {} -> {}", effective_amount, resolved_plan);
                            effective_plan = resolved_plan.to_string();
                        }
                    }
                }

                // Send payment confirmation email (best-effort, non-blocking on failure)
                if !customer_email.is_empty() && !effective_plan.is_empty() {
                    if let Some(cfg) = crate::services::email::EmailConfig::from_env() {
                        if effective_amount <= 0 {
                            effective_amount = data.get("amount_total").and_then(|a| a.as_i64()).unwrap_or(0);
                        }
                        let amount_str = format!("{:.2} {}", (effective_amount as f64) / 100.0, currency);
                        let plan_label = match effective_plan.as_str() {
                            "starter"      => "Starter Plan",
                            "professional" => "Professional Plan",
                            "enterprise"   => "Enterprise Plan",
                            other          => other,
                        };
                        let recipient = customer_email.clone();
                        let plan_label_owned = plan_label.to_string();
                        let amount_owned = amount_str.clone();
                        tokio::spawn(async move {
                            if let Err(e) = crate::services::email::send_payment_confirmation(
                                &cfg,
                                &recipient,
                                &recipient,
                                &amount_owned,
                                &plan_label_owned,
                            ).await {
                                tracing::warn!("Payment confirmation email failed for {}: {}", recipient, e);
                            } else {
                                tracing::info!("Payment confirmation email sent to {} ({} - {})", recipient, plan_label_owned, amount_owned);
                            }
                        });
                    } else {
                        tracing::debug!("EmailConfig not configured; skipping payment confirmation email");
                    }
                }
            }
        }
        "customer.subscription.updated" => {
            if let Some(data) = event.get("data").and_then(|d| d.get("object")) {
                let customer_id = data.get("customer").and_then(|c| c.as_str()).unwrap_or("");
                let sub_id      = data.get("id").and_then(|i| i.as_str()).unwrap_or("");
                let status      = data.get("status").and_then(|s| s.as_str()).unwrap_or("active");
                let price_id    = extract_price_id_from_subscription(data);
                let plan_type   = resolve_plan_from_price_id(price_id);

                // Update org plan when we can resolve it from price ID
                if !customer_id.is_empty() && !plan_type.is_empty() {
                    let _ = sqlx::query(
                        "UPDATE organizations SET plan_type = $1 WHERE stripe_customer_id = $2"
                    )
                    .bind(plan_type)
                    .bind(customer_id)
                    .execute(&state.db)
                    .await;
                    tracing::info!("Subscription updated: customer={} plan={} status={}", customer_id, plan_type, status);
                }

                // Upsert subscription record for period tracking
                if !sub_id.is_empty() {
                    let period_start = data.get("current_period_start")
                        .and_then(|t| t.as_i64())
                        .map(|ts| chrono::DateTime::from_timestamp(ts, 0).unwrap_or_default().naive_utc());
                    let period_end = data.get("current_period_end")
                        .and_then(|t| t.as_i64())
                        .map(|ts| chrono::DateTime::from_timestamp(ts, 0).unwrap_or_default().naive_utc());

                    let _ = sqlx::query(
                        r#"INSERT INTO subscriptions (id, organization_id, stripe_subscription_id, plan_type, status, current_period_start, current_period_end, created_at)
                           SELECT gen_random_uuid()::text, id, $1, $2, $3, $4, $5, NOW()
                           FROM organizations WHERE stripe_customer_id = $6
                           ON CONFLICT (stripe_subscription_id) DO UPDATE
                             SET status = EXCLUDED.status,
                                 plan_type = EXCLUDED.plan_type,
                                 current_period_start = EXCLUDED.current_period_start,
                                 current_period_end = EXCLUDED.current_period_end"#
                    )
                    .bind(sub_id)
                    .bind(if plan_type.is_empty() { "unknown" } else { plan_type })
                    .bind(status)
                    .bind(period_start)
                    .bind(period_end)
                    .bind(customer_id)
                    .execute(&state.db)
                    .await;
                }
            }
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
            if let Some(data) = event.get("data").and_then(|d| d.get("object")) {
                let customer_id = data.get("customer").and_then(|c| c.as_str()).unwrap_or("");
                let sub_id      = data.get("subscription").and_then(|s| s.as_str()).unwrap_or("");
                let attempt_count = data.get("attempt_count").and_then(|a| a.as_i64()).unwrap_or(1);

                // Mark subscription as past_due
                if !sub_id.is_empty() {
                    let _ = sqlx::query(
                        "UPDATE subscriptions SET status = 'past_due' WHERE stripe_subscription_id = $1"
                    )
                    .bind(sub_id)
                    .execute(&state.db)
                    .await;
                }

                tracing::warn!(
                    "Payment failed: customer={} subscription={} attempt={}",
                    customer_id, sub_id, attempt_count
                );
            }
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

// ── Billing Portal ─────────────────────────────────────────

pub async fn billing_portal(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = match &auth.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    let stripe_secret = std::env::var("STRIPE_SECRET_KEY").unwrap_or_default();
    if stripe_secret.is_empty() {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": "Stripe not configured"}))).into_response();
    }

    // Fetch stripe_customer_id for this org
    let org: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT stripe_customer_id FROM organizations WHERE id = $1"
    )
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let customer_id = org
        .and_then(|(cid,)| cid)
        .unwrap_or_default();

    if customer_id.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "No billing account found. Complete a checkout first."}))).into_response();
    }

    let return_url = format!(
        "{}/dashboard/settings?tab=billing",
        std::env::var("DOMAIN").unwrap_or_else(|_| "https://semihkilic.com".into())
    );

    let client = reqwest::Client::new();
    let params = vec![
        ("customer", customer_id.as_str()),
        ("return_url", return_url.as_str()),
    ];

    let res = client
        .post("https://api.stripe.com/v1/billing_portal/sessions")
        .basic_auth(&stripe_secret, None::<&str>)
        .form(&params)
        .send()
        .await;

    match res {
        Ok(response) if response.status().is_success() => {
            let body_text = response.text().await.unwrap_or_default();
            let session: serde_json::Value = serde_json::from_str(&body_text).unwrap_or_default();
            let url = session.get("url").and_then(|u| u.as_str()).unwrap_or("");
            (StatusCode::OK, Json(json!({"portal_url": url}))).into_response()
        }
        Ok(response) => {
            let body_text = response.text().await.unwrap_or_default();
            tracing::error!("Stripe portal error: {}", body_text);
            let stripe_err: serde_json::Value = serde_json::from_str(&body_text).unwrap_or_default();
            let msg = stripe_err.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).unwrap_or("Failed to create portal session");
            (StatusCode::BAD_GATEWAY, Json(json!({"error": msg}))).into_response()
        }
        Err(e) => {
            tracing::error!("Stripe portal connection error: {}", e);
            (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to connect to payment provider"}))).into_response()
        }
    }
}

// ── Unit tests ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn billing_parse_stripe_signature_valid() {
        let header = "t=1714000000,v1=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        let result = parse_stripe_signature(header);
        assert!(result.is_some());
        let (ts, sig) = result.unwrap();
        assert_eq!(ts, "1714000000");
        assert_eq!(sig, "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
    }

    #[test]
    fn billing_parse_stripe_signature_missing_timestamp() {
        let header = "v1=abcdef1234";
        assert!(parse_stripe_signature(header).is_none());
    }

    #[test]
    fn billing_parse_stripe_signature_missing_v1() {
        let header = "t=1714000000";
        assert!(parse_stripe_signature(header).is_none());
    }

    #[test]
    fn billing_parse_stripe_signature_empty() {
        assert!(parse_stripe_signature("").is_none());
    }

    #[test]
    fn billing_parse_stripe_signature_extra_fields_ignored() {
        let header = "t=123,v0=legacy,v1=actual_sig,extra=ignored";
        let result = parse_stripe_signature(header);
        assert!(result.is_some());
        let (ts, sig) = result.unwrap();
        assert_eq!(ts, "123");
        assert_eq!(sig, "actual_sig");
    }

    #[test]
    fn billing_resolve_plan_empty_price_id_returns_empty() {
        let plan = resolve_plan_from_price_id("");
        assert_eq!(plan, "");
    }

    #[test]
    fn billing_resolve_plan_unknown_price_returns_empty() {
        // Without env vars set, any price_id should return ""
        std::env::remove_var("STRIPE_STARTER_PRICE_ID");
        std::env::remove_var("STRIPE_PROFESSIONAL_PRICE_ID");
        std::env::remove_var("STRIPE_ENTERPRISE_PRICE_ID");
        assert_eq!(resolve_plan_from_price_id("price_unknown_xxx"), "");
    }

    #[test]
    fn billing_resolve_plan_matches_env_configured_price_id() {
        std::env::set_var("STRIPE_STARTER_PRICE_ID", "price_starter_test");
        std::env::set_var("STRIPE_PROFESSIONAL_PRICE_ID", "price_pro_test");
        std::env::set_var("STRIPE_ENTERPRISE_PRICE_ID", "price_ent_test");

        assert_eq!(resolve_plan_from_price_id("price_starter_test"), "starter");
        assert_eq!(resolve_plan_from_price_id("price_pro_test"), "professional");
        assert_eq!(resolve_plan_from_price_id("price_ent_test"), "enterprise");
        assert_eq!(resolve_plan_from_price_id("price_other"), "");

        std::env::remove_var("STRIPE_STARTER_PRICE_ID");
        std::env::remove_var("STRIPE_PROFESSIONAL_PRICE_ID");
        std::env::remove_var("STRIPE_ENTERPRISE_PRICE_ID");
    }

    #[test]
    fn billing_extract_price_id_from_subscription_valid() {
        let data = serde_json::json!({
            "id": "sub_123",
            "items": {
                "data": [
                    {
                        "price": { "id": "price_starter_live" }
                    }
                ]
            }
        });
        assert_eq!(extract_price_id_from_subscription(&data), "price_starter_live");
    }

    #[test]
    fn billing_extract_price_id_from_subscription_missing_items() {
        let data = serde_json::json!({ "id": "sub_123" });
        assert_eq!(extract_price_id_from_subscription(&data), "");
    }

    #[test]
    fn billing_extract_price_id_from_subscription_empty_items_array() {
        let data = serde_json::json!({ "items": { "data": [] } });
        assert_eq!(extract_price_id_from_subscription(&data), "");
    }

    #[test]
    fn billing_webhook_subscription_updated_event_shape() {
        // Simulate the Stripe event shape that customer.subscription.updated delivers.
        let event = serde_json::json!({
            "id": "evt_test_001",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": "sub_abc",
                    "customer": "cus_xyz",
                    "status": "active",
                    "current_period_start": 1714000000_i64,
                    "current_period_end":   1716592000_i64,
                    "items": {
                        "data": [{ "price": { "id": "price_pro_live" } }]
                    }
                }
            }
        });

        let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");
        assert_eq!(event_type, "customer.subscription.updated");

        let data = event["data"]["object"].clone();
        let customer_id = data.get("customer").and_then(|c| c.as_str()).unwrap_or("");
        let status = data.get("status").and_then(|s| s.as_str()).unwrap_or("");
        let price_id = extract_price_id_from_subscription(&data);

        assert_eq!(customer_id, "cus_xyz");
        assert_eq!(status, "active");
        assert_eq!(price_id, "price_pro_live");
    }

    #[test]
    fn billing_webhook_payment_failed_event_shape() {
        let event = serde_json::json!({
            "id": "evt_fail_001",
            "type": "invoice.payment_failed",
            "data": {
                "object": {
                    "customer": "cus_xyz",
                    "subscription": "sub_abc",
                    "attempt_count": 2
                }
            }
        });

        let data = &event["data"]["object"];
        let customer_id = data.get("customer").and_then(|c| c.as_str()).unwrap_or("");
        let sub_id = data.get("subscription").and_then(|s| s.as_str()).unwrap_or("");
        let attempt = data.get("attempt_count").and_then(|a| a.as_i64()).unwrap_or(1);

        assert_eq!(customer_id, "cus_xyz");
        assert_eq!(sub_id, "sub_abc");
        assert_eq!(attempt, 2);
    }
}

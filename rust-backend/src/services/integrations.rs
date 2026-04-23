use reqwest::Client;
use serde_json::{json, Value};
use sqlx::PgPool;

/// Send a notification to all active integrations for an organization when an event occurs.
pub async fn notify_integrations(
    db: &PgPool,
    org_id: &str,
    event_type: &str,
    payload: &Value,
) {
    // Fetch all active integrations for this org
    let integrations = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, integration_type, webhook_url, config::text, name FROM integrations WHERE organization_id = $1 AND is_active = TRUE"
    )
    .bind(org_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    for (id, int_type, webhook_url, _config, name) in integrations {
        let url = match webhook_url {
            Some(u) if !u.is_empty() => u,
            _ => continue,
        };

        let result = match int_type.as_str() {
            "slack" => send_slack(&url, event_type, payload).await,
            "teams" => send_teams(&url, event_type, payload).await,
            "webhook" => send_webhook(&url, event_type, payload).await,
            "jira" => {
                tracing::info!("Jira integration '{}' triggered for event '{}'", name.unwrap_or_default(), event_type);
                Ok(()) // Jira needs special handling via API, not webhook
            }
            _ => send_webhook(&url, event_type, payload).await,
        };

        if let Err(e) = result {
            tracing::error!("Integration {} ({}) failed: {}", id, int_type, e);
            // Update last_error
            let _ = sqlx::query("UPDATE integrations SET last_error = $1, updated_at = NOW() WHERE id = $2")
                .bind(format!("{}", e))
                .bind(&id)
                .execute(db)
                .await;
        } else {
            let _ = sqlx::query("UPDATE integrations SET last_triggered_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = $1")
                .bind(&id)
                .execute(db)
                .await;
        }
    }
}

/// Pure helper: returns (color, emoji) for a Slack attachment based on event type.
pub fn slack_event_style(event_type: &str) -> (&'static str, &'static str) {
    match event_type {
        "scan_completed" => ("#36a64f", "\u{2705}"),
        "scan_failed" => ("#d32f2f", "\u{274C}"),
        "vulnerability_critical" => ("#d32f2f", "\u{1F6A8}"),
        "vulnerability_high" => ("#ff9800", "\u{26A0}\u{FE0F}"),
        _ => ("#2196f3", "\u{2139}\u{FE0F}"),
    }
}

async fn send_slack(webhook_url: &str, event_type: &str, payload: &Value) -> Result<(), String> {
    let (color, emoji) = slack_event_style(event_type);

    let target = payload.get("target").and_then(|v| v.as_str()).unwrap_or("N/A");
    let tool = payload.get("tool").and_then(|v| v.as_str()).unwrap_or("N/A");
    let status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("unknown");

    let slack_payload = json!({
        "attachments": [{
            "color": color,
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": format!("{} *CyberSec Pro — {}*\n*Target:* {}\n*Tool:* {}\n*Status:* {}", emoji, event_type.replace('_', " "), target, tool, status)
                    }
                }
            ]
        }]
    });

    let client = Client::new();
    let resp = client.post(webhook_url)
        .json(&slack_payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Slack request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Slack returned status {}", resp.status()));
    }
    Ok(())
}

async fn send_teams(webhook_url: &str, event_type: &str, payload: &Value) -> Result<(), String> {
    let target = payload.get("target").and_then(|v| v.as_str()).unwrap_or("N/A");
    let tool = payload.get("tool").and_then(|v| v.as_str()).unwrap_or("N/A");
    let status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("unknown");

    let teams_payload = json!({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0076D7",
        "summary": format!("CyberSec Pro — {}", event_type),
        "sections": [{
            "activityTitle": format!("CyberSec Pro — {}", event_type.replace('_', " ")),
            "facts": [
                {"name": "Target", "value": target},
                {"name": "Tool", "value": tool},
                {"name": "Status", "value": status}
            ],
            "markdown": true
        }]
    });

    let client = Client::new();
    let resp = client.post(webhook_url)
        .json(&teams_payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Teams request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Teams returned status {}", resp.status()));
    }
    Ok(())
}

async fn send_webhook(webhook_url: &str, event_type: &str, payload: &Value) -> Result<(), String> {
    let webhook_payload = json!({
        "event": event_type,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "source": "cybersec-pro",
        "data": payload
    });

    let client = Client::new();
    let resp = client.post(webhook_url)
        .json(&webhook_payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Webhook request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Webhook returned status {}", resp.status()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slack_event_style_known_events() {
        let (color, emoji) = slack_event_style("scan_completed");
        assert_eq!(color, "#36a64f");
        assert_eq!(emoji, "\u{2705}");

        let (color, emoji) = slack_event_style("scan_failed");
        assert_eq!(color, "#d32f2f");
        assert_eq!(emoji, "\u{274C}");

        let (color, emoji) = slack_event_style("vulnerability_critical");
        assert_eq!(color, "#d32f2f");
        assert_eq!(emoji, "\u{1F6A8}");

        let (color, emoji) = slack_event_style("vulnerability_high");
        assert_eq!(color, "#ff9800");
        assert_eq!(emoji, "\u{26A0}\u{FE0F}");
    }

    #[test]
    fn test_slack_event_style_unknown_falls_back() {
        let (color, emoji) = slack_event_style("some_other_event");
        assert_eq!(color, "#2196f3");
        assert_eq!(emoji, "\u{2139}\u{FE0F}");

        let (color, emoji) = slack_event_style("");
        assert_eq!(color, "#2196f3");
        assert_eq!(emoji, "\u{2139}\u{FE0F}");
    }
}

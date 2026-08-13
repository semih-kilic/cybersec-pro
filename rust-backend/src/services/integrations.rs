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

    for (id, int_type, webhook_url, config, name) in integrations {
        let config_val: Value = config.as_deref().and_then(|c| serde_json::from_str(c).ok()).unwrap_or_default();

        let result = match int_type.as_str() {
            "slack" => {
                let url = match webhook_url {
                    Some(u) if !u.is_empty() => u,
                    _ => continue,
                };
                send_slack(&url, event_type, payload).await
            }
            "teams" => {
                let url = match webhook_url {
                    Some(u) if !u.is_empty() => u,
                    _ => continue,
                };
                send_teams(&url, event_type, payload).await
            }
            "webhook" => {
                let url = match webhook_url {
                    Some(u) if !u.is_empty() => u,
                    _ => continue,
                };
                send_webhook(&url, event_type, payload).await
            }
            "jira" => send_jira(&config_val, event_type, payload).await,
            "github" => send_github(&config_val, event_type, payload).await,
            "servicenow" => send_servicenow(&config_val, event_type, payload).await,
            _ => continue,
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

async fn send_jira(config: &Value, event_type: &str, payload: &Value) -> Result<(), String> {
    let base_url = config.get("base_url").and_then(|v| v.as_str()).ok_or("Missing Jira base_url")?;
    let username = config.get("username").and_then(|v| v.as_str()).ok_or("Missing Jira username")?;
    let api_token = config.get("api_token").and_then(|v| v.as_str()).ok_or("Missing Jira api_token")?;
    let project_key = config.get("project_key").and_then(|v| v.as_str()).ok_or("Missing Jira project_key")?;
    let issue_type = config.get("issue_type").and_then(|v| v.as_str()).unwrap_or("Bug");

    let target = payload.get("target").and_then(|v| v.as_str()).unwrap_or("N/A");
    let tool = payload.get("tool").and_then(|v| v.as_str()).unwrap_or("N/A");
    let status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("unknown");
    let summary = format!("[CyberSec Pro] {} - {}", event_type.replace('_', " "), target);
    let description = format!(
        "h2. Scan Details\n\n*Tool:* {}\n*Target:* {}\n*Status:* {}\n*Event:* {}\n\nh2. Details\n\nAutomated issue created by CyberSec Pro integration.",
        tool, target, status, event_type
    );

    let issue_payload = json!({
        "fields": {
            "project": {"key": project_key},
            "summary": summary,
            "description": {
                "type": "doc",
                "version": 1,
                "content": [{
                    "type": "paragraph",
                    "content": [{"type": "text", "text": description}]
                }]
            },
            "issuetype": {"name": issue_type}
        }
    });

    let client = Client::new();
    let resp = client
        .post(format!("{}/rest/api/3/issue", base_url.trim_end_matches('/')))
        .basic_auth(username, api_token)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .json(&issue_payload)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Jira request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Jira returned {}: {}", status, body));
    }

    Ok(())
}

async fn send_github(config: &Value, event_type: &str, payload: &Value) -> Result<(), String> {
    let token = config.get("token").and_then(|v| v.as_str()).ok_or("Missing GitHub token")?;
    let owner = config.get("owner").and_then(|v| v.as_str()).ok_or("Missing GitHub owner")?;
    let repo = config.get("repo").and_then(|v| v.as_str()).ok_or("Missing GitHub repo")?;
    let issue_title = config.get("issue_title").and_then(|v| v.as_str()).unwrap_or("Security Issue");
    let labels = config.get("labels").and_then(|v| v.as_array()).ok_or("Missing GitHub labels")?;

    let target = payload.get("target").and_then(|v| v.as_str()).unwrap_or("N/A");
    let tool = payload.get("tool").and_then(|v| v.as_str()).unwrap_or("N/A");
    let status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("unknown");
    let title = format!("{} - {}", issue_title, target);
    let body = format!(
        "**Event:** {}\n**Tool:** {}\n**Target:** {}\n**Status:** {}\n\nAutomated issue created by CyberSec Pro integration.",
        event_type, tool, target, status
    );

    let issue_payload = json!({
        "title": title,
        "body": body,
        "labels": labels.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<_>>()
    });

    let client = Client::new();
    let resp = client
        .post(format!("https://api.github.com/repos/{}/{}/issues", owner, repo))
        .bearer_auth(token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&issue_payload)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("GitHub request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub returned {}: {}", status, body));
    }

    Ok(())
}

async fn send_servicenow(config: &Value, event_type: &str, payload: &Value) -> Result<(), String> {
    let base_url = config.get("base_url").and_then(|v| v.as_str()).ok_or("Missing ServiceNow base_url")?;
    let username = config.get("username").and_then(|v| v.as_str()).ok_or("Missing ServiceNow username")?;
    let password = config.get("password").and_then(|v| v.as_str()).ok_or("Missing ServiceNow password")?;
    let table = config.get("table").and_then(|v| v.as_str()).ok_or("Missing ServiceNow table")?;
    let short_description = config.get("short_description").and_then(|v| v.as_str()).unwrap_or("Security Issue");

    let target = payload.get("target").and_then(|v| v.as_str()).unwrap_or("N/A");
    let tool = payload.get("tool").and_then(|v| v.as_str()).unwrap_or("N/A");
    let status = payload.get("status").and_then(|v| v.as_str()).unwrap_or("unknown");
    let description = format!(
        "Event: {}\nTool: {}\nTarget: {}\nStatus: {}\n\nAutomated record created by CyberSec Pro integration.",
        event_type, tool, target, status
    );

    let record_payload = json!({
        "short_description": format!("{} - {}", short_description, target),
        "description": description,
        "u_event_source": "CyberSec Pro"
    });

    let client = Client::new();
    let resp = client
        .post(format!("{}/api/now/table/{}", base_url.trim_end_matches('/'), table))
        .basic_auth(username, password)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .json(&record_payload)
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("ServiceNow request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("ServiceNow returned {}: {}", status, body));
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

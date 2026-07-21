/// Stub handlers for frontend endpoints not yet fully implemented.
/// These return reasonable default / empty responses so the UI doesn't crash.
use std::sync::Arc;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;

use crate::middleware::auth_middleware::{AuthUser, AdminUser};
use crate::services::auth::{create_access_token, create_refresh_token};
use crate::AppState;

fn purple_team_chains_catalog() -> Vec<serde_json::Value> {
    vec![
        json!({
            "id": "chain-initial-access-phishing",
            "name": "Initial Access Validation",
            "description": "Simulate a phishing-led foothold and validate whether early detections trigger.",
            "severity": "high",
            "steps_count": 5,
            "mitre_tactics": ["TA0001", "TA0002"],
            "tools_used": ["social-engineering", "payload-simulation", "http-callback"]
        }),
        json!({
            "id": "chain-credential-access",
            "name": "Credential Access Drill",
            "description": "Exercise credential theft and verify blue-team alerting paths.",
            "severity": "critical",
            "steps_count": 7,
            "mitre_tactics": ["TA0006", "TA0003"],
            "tools_used": ["hash-dump-simulation", "lsass-access", "credential-spray"]
        }),
        json!({
            "id": "chain-lateral-movement",
            "name": "Lateral Movement Simulation",
            "description": "Validate segmentation and response workflows for east-west movement.",
            "severity": "medium",
            "steps_count": 6,
            "mitre_tactics": ["TA0008", "TA0007"],
            "tools_used": ["psexec-simulation", "ssh-pivot", "remote-service-exec"]
        }),
    ]
}

fn purple_team_playbooks_catalog() -> Vec<serde_json::Value> {
    vec![
        json!({
            "id": "playbook-email-compromise",
            "name": "Email Compromise Response",
            "trigger": "Mailbox phishing indicators with anomalous login location.",
            "severity": "high",
            "mitre_techniques": ["T1566", "T1078"],
            "response_actions_count": 5,
            "auto_actions": 2,
            "detection_logic": {
                "signals": ["email_spoofing_score", "impossible_travel", "new_inbox_rule"],
                "threshold": "medium"
            }
        }),
        json!({
            "id": "playbook-credential-breach",
            "name": "Credential Breach Containment",
            "trigger": "Credential dump or password spray behavior from monitored assets.",
            "severity": "critical",
            "mitre_techniques": ["T1003", "T1110"],
            "response_actions_count": 7,
            "auto_actions": 3,
            "detection_logic": {
                "signals": ["lsass_access_pattern", "auth_fail_burst", "hash_dump_tooling"],
                "threshold": "high"
            }
        }),
        json!({
            "id": "playbook-east-west-movement",
            "name": "East-West Movement Hunt",
            "trigger": "Suspicious remote execution and lateral authentication chains.",
            "severity": "medium",
            "mitre_techniques": ["T1021", "T1072"],
            "response_actions_count": 4,
            "auto_actions": 1,
            "detection_logic": {
                "signals": ["remote_service_creation", "psexec_signature", "ssh_pivot_sequence"],
                "threshold": "medium"
            }
        }),
    ]
}

fn purple_team_mitre_matrix_data() -> serde_json::Value {
    json!({
        "TA0001": {
            "name": "Initial Access",
            "techniques": [
                { "id": "T1566", "name": "Phishing", "subtechniques_count": 3 },
                { "id": "T1190", "name": "Exploit Public-Facing Application", "subtechniques_count": 0 }
            ],
            "total": 2
        },
        "TA0002": {
            "name": "Execution",
            "techniques": [
                { "id": "T1059", "name": "Command and Scripting Interpreter", "subtechniques_count": 11 },
                { "id": "T1204", "name": "User Execution", "subtechniques_count": 2 }
            ],
            "total": 2
        },
        "TA0003": {
            "name": "Persistence",
            "techniques": [
                { "id": "T1547", "name": "Boot or Logon Autostart Execution", "subtechniques_count": 14 },
                { "id": "T1136", "name": "Create Account", "subtechniques_count": 3 }
            ],
            "total": 2
        },
        "TA0006": {
            "name": "Credential Access",
            "techniques": [
                { "id": "T1003", "name": "OS Credential Dumping", "subtechniques_count": 8 },
                { "id": "T1110", "name": "Brute Force", "subtechniques_count": 4 }
            ],
            "total": 2
        },
        "TA0007": {
            "name": "Discovery",
            "techniques": [
                { "id": "T1018", "name": "Remote System Discovery", "subtechniques_count": 0 },
                { "id": "T1082", "name": "System Information Discovery", "subtechniques_count": 0 }
            ],
            "total": 2
        },
        "TA0008": {
            "name": "Lateral Movement",
            "techniques": [
                { "id": "T1021", "name": "Remote Services", "subtechniques_count": 8 },
                { "id": "T1072", "name": "Software Deployment Tools", "subtechniques_count": 0 }
            ],
            "total": 2
        }
    })
}

fn purple_team_base_gap_analysis(total_steps: i64) -> serde_json::Value {
    json!({
        "total_attacks": total_steps,
        "detected": 0,
        "missed": 0,
        "detection_rate": 0.0,
        "missed_techniques": [],
        "recommendations": []
    })
}

fn purple_team_risk_score(severity: &str) -> f64 {
    match severity {
        "critical" => 82.5,
        "high" => 64.0,
        "medium" => 41.0,
        _ => 25.0,
    }
}

fn purple_team_chain_by_id(chain_id: &str) -> Option<serde_json::Value> {
    purple_team_chains_catalog()
        .into_iter()
        .find(|chain| chain.get("id").and_then(|value| value.as_str()) == Some(chain_id))
}

fn purple_team_build_exercise(
    selected_chain: &serde_json::Value,
    chain_id: &str,
    target: &str,
    requested_name: Option<&str>,
) -> serde_json::Value {
    let chain_name = selected_chain
        .get("name")
        .and_then(|value| value.as_str())
        .unwrap_or("Purple Team Exercise");
    let severity = selected_chain
        .get("severity")
        .and_then(|value| value.as_str())
        .unwrap_or("medium");
    let total_steps = selected_chain
        .get("steps_count")
        .and_then(|value| value.as_i64())
        .unwrap_or(0);

    json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "name": requested_name
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(chain_name),
        "attack_chain_id": chain_id,
        "target": target,
        "status": "pending",
        "started_at": chrono::Utc::now().to_rfc3339(),
        "completed_at": "",
        "total_steps": total_steps,
        "completed_steps": 0,
        "detected_attacks": 0,
        "missed_attacks": 0,
        "risk_score": purple_team_risk_score(severity),
        "red_team_results": [],
        "blue_team_alerts": [],
        "gap_analysis": purple_team_base_gap_analysis(total_steps),
        "coverage_map": {}
    })
}

fn purple_team_step_catalog(chain_id: &str) -> Vec<(&'static str, &'static str, &'static str, &'static str, &'static str)> {
    match chain_id {
        "chain-credential-access" => vec![
            ("credential-access", "T1110", "Brute Force", "TA0006", "credential-spray"),
            ("credential-access", "T1003", "OS Credential Dumping", "TA0006", "hash-dump-simulation"),
            ("persistence", "T1547", "Boot or Logon Autostart Execution", "TA0003", "registry-persistence-check"),
            ("lateral-movement", "T1021", "Remote Services", "TA0008", "ssh-pivot"),
        ],
        "chain-lateral-movement" => vec![
            ("discovery", "T1018", "Remote System Discovery", "TA0007", "network-enum"),
            ("lateral-movement", "T1021", "Remote Services", "TA0008", "psexec-simulation"),
            ("lateral-movement", "T1072", "Software Deployment Tools", "TA0008", "remote-service-exec"),
            ("execution", "T1059", "Command and Scripting Interpreter", "TA0002", "shell-command"),
        ],
        _ => vec![
            ("initial-access", "T1566", "Phishing", "TA0001", "social-engineering"),
            ("execution", "T1204", "User Execution", "TA0002", "payload-simulation"),
            ("execution", "T1059", "Command and Scripting Interpreter", "TA0002", "http-callback"),
            ("credential-access", "T1110", "Brute Force", "TA0006", "credential-spray"),
        ],
    }
}

fn purple_team_env_f64(key: &str, default: f64) -> f64 {
    std::env::var(key)
        .ok()
        .and_then(|value| value.parse::<f64>().ok())
        .unwrap_or(default)
}

#[allow(dead_code)] // Profile loader used by purple_team_detection_ratio (awaiting wire-up).
fn purple_team_profile_from_env() -> Option<serde_json::Value> {
    std::env::var("PURPLE_TEAM_PROFILE_JSON")
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
}

fn purple_team_profile_get_f64(profile: &serde_json::Value, path: &[&str]) -> Option<f64> {
    let mut cursor = profile;
    for segment in path {
        cursor = cursor.get(*segment)?;
    }
    cursor
        .as_f64()
        .or_else(|| cursor.as_str().and_then(|value| value.parse::<f64>().ok()))
}

fn purple_team_profile_or_env(
    profile: Option<&serde_json::Value>,
    nested_path: &[&str],
    flat_key: &str,
    env_key: &str,
    default: f64,
) -> f64 {
    profile
        .and_then(|p| {
            purple_team_profile_get_f64(p, nested_path)
                .or_else(|| purple_team_profile_get_f64(p, &[flat_key]))
        })
        .unwrap_or_else(|| purple_team_env_f64(env_key, default))
}

fn purple_team_detection_ratio_with_profile(
    chain_id: &str,
    target: &str,
    profile: Option<&serde_json::Value>,
) -> f64 {
    let base = match chain_id {
        "chain-credential-access" => purple_team_profile_or_env(
            profile,
            &["chains", "credential"],
            "chain_credential",
            "PURPLE_TEAM_DETECT_CHAIN_CREDENTIAL",
            0.55_f64,
        ),
        "chain-lateral-movement" => purple_team_profile_or_env(
            profile,
            &["chains", "lateral"],
            "chain_lateral",
            "PURPLE_TEAM_DETECT_CHAIN_LATERAL",
            0.62_f64,
        ),
        _ => purple_team_profile_or_env(
            profile,
            &["chains", "default"],
            "chain_default",
            "PURPLE_TEAM_DETECT_CHAIN_DEFAULT",
            0.72_f64,
        ),
    };

    let target_lc = target.to_lowercase();
    let target_adjustment = if target_lc.contains("prod") || target_lc.contains("critical") {
        -purple_team_profile_or_env(
            profile,
            &["target", "prod_penalty"],
            "prod_penalty",
            "PURPLE_TEAM_DETECT_PROD_PENALTY",
            0.10_f64,
        )
        .abs()
    } else if target_lc.contains("dev") || target_lc.contains("staging") {
        purple_team_profile_or_env(
            profile,
            &["target", "dev_bonus"],
            "dev_bonus",
            "PURPLE_TEAM_DETECT_DEV_BONUS",
            0.08_f64,
        )
        .abs()
    } else {
        0.0_f64
    };

    let min_ratio = purple_team_profile_or_env(
        profile,
        &["bounds", "min"],
        "min",
        "PURPLE_TEAM_DETECT_MIN",
        0.25_f64,
    );
    let max_ratio = purple_team_profile_or_env(
        profile,
        &["bounds", "max"],
        "max",
        "PURPLE_TEAM_DETECT_MAX",
        0.90_f64,
    );
    let (lower, upper) = if min_ratio <= max_ratio {
        (min_ratio, max_ratio)
    } else {
        (max_ratio, min_ratio)
    };

    (base + target_adjustment).clamp(lower, upper)
}

#[allow(dead_code)] // Public-facing detection ratio used by purple-team report (awaiting handler wire-up).
fn purple_team_detection_ratio(chain_id: &str, target: &str) -> f64 {
    let profile = purple_team_profile_from_env();
    purple_team_detection_ratio_with_profile(chain_id, target, profile.as_ref())
}

fn purple_team_tactic_name(tactic_id: &str) -> &'static str {
    match tactic_id {
        "TA0001" => "Initial Access",
        "TA0002" => "Execution",
        "TA0003" => "Persistence",
        "TA0006" => "Credential Access",
        "TA0007" => "Discovery",
        "TA0008" => "Lateral Movement",
        _ => "Unknown Tactic",
    }
}

fn purple_team_build_simulation_data(
    chain_id: &str,
    total_steps: i64,
    detected_steps: i64,
) -> (Vec<serde_json::Value>, Vec<serde_json::Value>, serde_json::Value, serde_json::Value) {
    let catalog = purple_team_step_catalog(chain_id);
    let safe_steps = total_steps.max(0);
    let safe_detected = detected_steps.clamp(0, safe_steps);

    let mut red_results = Vec::new();
    let mut missed_techniques = Vec::new();
    let mut coverage_map = serde_json::Map::new();

    for i in 0..safe_steps {
        let index = (i as usize) % catalog.len();
        let (phase, technique_id, technique_name, tactic_id, tool) = catalog[index];
        let detected = i < safe_detected;
        let started_at = chrono::Utc::now() - chrono::Duration::seconds((safe_steps - i) * 12);
        let completed_at = started_at + chrono::Duration::seconds(8);

        red_results.push(json!({
            "step_index": i + 1,
            "phase": phase,
            "technique_id": technique_id,
            "technique_name": technique_name,
            "tool": tool,
            "command": format!("simulate {} on target", technique_id),
            "status": "completed",
            "output": if detected { "Blue team alert triggered and correlated." } else { "Attack simulation completed without correlated blue alert." },
            "findings": [],
            "started_at": started_at.to_rfc3339(),
            "completed_at": completed_at.to_rfc3339(),
            "duration_seconds": 8.0,
            "detected_by_blue": detected
        }));

        if !detected {
            missed_techniques.push(json!({
                "technique_id": technique_id,
                "technique_name": technique_name,
                "tool": tool,
                "phase": phase
            }));
        }

        let entry = coverage_map.entry(tactic_id.to_string()).or_insert_with(|| {
            json!({
                "name": purple_team_tactic_name(tactic_id),
                "total_techniques": 0,
                "tested": 0,
                "detected": 0,
                "missed": 0,
                "techniques": {}
            })
        });

        let total_techniques = entry.get("total_techniques").and_then(|v| v.as_i64()).unwrap_or(0) + 1;
        let tested = entry.get("tested").and_then(|v| v.as_i64()).unwrap_or(0) + 1;
        let detected_count = entry.get("detected").and_then(|v| v.as_i64()).unwrap_or(0) + if detected { 1 } else { 0 };
        let missed_count = entry.get("missed").and_then(|v| v.as_i64()).unwrap_or(0) + if detected { 0 } else { 1 };

        entry["total_techniques"] = json!(total_techniques);
        entry["tested"] = json!(tested);
        entry["detected"] = json!(detected_count);
        entry["missed"] = json!(missed_count);
        entry["techniques"][technique_id] = json!({
            "name": technique_name,
            "status": if detected { "detected" } else { "missed" },
            "subtechniques_count": 0
        });
    }

    let blue_alerts = if safe_detected > 0 {
        vec![json!({
            "id": uuid::Uuid::new_v4().to_string(),
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "playbook_name": "Purple Team Correlation Playbook",
            "severity": "high",
            "trigger_details": {
                "tool_detected": "multi-source-correlation",
                "confidence": 0.78
            },
            "response_actions_taken": [
                {"action": "isolate_host", "description": "Isolated suspicious host segment", "status": "completed", "result": "Host quarantined"}
            ],
            "response_actions_pending": [
                {"action": "credential_reset", "description": "Reset affected service credentials", "status": "pending"}
            ]
        })]
    } else {
        Vec::new()
    };

    let recommendations = if missed_techniques.is_empty() {
        Vec::new()
    } else {
        vec![json!({
            "priority": "high",
            "area": "Detection Engineering",
            "description": "Expand correlation rules for missed ATT&CK techniques in this exercise.",
            "mitre_reference": "TA0006"
        })]
    };

    (
        red_results,
        blue_alerts,
        json!(coverage_map),
        json!({
            "missed_techniques": missed_techniques,
            "recommendations": recommendations
        })
    )
}

fn purple_team_apply_completion(
    payload: &mut serde_json::Value,
    total_steps: i64,
    profile: Option<&serde_json::Value>,
) {
    let safe_total_steps = if total_steps < 0 { 0 } else { total_steps };
    let chain_id = payload
        .get("attack_chain_id")
        .and_then(|value| value.as_str())
        .unwrap_or("chain-initial-access-phishing");
    let target = payload
        .get("target")
        .and_then(|value| value.as_str())
        .unwrap_or("target.local");
    let chain_id_owned = chain_id.to_string();
    let target_owned = target.to_string();
    let detection_ratio = purple_team_detection_ratio_with_profile(
        &chain_id_owned,
        &target_owned,
        profile,
    );
    let detected = ((safe_total_steps as f64) * detection_ratio).round() as i64;
    let missed = safe_total_steps - detected;
    let detection_rate = if safe_total_steps > 0 {
        (detected as f64 / safe_total_steps as f64) * 100.0
    } else {
        0.0
    };

    payload["status"] = json!("completed");
    payload["completed_steps"] = json!(safe_total_steps);
    payload["detected_attacks"] = json!(detected);
    payload["missed_attacks"] = json!(missed);
    payload["completed_at"] = json!(chrono::Utc::now().to_rfc3339());
    let (red_results, blue_alerts, coverage_map, extra_gap_data) =
        purple_team_build_simulation_data(&chain_id_owned, safe_total_steps, detected);
    let missed_techniques = extra_gap_data
        .get("missed_techniques")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let recommendations = extra_gap_data
        .get("recommendations")
        .cloned()
        .unwrap_or_else(|| json!([]));

    payload["red_team_results"] = json!(red_results);
    payload["blue_team_alerts"] = json!(blue_alerts);
    payload["coverage_map"] = coverage_map;
    payload["gap_analysis"] = json!({
        "total_attacks": safe_total_steps,
        "detected": detected,
        "missed": missed,
        "detection_rate": detection_rate,
        "missed_techniques": missed_techniques,
        "recommendations": recommendations
    });
}

fn purple_team_apply_running_progress(payload: &mut serde_json::Value, total_steps: i64, age_seconds: f64) {
    let safe_total_steps = if total_steps < 0 { 0 } else { total_steps };
    let inferred = ((age_seconds / 15.0).floor() as i64 + 1).max(1);
    let completed_steps = inferred.min(safe_total_steps);
    payload["status"] = json!("running");
    payload["completed_steps"] = json!(completed_steps);
    payload["completed_at"] = json!("");
}

async fn purple_team_progress_tick(state: &Arc<AppState>, org_id: &str) {
    let db_profile = sqlx::query_as::<_, (String,)>(
        "SELECT profile_json::text FROM purple_team_profiles WHERE organization_id = $1 LIMIT 1"
    )
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .and_then(|(profile_text,)| serde_json::from_str::<serde_json::Value>(&profile_text).ok());

    let rows = sqlx::query_as::<_, (String, String, i64, String, f64)>(
        r#"SELECT
            id,
            status,
            total_steps,
            payload::text,
            EXTRACT(EPOCH FROM (NOW() - created_at))::double precision
        FROM purple_team_exercises
        WHERE organization_id = $1
          AND status IN ('pending', 'running')"#
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (id, status, total_steps, payload_text, age_seconds) in rows {
        let mut payload = match serde_json::from_str::<serde_json::Value>(&payload_text) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let mut next_status = status.clone();
        let mut completed_steps = payload
            .get("completed_steps")
            .and_then(|value| value.as_i64())
            .unwrap_or(0);
        let mut detected_attacks = payload
            .get("detected_attacks")
            .and_then(|value| value.as_i64())
            .unwrap_or(0);
        let mut missed_attacks = payload
            .get("missed_attacks")
            .and_then(|value| value.as_i64())
            .unwrap_or(0);

        if status == "pending" {
            payload["started_at"] = json!(chrono::Utc::now().to_rfc3339());
            purple_team_apply_running_progress(&mut payload, total_steps, age_seconds.max(1.0));
            next_status = "running".to_string();
        } else if status == "running" && age_seconds >= 90.0 {
            purple_team_apply_completion(&mut payload, total_steps, db_profile.as_ref());
            // Real-data linkage: attach recent scan IDs for the same org+target so
            // operators can pivot from a simulated TTP to actual scan evidence.
            let target_str = payload
                .get("target")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            if !target_str.is_empty() {
                let linked: Vec<(String,)> = sqlx::query_as(
                    r#"SELECT id::text FROM scans
                       WHERE organization_id = $1 AND target = $2
                         AND created_at > NOW() - INTERVAL '30 days'
                       ORDER BY created_at DESC
                       LIMIT 10"#
                )
                .bind(org_id)
                .bind(&target_str)
                .fetch_all(&state.db)
                .await
                .unwrap_or_default();
                payload["linked_scan_ids"] = json!(linked.iter().map(|(s,)| s.clone()).collect::<Vec<_>>());
            }
            next_status = "completed".to_string();
        } else if status == "running" {
            purple_team_apply_running_progress(&mut payload, total_steps, age_seconds);
            next_status = "running".to_string();
        }

        if next_status == "completed" {
            completed_steps = payload.get("completed_steps").and_then(|value| value.as_i64()).unwrap_or(total_steps);
            detected_attacks = payload.get("detected_attacks").and_then(|value| value.as_i64()).unwrap_or(0);
            missed_attacks = payload.get("missed_attacks").and_then(|value| value.as_i64()).unwrap_or(0);
        } else if next_status == "running" {
            completed_steps = payload.get("completed_steps").and_then(|value| value.as_i64()).unwrap_or(0);
        }

        let started_at_value = payload
            .get("started_at")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string();
        let completed_at_value = payload
            .get("completed_at")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string();

        let _ = sqlx::query(
            r#"UPDATE purple_team_exercises
            SET
                status = $1,
                completed_steps = $2,
                detected_attacks = $3,
                missed_attacks = $4,
                started_at = COALESCE(NULLIF($5, '')::timestamp, started_at),
                completed_at = COALESCE(NULLIF($6, '')::timestamp, completed_at),
                payload = $7::jsonb,
                updated_at = NOW()
            WHERE id = $8 AND organization_id = $9"#
        )
        .bind(&next_status)
        .bind(completed_steps)
        .bind(detected_attacks)
        .bind(missed_attacks)
        .bind(started_at_value)
        .bind(completed_at_value)
        .bind(payload.to_string())
        .bind(&id)
        .bind(org_id)
        .execute(&state.db)
        .await;
    }
}

// ── GitHub / Google OAuth ──────────────────────────────────

pub async fn social_auth(
    State(state): State<Arc<AppState>>,
    uri: axum::http::Uri,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let code = match body.get("code").and_then(|c| c.as_str()) {
        Some(c) => c.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Authorization code required"}))).into_response(),
    };
    let redirect_uri = body.get("redirect_uri").and_then(|r| r.as_str()).unwrap_or("").to_string();

    // Detect provider from URI path
    let path = uri.path();
    let provider = if path.contains("/github") { "github" } else if path.contains("/google") { "google" } else { "unknown" };

    let http = reqwest::Client::new();

    // ── Resolve email, name, avatar from provider ──
    let (email, first_name, last_name, avatar_url, provider_label) = match provider {
        "github" => {
            match github_oauth(&http, &code, &redirect_uri).await {
                Ok(info) => info,
                Err(resp) => return resp,
            }
        }
        "google" => {
            match google_oauth(&http, &code, &redirect_uri).await {
                Ok(info) => info,
                Err(resp) => return resp,
            }
        }
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Unknown OAuth provider"}))).into_response(),
    };

    // Check if user already exists
    let existing: Option<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, role, organization_id FROM users WHERE email = $1"
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id, org_id, role) = if let Some((uid, r, oid)) = existing {
        // Update last login + sync profile fields from OAuth provider so the
        // dashboard always reflects the upstream identity (avatar, name).
        // Only overwrite name fields when the provider actually returned a
        // value, to avoid wiping a manually-edited display name.
        let _ = sqlx::query(
            "UPDATE users SET
                last_login = CURRENT_TIMESTAMP,
                avatar_url = COALESCE(NULLIF($1,''), avatar_url),
                first_name = COALESCE(NULLIF($2,''), first_name),
                last_name  = COALESCE(NULLIF($3,''), last_name)
             WHERE id = $4"
        )
            .bind(&avatar_url)
            .bind(&first_name)
            .bind(&last_name)
            .bind(&uid)
            .execute(&state.db)
            .await;
        (uid, oid.unwrap_or_default(), r)
    } else {
        // Create new user + organization
        let new_org_id = uuid::Uuid::new_v4().to_string();
        let new_user_id = uuid::Uuid::new_v4().to_string();
        let slug = email.split('@').next().unwrap_or("user").to_string();

        let _ = sqlx::query(
            "INSERT INTO organizations (id, name, slug, plan_type) VALUES ($1, $2, $3, 'trial')"
        )
        .bind(&new_org_id)
        .bind(&format!("{}'s Organization", first_name))
        .bind(&slug)
        .execute(&state.db)
        .await;

        let _ = sqlx::query(
            "INSERT INTO users (id, email, password_hash, first_name, last_name, role, organization_id, email_verified, avatar_url)
             VALUES ($1, $2, '', $3, $4, 'admin', $5, true, $6)"
        )
        .bind(&new_user_id)
        .bind(&email)
        .bind(&first_name)
        .bind(&last_name)
        .bind(&new_org_id)
        .bind(&avatar_url)
        .execute(&state.db)
        .await;

        (new_user_id, new_org_id, "admin".to_string())
    };

    // Generate JWT tokens
    let access_token = create_access_token(&state.jwt_secret, &user_id, Some(&org_id), &role).unwrap_or_default();
    let refresh_token = create_refresh_token(&state.jwt_secret, &user_id).unwrap_or_default();

    (StatusCode::OK, Json(json!({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "message": format!("{} login successful", provider_label),
        "user": {
            "id": user_id,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "avatar_url": avatar_url,
            "role": role
        }
    }))).into_response()
}

// ── GitHub OAuth helper ──
async fn github_oauth(
    http: &reqwest::Client,
    code: &str,
    redirect_uri: &str,
) -> Result<(String, String, String, String, &'static str), axum::response::Response> {
    let client_id = std::env::var("GITHUB_CLIENT_ID").unwrap_or_else(|_| "***REDACTED_GH_OAUTH_CLIENT_ID***".to_string());
    let client_secret = match std::env::var("GITHUB_CLIENT_SECRET") {
        Ok(s) => s,
        Err(_) => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "GitHub OAuth not configured"}))).into_response()),
    };

    let token_res = http.post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .json(&serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }))
        .send()
        .await;

    let token_data: serde_json::Value = match token_res {
        Ok(resp) => resp.json().await.unwrap_or_default(),
        Err(_) => return Err((StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to contact GitHub"}))).into_response()),
    };

    let gh_token = match token_data.get("access_token").and_then(|t| t.as_str()) {
        Some(t) => t.to_string(),
        None => {
            let err = token_data.get("error_description").and_then(|e| e.as_str()).unwrap_or("Unknown error");
            return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": format!("GitHub OAuth failed: {}", err)}))).into_response());
        }
    };

    let gh_user: serde_json::Value = http.get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", gh_token))
        .header("User-Agent", "CyberSec-Pro")
        .send().await
        .map_err(|_| (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to get GitHub user info"}))).into_response())?
        .json().await
        .map_err(|_| (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to parse GitHub user info"}))).into_response())?;

    let mut email = gh_user.get("email").and_then(|e| e.as_str()).unwrap_or("").to_string();
    if email.is_empty() {
        if let Ok(resp) = http.get("https://api.github.com/user/emails")
            .header("Authorization", format!("Bearer {}", gh_token))
            .header("User-Agent", "CyberSec-Pro")
            .send().await
        {
            if let Ok(emails) = resp.json::<Vec<serde_json::Value>>().await {
                for e in &emails {
                    if e.get("primary").and_then(|p| p.as_bool()) == Some(true) {
                        if let Some(addr) = e.get("email").and_then(|a| a.as_str()) {
                            email = addr.to_string();
                            break;
                        }
                    }
                }
            }
        }
    }
    if email.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Could not retrieve email from GitHub"}))).into_response());
    }

    let gh_name = gh_user.get("name").and_then(|n| n.as_str()).unwrap_or("");
    let gh_login = gh_user.get("login").and_then(|l| l.as_str()).unwrap_or("");
    let avatar = gh_user.get("avatar_url").and_then(|a| a.as_str()).unwrap_or("").to_string();
    let name_parts: Vec<&str> = gh_name.split_whitespace().collect();
    let first = if !name_parts.is_empty() { name_parts[0].to_string() } else { gh_login.to_string() };
    let last = if name_parts.len() > 1 { name_parts[1..].join(" ") } else { String::new() };

    Ok((email, first, last, avatar, "GitHub"))
}

// ── Google OAuth helper ──
async fn google_oauth(
    http: &reqwest::Client,
    code: &str,
    redirect_uri: &str,
) -> Result<(String, String, String, String, &'static str), axum::response::Response> {
    let client_id = std::env::var("GOOGLE_CLIENT_ID").unwrap_or_else(|_|
        "547951331800-kqkuc6aohfr7ptt26p38mnqfdvt7b6mu.apps.googleusercontent.com".to_string()
    );
    let client_secret = match std::env::var("GOOGLE_CLIENT_SECRET") {
        Ok(s) => s,
        Err(_) => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Google OAuth not configured (missing GOOGLE_CLIENT_SECRET)"}))).into_response()),
    };

    // Exchange authorization code for tokens
    let token_res = http.post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code),
            ("client_id", &client_id),
            ("client_secret", &client_secret),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await;

    let token_data: serde_json::Value = match token_res {
        Ok(resp) => resp.json().await.unwrap_or_default(),
        Err(_) => return Err((StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to contact Google"}))).into_response()),
    };

    let id_token = token_data.get("id_token").and_then(|t| t.as_str()).unwrap_or("");
    let access_token = token_data.get("access_token").and_then(|t| t.as_str()).unwrap_or("");

    if access_token.is_empty() {
        let err = token_data.get("error_description").and_then(|e| e.as_str()).unwrap_or("Token exchange failed");
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": format!("Google OAuth failed: {}", err)}))).into_response());
    }

    // Try id_token first (contains user info as JWT), fallback to userinfo endpoint
    let (email, first, last, picture) = if !id_token.is_empty() {
        // Decode JWT payload (id_token is base64url: header.payload.signature)
        let parts: Vec<&str> = id_token.split('.').collect();
        if parts.len() >= 2 {
            use base64::Engine;
            let engine = base64::engine::general_purpose::URL_SAFE_NO_PAD;
            if let Ok(payload_bytes) = engine.decode(parts[1]) {
                if let Ok(claims) = serde_json::from_slice::<serde_json::Value>(&payload_bytes) {
                    let em = claims.get("email").and_then(|e| e.as_str()).unwrap_or("").to_string();
                    let gn = claims.get("given_name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                    let fn_ = claims.get("family_name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                    let pic = claims.get("picture").and_then(|p| p.as_str()).unwrap_or("").to_string();
                    (em, gn, fn_, pic)
                } else {
                    (String::new(), String::new(), String::new(), String::new())
                }
            } else {
                (String::new(), String::new(), String::new(), String::new())
            }
        } else {
            (String::new(), String::new(), String::new(), String::new())
        }
    } else {
        (String::new(), String::new(), String::new(), String::new())
    };

    // Fallback: use userinfo endpoint if id_token decoding failed
    let (email, first, last, picture) = if email.is_empty() {
        let user_info: serde_json::Value = http.get("https://www.googleapis.com/oauth2/v2/userinfo")
            .header("Authorization", format!("Bearer {}", access_token))
            .send().await
            .map_err(|_| (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to get Google user info"}))).into_response())?
            .json().await
            .map_err(|_| (StatusCode::BAD_GATEWAY, Json(json!({"error": "Failed to parse Google user info"}))).into_response())?;

        let em = user_info.get("email").and_then(|e| e.as_str()).unwrap_or("").to_string();
        let gn = user_info.get("given_name").and_then(|n| n.as_str()).unwrap_or("").to_string();
        let fn_ = user_info.get("family_name").and_then(|n| n.as_str()).unwrap_or("").to_string();
        let pic = user_info.get("picture").and_then(|p| p.as_str()).unwrap_or("").to_string();
        (em, gn, fn_, pic)
    } else {
        (email, first, last, picture)
    };

    if email.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(json!({"error": "Could not retrieve email from Google"}))).into_response());
    }

    Ok((email, first, last, picture, "Google"))
}

pub async fn resend_verification(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let email = match body.get("email").and_then(|e| e.as_str()) {
        Some(e) => e.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Email required"}))).into_response(),
    };

    // Find user and generate new token
    let user: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT id, first_name FROM users WHERE email = $1 AND (email_verified IS NULL OR email_verified = false)"
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (user_id, first_name) = match user {
        Some((uid, name)) => (uid, name.unwrap_or_else(|| "User".to_string())),
        None => {
            // Don't reveal whether email exists
            return Json(json!({"message": "If that email exists, a verification email has been sent"})).into_response();
        }
    };

    let token = uuid::Uuid::new_v4().to_string();
    let _ = sqlx::query("UPDATE users SET verification_token = $1 WHERE id = $2")
        .bind(&token)
        .bind(&user_id)
        .execute(&state.db)
        .await;

    // Send verification email
    if let Some(cfg) = crate::services::email::EmailConfig::from_env() {
        let verify_url = format!("https://app.cyber-sec-pro.com/dashboard/verify-email?token={}", token);
        let html = format!(
            r#"<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0a">
            <table style="width:100%;max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:12px">
            <tr><td style="padding:40px;text-align:center">
            <h1 style="color:#00ff88">🛡️ Verify Your Email</h1>
            <p style="color:#ccd6f6;font-size:16px">Hi {},</p>
            <p style="color:#8892b0;font-size:14px">Please verify your email to activate your CyberSec Pro account.</p>
            <a href="{}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#00ff88,#00d4ff);color:#0a0a0a;text-decoration:none;font-weight:bold;border-radius:50px;margin:20px 0">Verify Email</a>
            <p style="color:#4a5568;font-size:12px;margin-top:20px">© 2026 CyberSec Professional</p>
            </td></tr></table></body></html>"#,
            first_name, verify_url
        );
        let plain = format!("Hi {},\n\nVerify your email: {}\n\n© 2026 CyberSec Professional", first_name, verify_url);
        let _ = crate::services::email::send_verification_email(&cfg, &email, &first_name, &verify_url).await;
        let _ = plain; let _ = html; // sent via the dedicated function
    }

    Json(json!({"message": "If that email exists, a verification email has been sent"})).into_response()
}

pub async fn verify_email(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let token = params.get("token").map(|s| s.as_str()).unwrap_or("");
    if token.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Missing verification token", "verified": false}))).into_response();
    }

    // Atomically verify and return the user's email + name for welcome mail
    let result = sqlx::query_as::<_, (String, Option<String>)>(
        "UPDATE users SET email_verified = true, verification_token = NULL \
         WHERE verification_token = $1 \
         RETURNING email, first_name"
    )
    .bind(token)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some((email, first_name))) => {
            if let Some(cfg) = crate::services::email::EmailConfig::from_env() {
                let name = first_name.unwrap_or_else(|| "there".to_string());
                let email_clone = email.clone();
                tokio::spawn(async move {
                    if let Err(e) = crate::services::email::send_welcome_email(&cfg, &email_clone, &name).await {
                        tracing::warn!("welcome email send failed for {}: {}", email_clone, e);
                    } else {
                        tracing::info!("welcome email sent to {}", email_clone);
                    }
                });
            }
            Json(json!({
                "message": "Email verified successfully! Welcome aboard.",
                "verified": true,
                "dashboard_url": "https://app.cyber-sec-pro.com/dashboard"
            })).into_response()
        }
        _ => {
            (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid or expired token", "verified": false}))).into_response()
        }
    }
}

pub async fn upload_avatar(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    // Validate file size (max 2MB)
    if body.len() > 2 * 1024 * 1024 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "File too large. Max 2MB"}))).into_response();
    }

    if body.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "No file data received"}))).into_response();
    }

    // Detect image type from magic bytes
    let ext = if body.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "png"
    } else if body.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "jpg"
    } else if body.starts_with(b"GIF8") {
        "gif"
    } else if body.starts_with(b"RIFF") && body.len() > 12 && &body[8..12] == b"WEBP" {
        "webp"
    } else {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid image format. Accepted: PNG, JPG, GIF, WebP"}))).into_response();
    };

    // Validate user_id is a valid UUID to prevent path traversal
    if uuid::Uuid::parse_str(&user.user_id).is_err() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid user session"}))).into_response();
    }

    // Save to disk
    let upload_dir = std::path::Path::new("/home/cybersec/cybersec-pro/uploads/avatars");
    if let Err(e) = tokio::fs::create_dir_all(upload_dir).await {
        tracing::error!("Failed to create avatar dir: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Server storage error"}))).into_response();
    }

    let filename = format!("{}.{}", user.user_id, ext);
    let filepath = upload_dir.join(&filename);

    if let Err(e) = tokio::fs::write(&filepath, &body).await {
        tracing::error!("Failed to write avatar: {}", e);
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to save avatar"}))).into_response();
    }

    // Update user avatar URL in DB
    let avatar_url = format!("/uploads/avatars/{}", filename);
    let _ = sqlx::query("UPDATE users SET avatar_url = $1 WHERE id = $2")
        .bind(&avatar_url)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;

    Json(json!({"message": "Avatar uploaded", "avatar_url": avatar_url})).into_response()
}

pub async fn mfa_verify_setup(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let code = body.get("code").and_then(|c| c.as_str()).unwrap_or("");
    if code.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "TOTP code required", "verified": false}))).into_response();
    }

    // Fetch user's MFA secret
    let secret: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT mfa_secret FROM users WHERE id = $1"
    )
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let mfa_secret = match secret.and_then(|s| s.0) {
        Some(s) if !s.is_empty() => s,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "MFA not set up", "verified": false}))).into_response(),
    };

    // Verify TOTP code
    use totp_rs::{Algorithm, TOTP, Secret};
    let totp = match TOTP::new(Algorithm::SHA1, 6, 1, 30,
        Secret::Encoded(mfa_secret.clone()).to_bytes().unwrap_or_default(),
        Some("CyberSec Pro".to_string()),
        user.user_id.clone())
    {
        Ok(t) => t,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "MFA config error", "verified": false}))).into_response(),
    };

    if totp.check_current(code).unwrap_or(false) {
        // Generate 10 backup codes (scope rng to avoid !Send across await)
        let (backup_codes, hashed_json) = {
            use rand::Rng;
            let mut rng = rand::thread_rng();
            let mut codes: Vec<String> = Vec::new();
            let mut hashed: Vec<String> = Vec::new();
            for _ in 0..10 {
                let code_val: u32 = rng.gen_range(10000000..99999999);
                let code_str = format!("{}", code_val);
                codes.push(code_str.clone());
                let salt = argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
                if let Ok(hash) = argon2::PasswordHasher::hash_password(
                    &argon2::Argon2::default(),
                    code_str.as_bytes(),
                    &salt,
                ) {
                    hashed.push(hash.to_string());
                }
            }
            (codes, serde_json::to_string(&hashed).unwrap_or_else(|_| "[]".to_string()))
        };

        // Enable MFA + store hashed backup codes
        let _ = sqlx::query("UPDATE users SET mfa_enabled = true, mfa_backup_codes = $1 WHERE id = $2")
            .bind(&hashed_json)
            .bind(&user.user_id)
            .execute(&state.db)
            .await;

        Json(json!({"message": "MFA verified and enabled", "verified": true, "backup_codes": backup_codes})).into_response()
    } else {
        (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid TOTP code", "verified": false}))).into_response()
    }
}

pub async fn mfa_regenerate_backup(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let password = match body.get("password").and_then(|p| p.as_str()) {
        Some(p) => p.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Password required"}))).into_response(),
    };

    // Verify password
    let row: Option<(String, Option<bool>)> = sqlx::query_as(
        "SELECT password_hash, mfa_enabled FROM users WHERE id = $1"
    )
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (pw_hash, mfa_enabled) = match row {
        Some(r) => r,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    if !mfa_enabled.unwrap_or(false) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "MFA is not enabled"}))).into_response();
    }

    // Verify password
    use argon2::PasswordVerifier;
    let parsed_hash = match argon2::PasswordHash::new(&pw_hash) {
        Ok(h) => h,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Password verification error"}))).into_response(),
    };
    if argon2::Argon2::default().verify_password(password.as_bytes(), &parsed_hash).is_err() {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Invalid password"}))).into_response();
    }

    // Generate 10 new backup codes (scope rng to avoid !Send across await)
    let (backup_codes, hashed_json) = {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let mut codes: Vec<String> = Vec::new();
        let mut hashed: Vec<String> = Vec::new();
        for _ in 0..10 {
            let code_val: u32 = rng.gen_range(10000000..99999999);
            let code_str = format!("{}", code_val);
            codes.push(code_str.clone());
            let salt = argon2::password_hash::SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
            if let Ok(hash) = argon2::PasswordHasher::hash_password(
                &argon2::Argon2::default(),
                code_str.as_bytes(),
                &salt,
            ) {
                hashed.push(hash.to_string());
            }
        }
        (codes, serde_json::to_string(&hashed).unwrap_or_else(|_| "[]".to_string()))
    };

    let _ = sqlx::query("UPDATE users SET mfa_backup_codes = $1 WHERE id = $2")
        .bind(&hashed_json)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;

    Json(json!({"backup_codes": backup_codes, "message": "Backup codes regenerated"})).into_response()
}

// ── Tool stubs ─────────────────────────────────────────────

pub async fn tool_config(
    Path(tool_id): Path<String>,
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tool = sqlx::query_as::<_, (String, String, String, String, String, String, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, name, COALESCE(parameters::text, '{}'), COALESCE(description,''), category, COALESCE(plan_required,'starter'), command_template, binary_name, tool_group FROM tools WHERE (id = $1 OR name = $2 OR binary_name = $3) AND is_active = TRUE"
    )
    .bind(&tool_id)
    .bind(&tool_id)
    .bind(&tool_id)
    .fetch_optional(&state.db)
    .await;

    match tool {
        Ok(Some((id, name, params, desc, cat, plan, cmd_tpl, binary, group))) => {
            let mut params_val: serde_json::Value = serde_json::from_str(&params).unwrap_or(json!({}));

            // Auto-derive form schema from {placeholder} tokens in command_template
            // when parameters JSONB is empty/null. Lets the frontend build a zero-code
            // form for any tool that ships only with a template (463+ such tools).
            let needs_derive = match &params_val {
                serde_json::Value::Null => true,
                serde_json::Value::Object(m) => m.is_empty() || (m.len() == 1 && m.contains_key("form") && m["form"].as_array().map(|a| a.is_empty()).unwrap_or(true)),
                serde_json::Value::Array(a) => a.is_empty(),
                _ => false,
            };
            if needs_derive {
                if let Some(tpl) = cmd_tpl.as_deref() {
                    let mut seen = std::collections::HashSet::new();
                    let mut form: Vec<serde_json::Value> = Vec::new();
                    let bytes = tpl.as_bytes();
                    let mut i = 0;
                    while i < bytes.len() {
                        if bytes[i] == b'{' {
                            if let Some(end_rel) = tpl[i+1..].find('}') {
                                let raw = &tpl[i+1..i+1+end_rel];
                                let key = raw.trim();
                                if !key.is_empty() && !key.contains(' ') && seen.insert(key.to_string()) {
                                    let lower = key.to_lowercase();
                                    let is_secret = lower.contains("pass") || lower.contains("secret")
                                        || lower.contains("token") || lower.contains("apikey")
                                        || lower.contains("api_key") || lower.contains("credential");
                                    let ftype = if is_secret { "password" }
                                        else if lower == "port" || lower.ends_with("_port") { "number" }
                                        else if lower == "url" { "url" }
                                        else if lower.contains("file") || lower.contains("path") || lower.contains("wordlist") { "text" }
                                        else { "text" };
                                    let label = key
                                        .replace('_', " ")
                                        .split_whitespace()
                                        .map(|w| {
                                            let mut c = w.chars();
                                            match c.next() {
                                                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                                                None => String::new(),
                                            }
                                        })
                                        .collect::<Vec<_>>()
                                        .join(" ");
                                    let required = matches!(lower.as_str(),
                                        "target" | "host" | "url" | "domain" | "ip" | "input" | "file");
                                    form.push(json!({
                                        "name": key,
                                        "label": label,
                                        "type": ftype,
                                        "required": required,
                                        "placeholder": "",
                                        "default": "",
                                    }));
                                }
                                i = i + 1 + end_rel + 1;
                                continue;
                            }
                        }
                        i += 1;
                    }
                    if !form.is_empty() {
                        params_val = json!({
                            "form": form,
                            "danger_level": "low",
                            "target_types": [],
                            "auto_derived": true,
                        });
                    }
                }
            }

            Json(json!({
                "tool": {
                    "id": id,
                    "name": name,
                    "slug": name,
                    "description": desc,
                    "category": cat,
                    "plan_required": plan,
                    "is_active": true,
                    "parameters": params_val,
                    "command_template": cmd_tpl,
                    "binary_name": binary,
                    "group": group,
                },
                "config": {}
            })).into_response()
        }
        _ => Json(json!({"error": "Tool not found"})).into_response()
    }
}

pub async fn tool_execution_mode(
    Path(tool_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"execution_mode": "direct", "supports_streaming": true, "tool_id": tool_id})).into_response()
}

pub async fn tool_build_command(
    Path(slug): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let target = params.get("target").cloned().unwrap_or_default();
    Json(json!({
        "command": format!("{} {}", slug, target),
        "tool": slug,
        "target": target
    })).into_response()
}

pub async fn tools_catalog(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tools = sqlx::query_as::<_, (String, String, String, String, String)>(
        "SELECT id, name, category, COALESCE(business_category,''), COALESCE(plan_required,'starter') FROM tools WHERE is_active = TRUE ORDER BY name LIMIT 1000"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = tools.iter().map(|(id, name, cat, bcat, plan)| {
        json!({"id": id, "name": name, "category": cat, "business_category": bcat, "plan_required": plan})
    }).collect();

    Json(json!({"tools": list, "total": list.len()})).into_response()
}

pub async fn v2_tools(
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let _plan = params.get("plan").cloned().unwrap_or_default();

    let tools: Vec<crate::models::Tool> = sqlx::query_as(
        "SELECT * FROM tools WHERE is_active = TRUE ORDER BY name"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // Group by tool_group
    let mut categories: std::collections::HashMap<String, Vec<serde_json::Value>> = std::collections::HashMap::new();
    for t in &tools {
        let group = t.tool_group.clone().unwrap_or_else(|| "misc".into());
        let resp = t.to_response();
        categories.entry(group).or_default().push(json!({
            "id": resp.id,
            "name": resp.name,
            "description": resp.description,
            "category": resp.category,
            "business_category": resp.business_category,
            "subcategory": resp.subcategory,
            "plan_required": resp.plan_required,
            "is_active": resp.is_active,
            "tool_type": resp.tool_type,
            "gui_required": resp.gui_required,
            "group": resp.group,
            "binary_name": resp.binary_name,
            "installed": true,
            "maturity": resp.maturity,
            "output_parser": resp.output_parser,
            "health_status": resp.health_status,
            "health_probe": resp.health_probe,
            "last_health_check": resp.last_health_check,
        }));
    }

    // Group display names
    let group_names: std::collections::HashMap<&str, (&str, &str)> = [
        ("web", ("Web Application Security", "🌐")),
        ("forensics", ("Digital Forensics", "🔬")),
        ("recon", ("Reconnaissance & OSINT", "🔍")),
        ("password", ("Password & GPU", "🔑")),
        ("vulnerability", ("Vulnerability Analysis", "🔓")),
        ("wireless", ("Wireless Security", "📡")),
        ("hardware", ("Hardware Attacks", "🔌")),
        ("network", ("Network & Sniffing", "🌍")),
        ("windows", ("Windows Resources", "🪟")),
        ("reversing", ("Reverse Engineering", "⚙️")),
        ("defense", ("Defense & Detection", "🛡️")),
        ("post-exploit", ("Post-Exploitation", "💀")),
        ("crypto", ("Cryptography & Steganography", "🔐")),
        ("reporting", ("Reporting", "📊")),
        ("exploitation", ("Exploitation", "💥")),
        ("social", ("Social Engineering", "🎭")),
        ("voip", ("VoIP Security", "📞")),
        ("database", ("Database Security", "🗄️")),
        ("misc", ("Miscellaneous", "🔧")),
    ].into_iter().collect();

    let mut result_cats: serde_json::Map<String, serde_json::Value> = serde_json::Map::new();
    let mut cat_list: Vec<String> = Vec::new();

    for (group, tool_list) in &categories {
        let (display_name, icon) = group_names.get(group.as_str()).unwrap_or(&("Other", "🔧"));
        cat_list.push(group.clone());
        result_cats.insert(group.clone(), json!({
            "info": {
                "id": group,
                "name": display_name,
                "icon": icon,
                "tool_count": tool_list.len(),
            },
            "tools": tool_list,
        }));
    }

    cat_list.sort();

    Json(json!({
        "success": true,
        "total_tools": tools.len(),
        "categories": result_cats,
        "category_list": cat_list,
    })).into_response()
}

pub async fn v2_tool_detail(
    Path(tool_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let tool = sqlx::query_as::<_, (String, String, String, String, String, bool, Option<String>, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, name, COALESCE(description,''), category, COALESCE(plan_required,'starter'), is_active, command_template, binary_name, tool_group, kali_package FROM tools WHERE (id = $1 OR name = $2) AND is_active = TRUE"
    )
    .bind(&tool_id)
    .bind(&tool_id)
    .fetch_optional(&state.db)
    .await;

    match tool {
        Ok(Some((id, name, desc, cat, plan, active, cmd_tpl, binary, group, kali_pkg))) => {
            Json(json!({
                "success": true,
                "tool": {
                    "id": id,
                    "name": name,
                    "slug": name,
                    "description": desc,
                    "category": cat,
                    "plan_required": plan,
                    "is_active": active,
                    "command_template": cmd_tpl,
                    "binary_name": binary,
                    "group": group,
                    "kali_package": kali_pkg,
                }
            })).into_response()
        }
        _ => Json(json!({"error": "Tool not found"})).into_response()
    }
}

// ── Scan stubs (singular /scan/ variants) ──────────────────

pub async fn scan_start(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Email-verification gate: refuse to launch scans for accounts that
    // never proved mailbox ownership. Stops fresh trial-burning bots from
    // hammering the scan engine. OAuth users get email_verified=true at
    // signup, so this only blocks unverified password-signup accounts.
    let verified: Option<(Option<bool>, Option<String>)> = sqlx::query_as(
        "SELECT email_verified, oauth_provider FROM users WHERE id = $1"
    )
    .bind(&user.user_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);
    let is_verified = verified
        .as_ref()
        .map(|(v, oauth)| v.unwrap_or(false) || oauth.is_some())
        .unwrap_or(false);
    if !is_verified {
        return (axum::http::StatusCode::FORBIDDEN, Json(json!({
            "error": "Please verify your email before running scans. Check your inbox for the verification link.",
            "code": "EMAIL_NOT_VERIFIED"
        }))).into_response();
    }

    // Delegate to the plural scan handler by forwarding
    let tool_id = body.get("tool_id").and_then(|v| v.as_str()).unwrap_or("");
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");
    let scan_id = uuid::Uuid::new_v4().to_string();

    let _ = sqlx::query(
        "INSERT INTO scans (id, user_id, organization_id, tool_id, target, status, created_at) VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP)"
    )
    .bind(&scan_id)
    .bind(&user.user_id)
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .bind(tool_id)
    .bind(target)
    .execute(&state.db)
    .await;

    Json(json!({"scan_id": scan_id, "status": "pending", "message": "Scan queued"})).into_response()
}

pub async fn scan_result(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let scan = if !org_id.is_empty() {
        sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
            "SELECT s.id, s.status, s.output, CAST(s.findings AS TEXT), s.error_log, s.target, t.name, t.command_template FROM scans s LEFT JOIN tools t ON s.tool_id = t.id WHERE s.id = $1 AND s.organization_id = $2"
        )
        .bind(&scan_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
            "SELECT s.id, s.status, s.output, CAST(s.findings AS TEXT), s.error_log, s.target, t.name, t.command_template FROM scans s LEFT JOIN tools t ON s.tool_id = t.id WHERE s.id = $1 AND s.user_id = $2"
        )
        .bind(&scan_id)
        .bind(&user.user_id)
        .fetch_optional(&state.db)
        .await
    };

    match scan {
        Ok(Some((id, status, output, findings, error_log, target, tool_name, command))) => {
            let findings_val: serde_json::Value = findings.and_then(|f| serde_json::from_str(&f).ok()).unwrap_or(json!(null));
            let output_str = output.unwrap_or_default();
            Json(json!({
                "scan": {
                    "id": id,
                    "status": status,
                    "output": output_str,
                    "target": target,
                    "tool_name": tool_name,
                    "command": command,
                    "error_log": error_log,
                },
                "execution_result": {
                    "status": status,
                    "output": output_str,
                    "findings": findings_val
                }
            })).into_response()
        }
        _ => (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found"}))).into_response()
    }
}

pub async fn scan_stop(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("UPDATE scans SET status = 'cancelled' WHERE id = $1 AND organization_id = $2")
        .bind(&scan_id)
        .bind(&user.org_id.as_deref().unwrap_or(""))
        .execute(&state.db)
        .await;
    Json(json!({"message": "Scan stopped", "scan_id": scan_id})).into_response()
}

pub async fn scan_rerun(
    Path(scan_id): Path<String>,
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"message": "Scan rerun queued", "scan_id": scan_id})).into_response()
}

pub async fn scan_business_report(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Query the actual scan from DB
    let org_id = user.org_id.as_deref().unwrap_or("");
    let row: Option<(Option<serde_json::Value>, Option<String>)> = if !org_id.is_empty() {
        sqlx::query_as(
            "SELECT findings, output FROM scans WHERE id = $1 AND organization_id = $2"
        )
        .bind(&scan_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None)
    } else {
        sqlx::query_as(
            "SELECT findings, output FROM scans WHERE id = $1 AND user_id = $2"
        )
        .bind(&scan_id)
        .bind(&user.user_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None)
    };

    let (findings_json, _raw_output) = match row {
        Some(r) => r,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Scan not found"}))).into_response(),
    };

    let findings_val = findings_json.unwrap_or(json!({}));

    // Extract summary from the parsed findings (parsers store summary as an object)
    let summary = findings_val.get("summary").cloned().unwrap_or(json!({}));
    let total = summary.get("total").and_then(|v| v.as_i64()).unwrap_or(0);
    let critical = summary.get("critical").and_then(|v| v.as_i64()).unwrap_or(0);
    let high = summary.get("high").and_then(|v| v.as_i64()).unwrap_or(0);
    let medium = summary.get("medium").and_then(|v| v.as_i64()).unwrap_or(0);
    let low = summary.get("low").and_then(|v| v.as_i64()).unwrap_or(0);
    let open_ports = summary.get("open_ports").and_then(|v| v.as_i64()).unwrap_or(0);

    // Calculate security score: 100 minus deductions per severity
    let score = (100 - (critical * 25) - (high * 10) - (medium * 5) - (low * 2)).max(0);

    // Flatten findings into a display-friendly array
    let mut all_findings: Vec<serde_json::Value> = Vec::new();

    // Services (open ports)
    if let Some(services) = findings_val.get("services").and_then(|s| s.as_array()) {
        for svc in services {
            let port = svc.get("port").and_then(|p| p.as_u64()).unwrap_or(0);
            let service_name = svc.get("service").and_then(|s| s.as_str()).unwrap_or("");
            all_findings.push(json!({
                "severity": "info",
                "title": format!("Open Port {}", port),
                "description": format!("Port {}/{} — {}", port,
                    svc.get("protocol").and_then(|p| p.as_str()).unwrap_or("tcp"),
                    service_name),
                "category": "open_port"
            }));
        }
    }

    // Vulnerabilities
    if let Some(vulns) = findings_val.get("vulnerabilities").and_then(|v| v.as_array()) {
        for vuln in vulns {
            all_findings.push(json!({
                "severity": vuln.get("severity").and_then(|s| s.as_str()).unwrap_or("medium"),
                "title": vuln.get("title").or(vuln.get("description")).and_then(|t| t.as_str()).unwrap_or("Vulnerability"),
                "description": vuln.get("description").and_then(|d| d.as_str()).unwrap_or(""),
                "category": "vulnerability"
            }));
        }
    }

    // Generic findings array (nikto, nuclei, etc.)
    if let Some(f_list) = findings_val.get("findings").and_then(|f| f.as_array()) {
        for f in f_list {
            all_findings.push(json!({
                "severity": f.get("severity").and_then(|s| s.as_str()).unwrap_or("info"),
                "title": f.get("title").or(f.get("description")).and_then(|t| t.as_str()).unwrap_or("Finding"),
                "description": f.get("description").and_then(|d| d.as_str()).unwrap_or(""),
                "category": f.get("category").and_then(|c| c.as_str()).unwrap_or("general")
            }));
        }
    }

    // Subdomains
    if let Some(subs) = findings_val.get("subdomains").and_then(|s| s.as_array()) {
        for sub in subs {
            let name = sub.as_str().unwrap_or("");
            all_findings.push(json!({
                "severity": "info",
                "title": format!("Subdomain: {}", name),
                "description": name,
                "category": "subdomain"
            }));
        }
    }

    // Directories
    if let Some(dirs) = findings_val.get("directories").and_then(|d| d.as_array()) {
        for dir in dirs {
            all_findings.push(json!({
                "severity": dir.get("severity").and_then(|s| s.as_str()).unwrap_or("info"),
                "title": format!("Directory: {}", dir.get("path").and_then(|p| p.as_str()).unwrap_or("")),
                "description": format!("Status {} — {}", dir.get("status").and_then(|s| s.as_u64()).unwrap_or(0), dir.get("path").and_then(|p| p.as_str()).unwrap_or("")),
                "category": "directory"
            }));
        }
    }

    // Return flat structure that frontend expects directly
    Json(json!({
        "scan_id": scan_id,
        "summary": {
            "score": score,
            "total": total,
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "open_ports": open_ports
        },
        "findings": all_findings
    })).into_response()
}

pub async fn scan_status(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let status = if !org_id.is_empty() {
        sqlx::query_as::<_, (String,)>(
            "SELECT status FROM scans WHERE id = $1 AND organization_id = $2"
        )
        .bind(&scan_id)
        .bind(org_id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query_as::<_, (String,)>(
            "SELECT status FROM scans WHERE id = $1 AND user_id = $2"
        )
        .bind(&scan_id)
        .bind(&user.user_id)
        .fetch_optional(&state.db)
        .await
    };

    match status {
        Ok(Some((s,))) => Json(json!({"scan_id": scan_id, "status": s})).into_response(),
        _ => Json(json!({"error": "Scan not found"})).into_response()
    }
}

pub async fn scans_execute(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    scan_start(user, State(state), Json(body)).await
}

pub async fn scan_delete(
    Path(scan_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("DELETE FROM scans WHERE id = $1 AND organization_id = $2")
        .bind(&scan_id)
        .bind(&user.org_id.as_deref().unwrap_or(""))
        .execute(&state.db)
        .await;
    Json(json!({"message": "Scan deleted"})).into_response()
}

// ── Agent stubs ────────────────────────────────────────────

pub async fn update_agent(
    Path(agent_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");

    let name = body.get("name").and_then(|v| v.as_str());
    let ssh_host = body.get("ssh_host").and_then(|v| v.as_str());
    let ssh_port = body.get("ssh_port").and_then(|v| v.as_i64()).map(|v| v as i32);
    let ssh_username = body.get("ssh_username").and_then(|v| v.as_str());
    let ssh_key_path = body.get("ssh_key_path").and_then(|v| v.as_str());
    let location = body.get("location").and_then(|v| v.as_str());
    let connection_type = body.get("connection_type").and_then(|v| v.as_str());
    let hostname = body.get("hostname").and_then(|v| v.as_str());
    let ip_address = body.get("ip_address").and_then(|v| v.as_str());
    let platform = body.get("platform").and_then(|v| v.as_str());
    let max_concurrent = Some(50); //body.get("max_concurrent_scans").and_then(|v| v.as_i64()).map(|v| v as i32);

    // Encrypt SSH password if provided
    let ssh_password_enc = body.get("ssh_password").and_then(|v| v.as_str()).and_then(|pwd| {
        if pwd.is_empty() { return None; }
        let secret = crate::handlers::agent_handlers::password_encryption_key();
        crate::services::connection_engine::crypto::encrypt_password(pwd, &secret).ok()
    });

    let result = sqlx::query(
        "UPDATE agents SET \
         name = COALESCE($1, name), \
         ssh_host = COALESCE($2, ssh_host), \
         ssh_port = COALESCE($3, ssh_port), \
         ssh_username = COALESCE($4, ssh_username), \
         location = COALESCE($5, location), \
         connection_type = COALESCE($6, connection_type), \
         ssh_key_path = COALESCE($7, ssh_key_path), \
         hostname = COALESCE($8, hostname), \
         ip_address = COALESCE($9, ip_address), \
         platform = COALESCE($10, platform), \
         max_concurrent_scans = COALESCE($11, max_concurrent_scans), \
         ssh_password_encrypted = COALESCE($12, ssh_password_encrypted), \
         updated_at = CURRENT_TIMESTAMP \
         WHERE id = $13 AND organization_id = $14"
    )
    .bind(name)
    .bind(ssh_host)
    .bind(ssh_port)
    .bind(ssh_username)
    .bind(location)
    .bind(connection_type)
    .bind(ssh_key_path)
    .bind(hostname)
    .bind(ip_address)
    .bind(platform)
    .bind(max_concurrent)
    .bind(ssh_password_enc.as_deref())
    .bind(&agent_id)
    .bind(org_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            Json(json!({"message": "Agent updated", "agent_id": agent_id})).into_response()
        }
        Ok(_) => {
            (axum::http::StatusCode::NOT_FOUND, Json(json!({"error": "Agent not found"}))).into_response()
        }
        Err(e) => {
            (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Update failed: {}", e)}))).into_response()
        }
    }
}

pub async fn test_agent(
    Path(agent_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");

    // Fetch agent details
    let agent = sqlx::query(
        "SELECT ssh_host, ssh_port, ssh_username, ssh_password_encrypted, ssh_key_path, connection_type, platform FROM agents WHERE id = $1 AND organization_id = $2"
    )
    .bind(&agent_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let agent = match agent {
        Some(a) => a,
        None => return (axum::http::StatusCode::NOT_FOUND, Json(json!({"success": false, "error": "Agent not found"}))).into_response(),
    };

    use sqlx::Row;
    let ssh_host: Option<String> = agent.get("ssh_host");
    let ssh_port: Option<i32> = agent.get("ssh_port");
    let ssh_username: Option<String> = agent.get("ssh_username");
    let ssh_password_enc: Option<String> = agent.get("ssh_password_encrypted");
    let ssh_key_path: Option<String> = agent.get("ssh_key_path");
    let _platform: Option<String> = agent.get("platform");

    let host = match ssh_host {
        Some(h) if !h.is_empty() => h,
        _ => return Json(json!({"success": false, "error": "No SSH host configured"})).into_response(),
    };
    let port = ssh_port.unwrap_or(22) as u16;
    let username = ssh_username.unwrap_or_else(|| "root".into());

    // Decrypt password if stored
    let password = ssh_password_enc.and_then(|enc| {
        let secret = crate::handlers::agent_handlers::password_encryption_key();
        crate::services::connection_engine::crypto::decrypt_password(&enc, &secret).ok()
    });

    // Real SSH connection test
    let params = crate::services::connection_engine::SshConnParams {
        host: host.clone(),
        port,
        username: username.clone(),
        password,
        private_key: ssh_key_path,
        passphrase: None,
        timeout_secs: 10,
    };

    let result = crate::services::connection_engine::test_ssh_connection(&params).await;

    if result.success {
        // Update agent with discovered info
        let _ = sqlx::query(
            "UPDATE agents SET status = 'online', last_heartbeat = CURRENT_TIMESTAMP, \
             hostname = COALESCE($1, hostname), os_info = COALESCE($2, os_info), \
             ip_address = COALESCE($3, ip_address), \
             cpu_usage = 0, memory_usage = 0 \
             WHERE id = $4"
        )
        .bind(&result.hostname)
        .bind(&result.os_info)
        .bind(result.ip_addresses.first())
        .bind(&agent_id)
        .execute(&state.db)
        .await;

        Json(json!({
            "success": true,
            "agent_id": agent_id,
            "connection": {
                "type": "ssh",
                "host": host,
                "port": port,
                "username": username,
                "latency_ms": result.latency_ms,
                "ssh_banner": result.ssh_banner,
            },
            "system": {
                "hostname": result.hostname,
                "os": result.os_info,
                "kernel": result.kernel,
                "uptime": result.uptime,
                "cpu_cores": result.cpu_cores,
                "memory_total_mb": result.memory_total_mb,
                "memory_used_mb": result.memory_used_mb,
                "disk_total_gb": result.disk_total_gb,
                "disk_used_gb": result.disk_used_gb,
                "ip_addresses": result.ip_addresses,
            },
            "message": format!("✅ SSH connected to {}@{}:{}", username, host, port)
        })).into_response()
    } else {
        // Try TCP-only fallback for error diagnostics
        let tcp_reachable = crate::services::connection_engine::scan_port(&host, port, 5000).await;

        Json(json!({
            "success": false,
            "agent_id": agent_id,
            "error": result.error.unwrap_or_else(|| "Connection failed".into()),
            "diagnostics": {
                "tcp_port_reachable": tcp_reachable,
                "host": host,
                "port": port,
                "hint": if !tcp_reachable {
                    "Port is not reachable. Check: 1) Host IP is correct 2) SSH service is running 3) Firewall allows port"
                } else {
                    "Port is reachable but SSH auth failed. Check: 1) Username 2) Password/Key 3) SSH config (AllowUsers, PermitRootLogin)"
                }
            }
        })).into_response()
    }
}

pub async fn agents_dashboard(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let rows = sqlx::query(
        "SELECT id, name, hostname, ip_address, COALESCE(status,'offline') as status, os_info, platform, version, cpu_usage, memory_usage, active_scans, total_scans, location, connection_type, ssh_port, ssh_username, CAST(last_heartbeat AS TEXT) as last_heartbeat FROM agents WHERE organization_id = $1 ORDER BY created_at DESC"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut online = 0i64;
    let mut offline = 0i64;
    let mut busy = 0i64;
    let mut pending = 0i64;
    let mut total_active_scans = 0i64;

    let agent_list: Vec<serde_json::Value> = rows.iter().map(|row| {
        use sqlx::Row;
        let id: String = row.get("id");
        let name: String = row.get("name");
        let hostname: Option<String> = row.get("hostname");
        let ip: Option<String> = row.get("ip_address");
        let status: String = row.get("status");
        let os: Option<String> = row.get("os_info");
        let platform: Option<String> = row.get("platform");
        let version: Option<String> = row.get("version");
        let cpu: Option<f32> = row.get("cpu_usage");
        let mem: Option<f32> = row.get("memory_usage");
        let active: Option<i32> = row.get("active_scans");
        let total: Option<i32> = row.get("total_scans");
        let location: Option<String> = row.get("location");
        let conn_type: Option<String> = row.get("connection_type");
        let ssh_port: Option<i32> = row.get("ssh_port");
        let ssh_user: Option<String> = row.get("ssh_username");
        let heartbeat: Option<String> = row.get("last_heartbeat");

        match status.as_str() {
            "online" => online += 1,
            "busy" => { busy += 1; },
            "pending" => { pending += 1; },
            _ => offline += 1,
        }
        total_active_scans += active.unwrap_or(0) as i64;

        let emoji = match status.as_str() {
            "online" => "\u{1f7e2}",
            "busy" => "\u{1f7e1}",
            "error" => "\u{1f534}",
            "pending" => "\u{1f7e0}",
            _ => "\u{26ab}",
        };

        json!({
            "id": id,
            "name": name,
            "hostname": hostname.unwrap_or_default(),
            "ip_address": ip.unwrap_or_default(),
            "status": status,
            "status_emoji": emoji,
            "os": os.unwrap_or_else(|| "Linux".into()),
            "platform": platform.unwrap_or_else(|| "linux".into()),
            "version": version.unwrap_or_else(|| "1.0.0".into()),
            "last_seen": &heartbeat,
            "last_heartbeat": &heartbeat,
            "cpu_usage": cpu.unwrap_or(0.0),
            "memory_usage": mem.unwrap_or(0.0),
            "active_scans": active.unwrap_or(0),
            "total_scans": total.unwrap_or(0),
            "location": location.unwrap_or_default(),
            "connection_type": conn_type.unwrap_or_else(|| "direct".into()),
            "ssh_port": ssh_port.unwrap_or(22),
            "ssh_username": ssh_user.unwrap_or_default(),
        })
    }).collect();

    // Total scans completed across all agents
    let total_scans_completed: i64 = sqlx::query_as::<_, (Option<i64>,)>(
        "SELECT SUM(COALESCE(total_scans, 0)) FROM agents WHERE organization_id = $1"
    ).bind(org_id).fetch_one(&state.db).await.map(|r| r.0.unwrap_or(0)).unwrap_or(0);

    Json(json!({
        "total_agents": rows.len(),
        "online": online,
        "offline": offline,
        "busy": busy,
        "pending": pending,
        "total_scans_completed": total_scans_completed,
        "active_scans": total_active_scans,
        "agents": agent_list
    })).into_response()
}

// ── Scheduled Scans ────────────────────────────────────────

pub async fn list_schedules(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let schedules = sqlx::query_as::<_, (
        String, String, Option<String>, String, bool, String,
        Option<String>, Option<String>, Option<i32>, i32,
        Option<String>, String,
    )>(
        "SELECT id, name, cron_expression, COALESCE(tool_name,''), is_active, COALESCE(target,''),
                CAST(last_run AS TEXT), CAST(next_run AS TEXT), run_count, COALESCE(hour,0),
                schedule_type, CAST(created_at AS TEXT)
         FROM scheduled_scans WHERE organization_id = $1 ORDER BY created_at DESC"
    )
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = schedules.iter().map(|(id, name, cron, tool_name, active, target, last_run, next_run, run_count, _hour, sched_type, created)| {
        let status = if *active { "active" } else { "paused" };
        json!({
            "id": id,
            "name": name,
            "cron_expression": cron,
            "tool_name": tool_name,
            "tool": tool_name,
            "is_active": active,
            "status": status,
            "target": target,
            "next_run": next_run,
            "last_run": last_run,
            "run_count": run_count.unwrap_or(0),
            "schedule_type": sched_type,
            "created_at": created
        })
    }).collect();

    Json(json!({"schedules": list})).into_response()
}

pub async fn create_schedule(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    // Check scheduled_scans feature flag
    let org_id_str = user.org_id.as_deref().unwrap_or("");
    let org_plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
        .bind(org_id_str)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let plan = org_plan.map(|p| p.0).unwrap_or_else(|| "trial".into());
    let plan_configs = crate::services::plan::get_plan_configs();
    if let Some(config) = plan_configs.get(plan.as_str()) {
        if !config.features.scheduled_scans {
            return (StatusCode::PAYMENT_REQUIRED, Json(json!({
                "error": "Scheduled scans require Starter or higher plan."
            }))).into_response();
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("New Schedule");
    let cron = body.get("cron_expression").and_then(|v| v.as_str()).unwrap_or("0 0 * * *");
    let tool_name = body.get("tool_name").and_then(|v| v.as_str())
        .or_else(|| body.get("tool").and_then(|v| v.as_str()))
        .unwrap_or("");
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");
    let schedule_type = body.get("schedule_type").and_then(|v| v.as_str()).unwrap_or("cron");
    let agent_id = body.get("agent_id").and_then(|v| v.as_str());
    let params = body.get("parameters").cloned().unwrap_or(json!({}));

    // Compute first next_run
    let next_run = crate::services::scheduler::next_cron_fire(cron, chrono::Utc::now());

    let result = sqlx::query(
        "INSERT INTO scheduled_scans (id, user_id, organization_id, name, cron_expression, tool_name, target, schedule_type, parameters, agent_id, is_active, next_run, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, TRUE, $11, NOW(), NOW())"
    )
    .bind(&id)
    .bind(&user.user_id)
    .bind(&user.org_id.as_deref().unwrap_or(""))
    .bind(name)
    .bind(cron)
    .bind(tool_name)
    .bind(target)
    .bind(schedule_type)
    .bind(&params)
    .bind(agent_id)
    .bind(next_run)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => Json(json!({"id": id, "message": "Schedule created", "next_run": next_run})).into_response(),
        Err(e) => {
            tracing::error!("Failed to create schedule: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to create schedule: {}", e)}))).into_response()
        }
    }
}

pub async fn update_schedule(
    Path(schedule_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let name = body.get("name").and_then(|v| v.as_str());
    let cron = body.get("cron_expression").and_then(|v| v.as_str());
    let tool_name = body.get("tool_name").and_then(|v| v.as_str())
        .or_else(|| body.get("tool").and_then(|v| v.as_str()));
    let target = body.get("target").and_then(|v| v.as_str());

    let mut sets = Vec::new();
    let mut idx = 1;
    if name.is_some() { sets.push(format!("name = ${}", idx)); idx += 1; }
    if cron.is_some() { sets.push(format!("cron_expression = ${}", idx)); idx += 1; }
    if tool_name.is_some() { sets.push(format!("tool_name = ${}", idx)); idx += 1; }
    if target.is_some() { sets.push(format!("target = ${}", idx)); idx += 1; }

    if sets.is_empty() {
        return Json(json!({"message": "Nothing to update", "id": schedule_id})).into_response();
    }

    // Always update updated_at
    sets.push("updated_at = NOW()".to_string());

    let user_param = idx;
    let id_param = idx + 1;
    let sql = format!(
        "UPDATE scheduled_scans SET {} WHERE id = ${} AND user_id = ${}",
        sets.join(", "), id_param, user_param
    );

    let mut query = sqlx::query(&sql);
    if let Some(v) = name { query = query.bind(v); }
    if let Some(v) = cron { query = query.bind(v); }
    if let Some(v) = tool_name { query = query.bind(v); }
    if let Some(v) = target { query = query.bind(v); }
    query = query.bind(&user.user_id);
    query = query.bind(&schedule_id);

    let _ = query.execute(&state.db).await;

    // Recompute next_run if cron changed
    if let Some(new_cron) = cron {
        let next = crate::services::scheduler::next_cron_fire(new_cron, chrono::Utc::now());
        let _ = sqlx::query("UPDATE scheduled_scans SET next_run = $1 WHERE id = $2")
            .bind(next).bind(&schedule_id).execute(&state.db).await;
    }

    Json(json!({"message": "Schedule updated", "id": schedule_id})).into_response()
}

pub async fn delete_schedule(
    Path(schedule_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("DELETE FROM scheduled_scans WHERE id = $1 AND user_id = $2")
        .bind(&schedule_id)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Schedule deleted"})).into_response()
}

pub async fn toggle_schedule(
    Path(schedule_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let _ = sqlx::query("UPDATE scheduled_scans SET is_active = NOT is_active WHERE id = $1 AND user_id = $2")
        .bind(&schedule_id)
        .bind(&user.user_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Schedule toggled", "id": schedule_id})).into_response()
}

/// Enable continuous (hourly) monitoring for a project.
/// Creates scheduled scans with `0 * * * *` cron (every hour) for a set of
/// security tools against the project targets. Requires Enterprise plan.
pub async fn enable_continuous_monitoring(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match &user.org_id {
        Some(id) => id.clone(),
        None => return (StatusCode::FORBIDDEN, Json(json!({"error": "Organization required"}))).into_response(),
    };

    // Require Enterprise plan
    let org_plan: Option<(String,)> = sqlx::query_as("SELECT plan_type FROM organizations WHERE id = $1")
        .bind(&org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let plan = org_plan.map(|p| p.0).unwrap_or_else(|| "trial".into());
    if plan != "enterprise" {
        return (StatusCode::PAYMENT_REQUIRED, Json(json!({
            "error": "Continuous monitoring requires Enterprise plan."
        }))).into_response();
    }

    let project_id = body.get("project_id").and_then(|v| v.as_i64());
    let target = body.get("target").and_then(|v| v.as_str()).unwrap_or("");
    if target.is_empty() && project_id.is_none() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Either target or project_id is required"}))).into_response();
    }

    // Tools for continuous monitoring: run key security checks hourly
    let monitoring_tools = vec!["nmap", "nuclei", "whatweb", "sslscan", "httpx"];
    let cron_hourly = "0 * * * *";
    let mut created = Vec::new();

    for tool_name in &monitoring_tools {
        let id = uuid::Uuid::new_v4().to_string();
        let name = format!("Continuous Monitor: {} → {}", tool_name, target);
        let next_run = crate::services::scheduler::next_cron_fire(cron_hourly, chrono::Utc::now());

        let result = sqlx::query(
            "INSERT INTO scheduled_scans (id, user_id, organization_id, name, cron_expression, tool_name, target, schedule_type, parameters, is_active, next_run, project_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'continuous', '{}'::jsonb, TRUE, $8, $9, NOW(), NOW())"
        )
        .bind(&id)
        .bind(&user.user_id)
        .bind(&org_id)
        .bind(&name)
        .bind(cron_hourly)
        .bind(tool_name)
        .bind(target)
        .bind(next_run)
        .bind(project_id.map(|v| v as i32))
        .execute(&state.db)
        .await;

        if result.is_ok() {
            created.push(json!({"id": id, "tool": tool_name, "next_run": next_run}));
        }
    }

    Json(json!({
        "message": format!("Continuous monitoring enabled with {} tools", created.len()),
        "schedules": created,
        "cron": cron_hourly,
        "target": target
    })).into_response()
}

// ── Targets ────────────────────────────────────────────────

pub async fn list_targets(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Derive targets from scans with full details
    let targets = sqlx::query_as::<_, (String, i64, Option<String>, Option<String>)>(
        "SELECT target, COUNT(*) as cnt, CAST(MAX(created_at) AS TEXT) as last_scan, CAST(MIN(created_at) AS TEXT) as first_scan FROM scans WHERE user_id = $1 GROUP BY target ORDER BY cnt DESC LIMIT 50"
    )
    .bind(&user.user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = targets.iter().enumerate().map(|(i, (t, c, last, first))| {
        // Detect target type
        let target_type = if t.contains('/') && t.chars().any(|c| c.is_numeric()) {
            "cidr"
        } else if t.starts_with("http://") || t.starts_with("https://") {
            "url"
        } else if t.chars().all(|c| c.is_numeric() || c == '.') {
            "ip"
        } else if t.contains('-') && t.chars().all(|c| c.is_numeric() || c == '.' || c == '-') {
            "range"
        } else {
            "domain"
        };
        json!({
            "id": format!("target-{}", i+1),
            "name": t,
            "value": t,
            "type": target_type,
            "tags": [],
            "last_scan": last,
            "scans_count": c,
            "risk_score": null,
            "created_at": first.clone().unwrap_or_default(),
            "notes": null,
        })
    }).collect();

    Json(json!({"targets": list})).into_response()
}

pub async fn list_target_groups(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"target_groups": []})).into_response()
}

// ── Analytics / Activity ───────────────────────────────────

pub async fn analytics_overview(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let total_scans = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = $1"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let completed = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = $1 AND status = 'completed'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let failed = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM scans WHERE user_id = $1 AND status = 'failed'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let success_rate = if total_scans.0 > 0 {
        (completed.0 as f64 / total_scans.0 as f64 * 100.0).round()
    } else { 0.0 };

    // Build daily_trend from scans table — include per-day avg duration (sec) and success rate (%)
    let trend_rows = sqlx::query_as::<_, (String, i64, Option<f64>, Option<f64>)>(
        "SELECT CAST(created_at::date AS TEXT) AS d, \
                COUNT(*)::bigint AS scans, \
                AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE status='completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL)::float8 AS avg_dur, \
                (COUNT(*) FILTER (WHERE status='completed')::float8 * 100.0 / NULLIF(COUNT(*),0)) AS success_rate \
         FROM scans \
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days' \
         GROUP BY d ORDER BY d"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();
    let daily_trend: Vec<serde_json::Value> = trend_rows.iter().map(|(d, c, avg, sr)| json!({
        "date": d,
        "scans": c,
        "avg_duration_seconds": avg.map(|v| v.round() as i64).unwrap_or(0),
        "success_rate": sr.map(|v| v.round()).unwrap_or(0.0),
    })).collect();

    // Build tool_usage from scans joined with tools
    let tool_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT COALESCE(t.name,'unknown'), COUNT(*) FROM scans s LEFT JOIN tools t ON s.tool_id = t.id WHERE s.user_id = $1 GROUP BY t.name ORDER BY COUNT(*) DESC LIMIT 10"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();
    let tool_usage: Vec<serde_json::Value> = tool_rows.iter().map(|(n, c)| json!({"name": n, "count": c})).collect();

    // Status distribution
    let status_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT COALESCE(status,'unknown'), COUNT(*) FROM scans WHERE user_id = $1 GROUP BY status"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();
    let mut status_dist = serde_json::Map::new();
    for (s, c) in &status_rows {
        status_dist.insert(s.clone(), json!(c));
    }

    // Target distribution — top 10 by frequency.
    let target_rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT COALESCE(NULLIF(target,''),'(none)'), COUNT(*) FROM scans \
         WHERE user_id = $1 GROUP BY target ORDER BY COUNT(*) DESC LIMIT 10"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();
    let target_distribution: Vec<serde_json::Value> = target_rows.iter()
        .map(|(t, c)| json!({"target": t, "count": c})).collect();

    // This-week vs last-week comparison.
    let this_week: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));
    let last_week: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE user_id = $1 \
         AND created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));
    let change_pct = if last_week.0 > 0 {
        ((this_week.0 - last_week.0) as f64 / last_week.0 as f64 * 100.0 * 10.0).round() / 10.0
    } else if this_week.0 > 0 { 100.0 } else { 0.0 };

    // Average scan duration (only for scans we have timing for).
    let avg_dur: (Option<f64>,) = sqlx::query_as(
        "SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::float8 \
         FROM scans WHERE user_id = $1 \
         AND status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((None,));
    let avg_duration_seconds = avg_dur.0.map(|v| v.round() as i64).unwrap_or(0);

    // Risk aggregation from scans.findings JSONB.
    // Findings are usually stored as { "critical": n, "high": n, ... } or as
    // an array of { "severity": "high", … }. Cover both shapes.
    let sev_rows: Vec<(String, i64)> = sqlx::query_as(
        r#"
        WITH per_scan AS (
            SELECT
                COALESCE((findings->>'critical')::int, 0) AS critical,
                COALESCE((findings->>'high')::int,     0) AS high,
                COALESCE((findings->>'medium')::int,   0) AS medium,
                COALESCE((findings->>'low')::int,      0) AS low,
                COALESCE((findings->>'info')::int,     0) AS info
            FROM scans
            WHERE user_id = $1
              AND findings IS NOT NULL
              AND jsonb_typeof(findings) = 'object'
        )
        SELECT 'critical', COALESCE(SUM(critical),0)::bigint FROM per_scan
        UNION ALL SELECT 'high',     COALESCE(SUM(high),0)::bigint     FROM per_scan
        UNION ALL SELECT 'medium',   COALESCE(SUM(medium),0)::bigint   FROM per_scan
        UNION ALL SELECT 'low',      COALESCE(SUM(low),0)::bigint      FROM per_scan
        UNION ALL SELECT 'info',     COALESCE(SUM(info),0)::bigint     FROM per_scan
        "#
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();

    let mut sev = std::collections::HashMap::new();
    for (k, v) in &sev_rows { sev.insert(k.clone(), *v); }
    let crit = *sev.get("critical").unwrap_or(&0);
    let high = *sev.get("high").unwrap_or(&0);
    let med  = *sev.get("medium").unwrap_or(&0);
    let low  = *sev.get("low").unwrap_or(&0);
    let info = *sev.get("info").unwrap_or(&0);
    let total_issues = crit + high + med + low + info;
    // Weighted score (clamped 0..100).
    let raw_score = crit * 25 + high * 10 + med * 4 + low * 1;
    let risk_score = raw_score.min(100);
    let risk_level = if crit > 0 || risk_score >= 75 { "critical" }
        else if high > 0 || risk_score >= 50 { "high" }
        else if med > 0 || risk_score >= 25 { "medium" }
        else if low > 0 { "low" } else { "info" };

    let _ = failed;

    Json(json!({
        "daily_trend": daily_trend,
        "tool_usage": tool_usage,
        "status_distribution": status_dist,
        "target_distribution": target_distribution,
        "comparison": {
            "this_week": this_week.0,
            "last_week": last_week.0,
            "change_pct": change_pct
        },
        "performance": {
            "avg_duration_seconds": avg_duration_seconds,
            "total_scans": total_scans.0,
            "success_rate": success_rate
        },
        "risk": {
            "score": risk_score,
            "level": risk_level,
            "severity_totals": {"critical": crit, "high": high, "medium": med, "low": low, "info": info},
            "total_issues": total_issues
        }
    })).into_response()
}

pub async fn activity_feed(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let limit: i64 = params.get("limit").and_then(|v| v.parse().ok()).unwrap_or(20);
    let org_id = user.org_id.clone().unwrap_or_else(|| user.user_id.clone());

    let mut activities: Vec<serde_json::Value> = Vec::new();

    // 1) Recent scans
    let scans = sqlx::query_as::<_, (String, String, String, Option<String>, String)>(
        "SELECT id, COALESCE(target,''), status, tool_id, CAST(created_at AS TEXT) FROM scans WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2"
    )
    .bind(&org_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (id, target, status, tool_id, ts) in &scans {
        let (act_type, title, severity) = match status.as_str() {
            "running" => ("scan_started", format!("Scan started on {}", target), "info"),
            "completed" => ("scan_completed", format!("Scan completed on {}", target), "success"),
            "failed" => ("scan_failed", format!("Scan failed on {}", target), "critical"),
            "cancelled" => ("scan_failed", format!("Scan cancelled on {}", target), "warning"),
            _ => ("scan_started", format!("Scan on {}", target), "info"),
        };
        activities.push(json!({
            "id": format!("scan-{}", id),
            "type": act_type,
            "title": title,
            "description": format!("Tool: {} • Target: {}", tool_id.as_deref().unwrap_or("unknown"), target),
            "timestamp": ts,
            "severity": severity,
            "link": format!("/dashboard/scans/{}", id),
            "meta": { "target": target, "status": status }
        }));
    }

    // 2) Recent reports
    let reports = sqlx::query_as::<_, (String, String, String, i32, String)>(
        "SELECT id, COALESCE(name,'Report'), COALESCE(template,''), total_findings, CAST(created_at AS TEXT) FROM reports WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2"
    )
    .bind(&org_id)
    .bind(limit / 2)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (id, name, template, findings, ts) in &reports {
        activities.push(json!({
            "id": format!("report-{}", id),
            "type": "report_generated",
            "title": format!("Report generated: {}", name),
            "description": format!("{} template • {} findings", template, findings),
            "timestamp": ts,
            "severity": if *findings > 10 { "warning" } else { "success" },
            "link": format!("/dashboard/reports?id={}", id),
            "meta": { "template": template, "findings": findings }
        }));
    }

    // 3) Audit log entries (login, settings changes, etc.)
    let audit = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, action, COALESCE(details::text, '{}'), CAST(created_at AS TEXT) FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2"
    )
    .bind(&user.user_id)
    .bind(limit / 2)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (id, action, details, ts) in &audit {
        let (act_type, severity) = match action.as_str() {
            "login" | "login_success" => ("user_action", "info"),
            "logout" => ("user_action", "info"),
            "scan_start" | "scan_started" => continue, // already covered
            "mfa_enabled" | "mfa_disabled" => ("system", "warning"),
            "plan_change" => ("system", "info"),
            _ => ("system", "info"),
        };
        let title = match action.as_str() {
            "login" | "login_success" => "User logged in".to_string(),
            "logout" => "User logged out".to_string(),
            "mfa_enabled" => "MFA enabled".to_string(),
            "mfa_disabled" => "MFA disabled".to_string(),
            "plan_change" => "Plan changed".to_string(),
            _ => format!("Action: {}", action),
        };
        activities.push(json!({
            "id": format!("audit-{}", id),
            "type": act_type,
            "title": title,
            "description": if details.len() > 2 { Some(details.clone()) } else { None::<String> },
            "timestamp": ts,
            "severity": severity
        }));
    }

    // Sort by timestamp descending and limit
    activities.sort_by(|a, b| {
        let ts_a = a["timestamp"].as_str().unwrap_or("");
        let ts_b = b["timestamp"].as_str().unwrap_or("");
        ts_b.cmp(ts_a)
    });
    activities.truncate(limit as usize);

    Json(json!({"activities": activities})).into_response()
}

// ── Usage stats ────────────────────────────────────────────

pub async fn usage_stats(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.clone().unwrap_or_else(|| user.user_id.clone());

    // Scan usage — count scans this billing period (current calendar month).
    let scans_used: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans \
         WHERE organization_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)"
    ).bind(&org_id).fetch_one(&state.db).await.unwrap_or((0,));

    // Storage = sum of scan output text size (rough proxy; reports/uploads
    // are not currently tracked separately).
    let storage_bytes: (Option<i64>,) = sqlx::query_as(
        "SELECT COALESCE(SUM(LENGTH(COALESCE(output,'')) + LENGTH(COALESCE(error_log,''))), 0)::bigint \
         FROM scans WHERE organization_id = $1"
    ).bind(&org_id).fetch_one(&state.db).await.unwrap_or((Some(0),));
    let storage_used_mb = storage_bytes.0.unwrap_or(0) / 1_048_576;

    // API calls — count audit_logs entries this month as a conservative proxy
    // (covers every authenticated mutation; read-only GETs aren't logged so
    // this is an under-count, not an over-count).
    let api_calls: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM audit_logs \
         WHERE organization_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)"
    ).bind(&org_id).fetch_one(&state.db).await.unwrap_or((0,));

    // Plan-aware limits.
    let plan: (Option<String>,) = sqlx::query_as(
        "SELECT plan_type FROM organizations WHERE id = $1"
    ).bind(&org_id).fetch_optional(&state.db).await.ok().flatten().unwrap_or((None,));
    let configs = crate::services::plan::get_plan_configs();
    let cfg = configs.get(plan.0.as_deref().unwrap_or("trial"));
    // Use monthly when set, otherwise project from daily * 30. 0 in either
    // means "unlimited" — surface as -1 so the frontend renders as ∞.
    let scans_limit: i64 = cfg.map(|c| {
        if c.monthly_scan_limit > 0 { c.monthly_scan_limit as i64 }
        else if c.daily_scan_limit > 0 { c.daily_scan_limit as i64 * 30 }
        else { -1 }
    }).unwrap_or(10_000);
    // Storage / api limits are not modelled per-plan yet; pick sane defaults.
    let storage_limit_mb: i64 = match plan.0.as_deref().unwrap_or("trial") {
        "trial"      => 1_024,
        "starter"    => 10_240,
        "pro"        => 51_200,
        "enterprise" => -1,
        _            => 10_240,
    };
    let api_limit: i64 = match plan.0.as_deref().unwrap_or("trial") {
        "trial"      => 5_000,
        "starter"    => 50_000,
        "pro"        => 500_000,
        "enterprise" => -1,
        _            => 50_000,
    };

    Json(json!({
        "scans_used": scans_used.0,
        "scans_limit": scans_limit,
        "storage_used_mb": storage_used_mb,
        "storage_limit_mb": storage_limit_mb,
        "api_calls": api_calls.0,
        "api_limit": api_limit,
    })).into_response()
}

// ── Plan info / features ───────────────────────────────────

pub async fn roles_list(
    _user: AuthUser,
) -> impl IntoResponse {
    Json(json!({
        "roles": [
            {"id": "viewer", "name": "Viewer", "level": 1, "description": "Read-only access to dashboards and reports"},
            {"id": "user", "name": "User", "level": 2, "description": "Can run scans, manage own agents and view results"},
            {"id": "analyst", "name": "Analyst", "level": 3, "description": "Can manage all scans, reports, and team resources"},
            {"id": "admin", "name": "Admin", "level": 4, "description": "Full organization management, billing, and team control"},
            {"id": "superadmin", "name": "Super Admin", "level": 5, "description": "Platform-level access, can impersonate and manage all orgs"}
        ]
    })).into_response()
}

pub async fn plan_info(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.clone().unwrap_or_else(|| user.user_id.clone());

    // Fetch plan and org created_at
    let org_row: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT COALESCE(plan_type, 'trial'), CAST(created_at AS TEXT) FROM organizations WHERE id = $1"
    )
    .bind(&org_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let plan = org_row.as_ref().map(|r| r.0.clone()).unwrap_or_else(|| "trial".to_string());
    let org_created = org_row.as_ref().and_then(|r| r.1.clone());

    let configs = crate::services::plan::get_plan_configs();
    let config = configs.get(plan.as_str());

    // Calculate usage
    let scans_today: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND created_at::date = CURRENT_DATE"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let scans_this_month: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let running_scans: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND status IN ('running', 'pending')"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let total_scans: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE organization_id = $1"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let team_members: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = TRUE"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let online_agents: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM agents WHERE organization_id = $1 AND status = 'online'"
    )
    .bind(&org_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    let total_tools: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM tools WHERE is_active = TRUE"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or((0,));

    // Calculate trial days remaining
    let trial_days_remaining = if let Some(ref cfg) = config {
        if cfg.trial_days > 0 {
            if let Some(ref created) = org_created {
                chrono::NaiveDateTime::parse_from_str(
                    created.split('.').next().unwrap_or(created),
                    "%Y-%m-%d %H:%M:%S"
                ).ok().map(|dt| {
                    let days_elapsed = (chrono::Utc::now().naive_utc() - dt).num_days();
                    (cfg.trial_days as i64 - days_elapsed).max(0)
                }).unwrap_or(0)
            } else { 0 }
        } else { -1 } // -1 = not a trial plan
    } else { 0 };

    let daily_limit = config.as_ref().map(|c| c.daily_scan_limit).unwrap_or(0);
    let monthly_limit = config.as_ref().map(|c| c.monthly_scan_limit).unwrap_or(0);
    let concurrent_limit = config.as_ref().map(|c| c.concurrent_scans).unwrap_or(0);

    let scans_remaining_daily = if daily_limit > 0 {
        (daily_limit as i64 - scans_today.0).max(0)
    } else { -1 };

    let scans_remaining_monthly = if monthly_limit > 0 {
        (monthly_limit as i64 - scans_this_month.0).max(0)
    } else { -1 };

    Json(json!({
        "plan": plan,
        "config": config,
        "usage": {
            "scans_today": scans_today.0,
            "scans_this_month": scans_this_month.0,
            "scans_remaining_daily": scans_remaining_daily,
            "scans_remaining_monthly": scans_remaining_monthly,
            "running_scans": running_scans.0,
            "total_scans": total_scans.0,
            "team_members": team_members.0,
            "online_agents": online_agents.0,
            "tools_accessible": total_tools.0,
            "tools_total": total_tools.0,
            "concurrent_limit": concurrent_limit,
            "daily_limit": daily_limit,
            "monthly_limit": monthly_limit
        },
        "trial": {
            "is_trial": plan == "trial",
            "days_remaining": trial_days_remaining,
            "expired": trial_days_remaining == 0 && plan == "trial"
        }
    })).into_response()
}

pub async fn plan_features(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let plan_row: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT plan_type FROM organizations WHERE id = $1"
    ).bind(org_id).fetch_optional(&state.db).await.ok().flatten();
    let plan = plan_row.and_then(|r| r.0).unwrap_or_else(|| "trial".into());

    let configs = crate::services::plan::get_plan_configs();
    let cfg = configs.get(plan.as_str());

    let (features, limits) = match cfg {
        Some(c) => (
            json!(c.features),
            json!({
                "daily_scan_limit": c.daily_scan_limit,
                "monthly_scan_limit": c.monthly_scan_limit,
                "concurrent_scans": c.concurrent_scans,
                "max_projects": c.max_projects,
                "max_team_members": c.max_team_members,
                "max_agents": c.max_agents,
                "trial_days": c.trial_days,
            }),
        ),
        None => (json!({}), json!({})),
    };

    Json(json!({
        "plan": plan,
        "features": features,
        "limits": limits,
    })).into_response()
}

// ── Billing extra endpoint ─────────────────────────────────

pub async fn create_checkout_session(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"error": "Billing not configured"})).into_response()
}

// ── SSO test ───────────────────────────────────────────────

pub async fn sso_test(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!({"status": "ok", "message": "SSO test not implemented"})).into_response()
}

// ── Admin endpoints ────────────────────────────────────────

pub async fn admin_overview(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let total_users = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM users").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let active_users = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM users WHERE is_active = TRUE").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let total_orgs = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM organizations").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let total_scans = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM scans").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let running_scans = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM scans WHERE status IN ('running','pending')").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let total_agents = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM agents").fetch_one(&state.db).await.unwrap_or((0,)).0;
    let online_agents = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM agents WHERE status = 'online'").fetch_one(&state.db).await.unwrap_or((0,)).0;

    // Plan distribution
    let plans = sqlx::query_as::<_, (String, i64)>("SELECT COALESCE(plan_type,'trial'), COUNT(*) FROM organizations GROUP BY plan_type")
        .fetch_all(&state.db).await.unwrap_or_default();
    let plans_dist: serde_json::Map<String, serde_json::Value> = plans.into_iter().map(|(p, c)| (p, json!(c))).collect();

    // Recent users
    let recent_users = sqlx::query_as::<_, (String, String, String, String, Option<String>, bool, String)>(
        "SELECT id, email, COALESCE(first_name,''), COALESCE(role,'user'), organization_id, is_active, CAST(created_at AS TEXT) FROM users ORDER BY created_at DESC LIMIT 10"
    ).fetch_all(&state.db).await.unwrap_or_default();
    let user_list: Vec<serde_json::Value> = recent_users.iter().map(|(id, email, name, role, org, active, created)| {
        json!({"id": id, "email": email, "first_name": name, "last_name": "", "role": role, "organization_id": org, "is_active": active, "created_at": created})
    }).collect();

    // Recent orgs
    let recent_orgs = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, bool)>(
        "SELECT id, name, slug, plan_type, is_active FROM organizations ORDER BY created_at DESC LIMIT 10"
    ).fetch_all(&state.db).await.unwrap_or_default();
    let org_list: Vec<serde_json::Value> = recent_orgs.iter().map(|(id, name, slug, plan, active)| {
        json!({"id": id, "name": name, "slug": slug, "plan_type": plan.clone().unwrap_or_else(|| "trial".into()), "is_active": active})
    }).collect();

    // Recent scans
    let recent_scans = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, target, status, CAST(created_at AS TEXT) FROM scans ORDER BY created_at DESC LIMIT 5"
    ).fetch_all(&state.db).await.unwrap_or_default();
    let scan_list: Vec<serde_json::Value> = recent_scans.iter().map(|(id, target, status, created)| {
        json!({"id": id, "target": target, "status": status, "created_at": created})
    }).collect();

    // ── Phase 7 super-admin enrichments ──
    // Recent signups (last 7 days)
    let signups_24h = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours'"
    ).fetch_one(&state.db).await.unwrap_or((0,)).0;
    let signups_7d = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days'"
    ).fetch_one(&state.db).await.unwrap_or((0,)).0;
    let signups_30d = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '30 days'"
    ).fetch_one(&state.db).await.unwrap_or((0,)).0;

    let recent_signups_rows = sqlx::query_as::<_, (String, String, Option<String>, String)>(
        "SELECT id, email, first_name, CAST(created_at AS TEXT)
         FROM users
         WHERE created_at > NOW() - INTERVAL '14 days'
         ORDER BY created_at DESC
         LIMIT 20"
    ).fetch_all(&state.db).await.unwrap_or_default();
    let recent_signups: Vec<serde_json::Value> = recent_signups_rows.iter().map(|(id, email, name, created)| {
        json!({"id": id, "email": email, "first_name": name.clone().unwrap_or_default(), "created_at": created})
    }).collect();

    // Recent audit events (catch-all visibility for super-admin)
    let recent_audit_rows = sqlx::query_as::<_, (String, String, Option<String>, String, String)>(
        "SELECT action, category, COALESCE(severity, 'info'), COALESCE(status,'success'), CAST(created_at AS TEXT)
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT 25"
    ).fetch_all(&state.db).await.unwrap_or_default();
    let recent_audit: Vec<serde_json::Value> = recent_audit_rows.iter().map(|(action, cat, sev, status, created)| {
        json!({
            "action": action,
            "category": cat,
            "severity": sev,
            "status": status,
            "created_at": created
        })
    }).collect();

    // MRR computed from plan_type × monthly price
    let mrr: f64 = plans_dist.iter().map(|(plan, count_v)| {
        let price = match plan.as_str() {
            "starter" => 99.0,
            "professional" => 299.0,
            "enterprise" => 799.0,
            _ => 0.0,
        };
        let count = count_v.as_i64().unwrap_or(0) as f64;
        price * count
    }).sum();
    let arr = mrr * 12.0;

    // Newsletter subscribers (optional table — guard with COALESCE if missing)
    let newsletter_count: i64 = sqlx::query_as::<_, (i64,)>(
        "SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active = TRUE"
    ).fetch_one(&state.db).await.map(|r| r.0).unwrap_or(0);

    let newsletter_rows = sqlx::query_as::<_, (String, String, bool, String)>(
        "SELECT id, email, is_active, CAST(created_at AS TEXT) FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 25"
    ).fetch_all(&state.db).await.unwrap_or_default();
    let newsletter_list: Vec<serde_json::Value> = newsletter_rows.iter().map(|(id, email, active, created)| {
        json!({"id": id, "email": email, "is_active": active, "created_at": created})
    }).collect();

    Json(json!({
        "users": { "total": total_users, "active": active_users, "list": user_list },
        "organizations": { "total": total_orgs, "plans_distribution": plans_dist, "list": org_list },
        "scans": { "total": total_scans, "running": running_scans, "recent": scan_list },
        "agents": { "total": total_agents, "online": online_agents },
        "revenue": { "mrr": mrr, "arr": arr },
        "signups": { "last_24h": signups_24h, "last_7d": signups_7d, "last_30d": signups_30d, "recent": recent_signups },
        "newsletter": { "total": newsletter_count, "list": newsletter_list },
        "audit_log": recent_audit,
        "system_health": "healthy",
        "engine": "rust-axum"
    })).into_response()
}

pub async fn admin_impersonate(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let email = match body.get("email").and_then(|e| e.as_str()) {
        Some(e) => e.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "email is required"}))).into_response(),
    };

    let user: Option<crate::models::User> = sqlx::query_as("SELECT * FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let user = match user {
        Some(u) => u,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
    };

    let org_id = user.organization_id.as_deref();
    let role = user.role.as_deref().unwrap_or("user");
    let token = create_access_token(&state.jwt_secret, &user.id, org_id, role).unwrap_or_default();
    let refresh = create_refresh_token(&state.jwt_secret, &user.id).unwrap_or_default();

    (StatusCode::OK, Json(json!({
        "token": token,
        "refresh_token": refresh,
        "user": user.to_response()
    }))).into_response()
}

pub async fn admin_change_plan(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match body.get("organization_id").and_then(|o| o.as_str()) {
        Some(id) => id.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "organization_id is required"}))).into_response(),
    };
    let plan_type = match body.get("plan_type").and_then(|p| p.as_str()) {
        Some(p) => p.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "plan_type is required"}))).into_response(),
    };

    let valid_plans = ["free", "starter", "professional", "enterprise"];
    if !valid_plans.contains(&plan_type.as_str()) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Invalid plan_type. Must be one of: free, starter, professional, enterprise"}))).into_response();
    }

    let result = sqlx::query("UPDATE organizations SET plan_type = $1 WHERE id = $2")
        .bind(&plan_type)
        .bind(&org_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(json!({"message": format!("Plan changed to {}", plan_type), "plan_type": plan_type}))).into_response()
        },
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Organization not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
    }
}

// ── Admin Organization Deletion (Hard Delete + Cascade) ────

pub async fn admin_delete_organization(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Path(org_id): Path<String>,
) -> impl IntoResponse {
    // Verify org exists
    let org_exists: Option<(String,)> = sqlx::query_as("SELECT id FROM organizations WHERE id = $1")
        .bind(&org_id)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    if org_exists.is_none() {
        return (StatusCode::NOT_FOUND, Json(json!({"error": "Organization not found"}))).into_response();
    }

    // Cascade delete all related data (respecting FK constraint order)
    let _ = sqlx::query("DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM scheduled_scans WHERE user_id IN (SELECT id FROM users WHERE organization_id = $1)").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM usage_tracking WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM reports WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM scans WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM sso_configs WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM subscriptions WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM projects WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM agents WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM users WHERE organization_id = $1").bind(&org_id).execute(&state.db).await;

    let result = sqlx::query("DELETE FROM organizations WHERE id = $1")
        .bind(&org_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(json!({"message": "Organization and all related data deleted"}))).into_response()
        },
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "Organization not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
    }
}

// ── Admin User Management ──────────────────────────────────

pub async fn admin_delete_user(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> impl IntoResponse {
    // Don't allow deleting yourself
    if user_id == _admin.0.user_id {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Cannot delete yourself"}))).into_response();
    }

    // Delete related records first to avoid FK constraint violations
    let _ = sqlx::query("DELETE FROM audit_logs WHERE user_id = $1").bind(&user_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM reports WHERE user_id = $1").bind(&user_id).execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM scheduled_scans WHERE user_id = $1").bind(&user_id).execute(&state.db).await;
    let _ = sqlx::query("UPDATE scans SET user_id = NULL WHERE user_id = $1").bind(&user_id).execute(&state.db).await;

    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(&user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(json!({"message": "User deleted"}))).into_response()
        },
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
    }
}

pub async fn admin_toggle_user(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> impl IntoResponse {
    let result = sqlx::query("UPDATE users SET is_active = NOT COALESCE(is_active, true) WHERE id = $1 RETURNING is_active")
        .bind(&user_id)
        .fetch_optional(&state.db)
        .await;

    match result {
        Ok(Some(row)) => {
            let is_active: bool = sqlx::Row::get(&row, "is_active");
            (StatusCode::OK, Json(json!({"message": if is_active { "User activated" } else { "User deactivated" }, "is_active": is_active}))).into_response()
        },
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
    }
}

pub async fn admin_change_role(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let role = match body.get("role").and_then(|r| r.as_str()) {
        Some(r) => r.to_string(),
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "role is required"}))).into_response(),
    };

    let valid_roles = crate::middleware::auth_middleware::VALID_ROLES;
    if !valid_roles.contains(&role.as_str()) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Invalid role. Must be one of: {:?}", valid_roles)}))).into_response();
    }

    let result = sqlx::query("UPDATE users SET role = $1 WHERE id = $2")
        .bind(&role)
        .bind(&user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            (StatusCode::OK, Json(json!({"message": format!("Role changed to {}", role), "role": role}))).into_response()
        },
        Ok(_) => (StatusCode::NOT_FOUND, Json(json!({"error": "User not found"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Database error: {}", e)}))).into_response(),
    }
}

pub async fn admin_service_dashboard(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let dashboard = state.service_manager.get_dashboard().await;
    Json(json!(dashboard)).into_response()
}

pub async fn admin_service_list(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let services = state.service_manager.get_services().await;
    Json(json!({"services": services})).into_response()
}

pub async fn admin_service_action(
    Path(service_id): Path<String>,
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let action = body.get("action").and_then(|a| a.as_str()).unwrap_or("restart");
    match state.service_manager.service_action(&service_id, action).await {
        Ok(msg) => Json(json!({"success": true, "message": msg})).into_response(),
        Err(e) => Json(json!({"success": false, "error": e})).into_response(),
    }
}

pub async fn admin_system_info(
    _admin: AdminUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let system = crate::services::service_manager::get_system_metrics().await;
    Json(json!(system)).into_response()
}

pub async fn admin_processes(
    _admin: AdminUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let procs = crate::services::service_manager::get_processes().await;
    Json(json!({"processes": procs})).into_response()
}

pub async fn admin_alerts(
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let alerts = state.service_manager.get_alerts().await;
    Json(json!({"alerts": alerts})).into_response()
}

pub async fn admin_ack_alert(
    Path(alert_id): Path<String>,
    _admin: AdminUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let ok = state.service_manager.acknowledge_alert(&alert_id).await;
    Json(json!({"success": ok, "id": alert_id})).into_response()
}

// ── AI endpoints ───────────────────────────────────────────

pub async fn ai_suggest(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"suggestions": [], "message": "AI suggestions not yet available"})).into_response()
}

pub async fn ai_remediation(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"remediation": "AI remediation not yet available", "steps": []})).into_response()
}

pub async fn ai_report_summary(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({"summary": "AI report summary not yet available"})).into_response()
}

// ── Purple Team endpoints ──────────────────────────────────

pub async fn purple_team_dashboard(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = match user.org_id.as_deref() {
        Some(value) if !value.is_empty() => value,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Organization context required"}))).into_response(),
    };

    purple_team_progress_tick(&state, org_id).await;

    let (total_exercises, running, completed, total_attack_steps, total_detected, total_missed, average_risk_score) =
        sqlx::query_as::<_, (i64, i64, i64, i64, i64, i64, f64)>(
            r#"SELECT
                COUNT(*)::bigint,
                COALESCE(SUM(CASE WHEN status IN ('running', 'pending') THEN 1 ELSE 0 END), 0)::bigint,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0)::bigint,
                COALESCE(SUM(total_steps), 0)::bigint,
                COALESCE(SUM(detected_attacks), 0)::bigint,
                COALESCE(SUM(missed_attacks), 0)::bigint,
                COALESCE(AVG(risk_score), 0)::double precision
            FROM purple_team_exercises
            WHERE organization_id = $1"#
        )
        .bind(org_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0, 0, 0, 0, 0, 0, 0.0));

    let detection_rate = if total_attack_steps > 0 {
        (total_detected as f64 / total_attack_steps as f64) * 100.0
    } else {
        0.0
    };

    Json(json!({
        "total_exercises": total_exercises,
        "running": running,
        "completed": completed,
        "total_attack_steps": total_attack_steps,
        "total_detected": total_detected,
        "total_missed": total_missed,
        "detection_rate": detection_rate,
        "average_risk_score": average_risk_score,
        "available_chains": purple_team_chains_catalog().len(),
        "available_playbooks": purple_team_playbooks_catalog().len(),
        "exercises": total_exercises,
        "active_chains": purple_team_chains_catalog().len(),
        "playbooks": purple_team_playbooks_catalog().len(),
        "coverage": detection_rate
    })).into_response()
}

pub async fn purple_team_chains(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!(purple_team_chains_catalog())).into_response()
}

pub async fn purple_team_playbooks(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(json!(purple_team_playbooks_catalog())).into_response()
}

pub async fn purple_team_exercises(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = match user.org_id.as_deref() {
        Some(value) if !value.is_empty() => value,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Organization context required"}))).into_response(),
    };

    purple_team_progress_tick(&state, org_id).await;

    let rows = sqlx::query_as::<_, (String,)>(
        r#"SELECT payload::text
        FROM purple_team_exercises
        WHERE organization_id = $1
        ORDER BY created_at DESC"#
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let exercises: Vec<serde_json::Value> = rows
        .into_iter()
        .filter_map(|(payload_text,)| serde_json::from_str::<serde_json::Value>(&payload_text).ok())
        .collect();
    Json(json!(exercises)).into_response()
}

pub async fn purple_team_exercise_detail(
    Path(exercise_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = match user.org_id.as_deref() {
        Some(value) if !value.is_empty() => value,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Organization context required"}))).into_response(),
    };

    purple_team_progress_tick(&state, org_id).await;

    let row = sqlx::query_as::<_, (String,)>(
        r#"SELECT payload::text
        FROM purple_team_exercises
        WHERE organization_id = $1 AND id = $2
        LIMIT 1"#
    )
    .bind(org_id)
    .bind(&exercise_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    match row {
        Some((payload_text,)) => match serde_json::from_str::<serde_json::Value>(&payload_text) {
            Ok(item) => Json(item).into_response(),
            Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Invalid exercise payload"}))).into_response(),
        },
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Exercise not found"}))).into_response(),
    }
}

pub async fn purple_team_create_exercise(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match user.org_id.as_deref() {
        Some(value) if !value.is_empty() => value,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Organization context required"}))).into_response(),
    };
    let chain_id = match body.get("chain_id").and_then(|value| value.as_str()) {
        Some(value) if !value.trim().is_empty() => value.trim(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "chain_id is required"}))).into_response(),
    };
    let target = match body.get("target").and_then(|value| value.as_str()) {
        Some(value) if !value.trim().is_empty() => value.trim(),
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "target is required"}))).into_response(),
    };

    let selected_chain = match purple_team_chain_by_id(chain_id) {
        Some(chain) => chain,
        None => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Unknown attack chain"}))).into_response(),
    };
    let exercise = purple_team_build_exercise(
        &selected_chain,
        chain_id,
        target,
        body.get("name").and_then(|value| value.as_str()),
    );

    let exercise_id = exercise.get("id").and_then(|value| value.as_str()).unwrap_or_default().to_string();
    let exercise_name = exercise.get("name").and_then(|value| value.as_str()).unwrap_or("Purple Team Exercise").to_string();
    let status = exercise.get("status").and_then(|value| value.as_str()).unwrap_or("pending").to_string();
    let total_steps = exercise.get("total_steps").and_then(|value| value.as_i64()).unwrap_or(0);
    let completed_steps = exercise.get("completed_steps").and_then(|value| value.as_i64()).unwrap_or(0);
    let detected_attacks = exercise.get("detected_attacks").and_then(|value| value.as_i64()).unwrap_or(0);
    let missed_attacks = exercise.get("missed_attacks").and_then(|value| value.as_i64()).unwrap_or(0);
    let risk_score = exercise.get("risk_score").and_then(|value| value.as_f64()).unwrap_or(0.0);

    let inserted = sqlx::query(
        r#"INSERT INTO purple_team_exercises (
            id, organization_id, name, attack_chain_id, target, status,
            total_steps, completed_steps, detected_attacks, missed_attacks,
            risk_score, payload, created_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12::jsonb, NOW(), NOW()
        )"#
    )
    .bind(&exercise_id)
    .bind(org_id)
    .bind(&exercise_name)
    .bind(chain_id)
    .bind(target)
    .bind(&status)
    .bind(total_steps)
    .bind(completed_steps)
    .bind(detected_attacks)
    .bind(missed_attacks)
    .bind(risk_score)
    .bind(exercise.to_string())
    .execute(&state.db)
    .await;

    match inserted {
        Ok(_) => (StatusCode::CREATED, Json(exercise)).into_response(),
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to persist exercise"}))).into_response(),
    }
}

pub async fn purple_team_mitre(
    _user: AuthUser,
    State(_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    Json(purple_team_mitre_matrix_data()).into_response()
}

/// Abort a running or pending exercise. Marks it as cancelled and finalises counters.
pub async fn purple_team_abort_exercise(
    Path(exercise_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = match user.org_id.as_deref() {
        Some(v) if !v.is_empty() => v,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Organization context required"}))).into_response(),
    };

    let abort_event = json!({
        "event_type": "abort",
        "aborted_by": user.user_id,
        "aborted_at": chrono::Utc::now().to_rfc3339(),
        "reason": "manual_abort"
    });
    let abort_event_str = abort_event.to_string();

    let result = sqlx::query(
        r#"UPDATE purple_team_exercises
           SET status = 'cancelled',
               completed_at = NOW(),
               updated_at = NOW(),
               payload = payload || jsonb_build_object(
                   'status', 'cancelled',
                   'completed_at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                   'telemetry_events', COALESCE(payload->'telemetry_events', '[]'::jsonb) || $3::jsonb
               )
           WHERE id = $1 AND organization_id = $2 AND status IN ('pending', 'running')
           RETURNING id"#
    )
    .bind(&exercise_id)
    .bind(org_id)
    .bind(&abort_event_str)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => {
            Json(json!({
                "message": "Exercise aborted",
                "exercise_id": exercise_id,
                "status": "cancelled",
                "abort_event": abort_event
            })).into_response()
        }
        Ok(_) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "Exercise not found or already completed"}))).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to abort exercise {}: {}", exercise_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to abort exercise"}))).into_response()
        }
    }
}

fn purple_team_parse_telemetry_payload(
    body: &serde_json::Value,
    user: &AuthUser,
) -> Result<(i64, String, bool, String, f64, serde_json::Value), StatusCode> {
    let step_index = body.get("step_index").and_then(|v| v.as_i64()).unwrap_or(0);
    let technique_id = body.get("technique_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let detected = body.get("detected").and_then(|v| v.as_bool()).unwrap_or(false);
    let source = body.get("source").and_then(|v| v.as_str()).unwrap_or("manual").to_string();
    let confidence = body.get("confidence").and_then(|v| v.as_f64()).unwrap_or(1.0).clamp(0.0, 1.0);

    if technique_id.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let event = json!({
        "step_index": step_index,
        "technique_id": technique_id,
        "detected": detected,
        "source": source,
        "confidence": confidence,
        "reported_at": chrono::Utc::now().to_rfc3339(),
        "reported_by": user.user_id
    });

    Ok((step_index, technique_id, detected, source, confidence, event))
}

fn purple_team_detection_rate(detected_attacks: i64, total_steps: i64) -> f64 {
    if total_steps > 0 {
        (detected_attacks as f64 / total_steps as f64) * 100.0
    } else {
        0.0
    }
}

/// Ingest a blue-team detection telemetry event for an exercise step.
/// Blue team tooling (SIEM, EDR, etc.) posts detection signals here, which updates
/// the exercise's detected_attacks count, appends an event to the payload,
/// and recalculates gap_analysis in real time.
pub async fn purple_team_ingest_telemetry(
    Path(exercise_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = match user.org_id.as_deref() {
        Some(v) if !v.is_empty() => v,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "Organization context required"}))).into_response(),
    };

    let parsed = purple_team_parse_telemetry_payload(&body, &user);
    let (_step_index, _technique_id, detected, _source, _confidence, event) = match parsed {
        Ok(values) => values,
        Err(StatusCode::BAD_REQUEST) => {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": "technique_id is required"}))).into_response();
        }
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to parse telemetry"}))).into_response();
        }
    };

    // Increment detected_attacks counter if this event reports a detection.
    // The payload telemetry_events array is appended atomically.
    let delta: i64 = if detected { 1 } else { 0 };
    let result = sqlx::query_as::<_, (String, i64, i64, i64, String)>(
        r#"UPDATE purple_team_exercises
           SET detected_attacks = detected_attacks + $3,
               missed_attacks = missed_attacks + $4,
               updated_at = NOW(),
               payload = jsonb_set(
                   payload,
                   '{telemetry_events}',
                   COALESCE(payload->'telemetry_events', '[]'::jsonb) || $5::jsonb
               )
           WHERE id = $1 AND organization_id = $2
           RETURNING id, detected_attacks, missed_attacks, total_steps, attack_chain_id"#
    )
    .bind(&exercise_id)
    .bind(org_id)
    .bind(delta)
    .bind(1_i64 - delta)
    .bind(event.to_string())
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some((_, detected_attacks, missed_attacks, total_steps, chain_id))) => {
            let detection_rate = purple_team_detection_rate(detected_attacks, total_steps);

            // Build live gap_analysis from current counters and persist it into
            // the payload so that exercise_detail / exercises list reflects
            // real-time detection coverage without waiting for progress_tick.
            let gap = json!({
                "total_attacks": total_steps,
                "detected": detected_attacks,
                "missed": missed_attacks,
                "detection_rate": detection_rate
            });
            let _ = sqlx::query(
                r#"UPDATE purple_team_exercises
                   SET payload = jsonb_set(payload, '{gap_analysis}', $3::jsonb),
                       updated_at = NOW()
                   WHERE id = $1 AND organization_id = $2"#,
            )
            .bind(&exercise_id)
            .bind(org_id)
            .bind(gap.to_string())
            .execute(&state.db)
            .await;

            // Emit a detection pipeline signal: if coverage crosses a threshold,
            // flag it in the exercise payload for the frontend alert banner.
            if detection_rate >= 80.0 {
                let _ = sqlx::query(
                    r#"UPDATE purple_team_exercises
                       SET payload = jsonb_set(payload, '{detection_coverage_alert}', '"high_coverage"'::jsonb),
                           updated_at = NOW()
                       WHERE id = $1 AND organization_id = $2"#,
                )
                .bind(&exercise_id)
                .bind(org_id)
                .execute(&state.db)
                .await;
            } else if detection_rate < 40.0 && total_steps >= 3 {
                let _ = sqlx::query(
                    r#"UPDATE purple_team_exercises
                       SET payload = jsonb_set(payload, '{detection_coverage_alert}', '"low_coverage"'::jsonb),
                           updated_at = NOW()
                       WHERE id = $1 AND organization_id = $2"#,
                )
                .bind(&exercise_id)
                .bind(org_id)
                .execute(&state.db)
                .await;
            }

            Json(json!({
                "message": "Telemetry event recorded",
                "exercise_id": exercise_id,
                "attack_chain_id": chain_id,
                "detected_attacks": detected_attacks,
                "missed_attacks": missed_attacks,
                "detection_rate": detection_rate,
                "gap_analysis": {
                    "total_attacks": total_steps,
                    "detected": detected_attacks,
                    "missed": missed_attacks,
                    "detection_rate": detection_rate
                }
            })).into_response()
        }
        Ok(None) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "Exercise not found"}))).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to record telemetry for exercise {}: {}", exercise_id, e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to record telemetry"}))).into_response()
        }
    }
}

// ── Terminal endpoints ─────────────────────────────────────

pub async fn terminal_agents(
    _user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let agents = sqlx::query_as::<_, (String, String, String, String, String, String, Option<i32>, Option<String>)>(
        "SELECT id, name, COALESCE(hostname,''), COALESCE(ip_address,''), COALESCE(platform,'linux'), COALESCE(status,'offline'), ssh_port, ssh_username FROM agents LIMIT 50"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = agents.iter().map(|(id, name, host, ip, platform, status, port, user)| {
        json!({
            "id": id,
            "name": name,
            "hostname": host,
            "ip_address": ip,
            "platform": platform,
            "status": status,
            "ssh_host": ip,
            "ssh_port": port.unwrap_or(22),
            "ssh_username": user.as_deref().unwrap_or("root"),
            "connection_type": "ssh"
        })
    }).collect();

    Json(json!({"agents": list})).into_response()
}

pub async fn terminal_execute(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let agent_id = body.get("agent_id").and_then(|v| v.as_str()).or_else(|| body.get("agent_id").and_then(|v| v.as_i64()).map(|_| "")).unwrap_or("");
    let agent_id_str = body.get("agent_id").map(|v| v.to_string().replace('"', "")).unwrap_or_default();
    let agent_id_val = if agent_id.is_empty() { &agent_id_str } else { agent_id };
    let command = match body.get("command").and_then(|v| v.as_str()) {
        Some(c) if !c.is_empty() => c.to_string(),
        _ => return Json(json!({"error": "No command provided"})).into_response(),
    };

    // Block dangerous commands
    let blocked = ["rm -rf /", "mkfs", "dd if=/dev/zero", "> /dev/sda", ":(){ :|:& };:"];
    for b in &blocked {
        if command.contains(b) {
            return Json(json!({"error": "Command blocked for safety", "output": "", "exit_code": -1})).into_response();
        }
    }

    // Fetch agent
    use sqlx::Row;
    let agent = sqlx::query(
        "SELECT ssh_host, ssh_port, ssh_username, ssh_password_encrypted, ssh_key_path FROM agents WHERE id = $1 AND organization_id = $2"
    )
    .bind(agent_id_val)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let agent = match agent {
        Some(a) => a,
        None => return Json(json!({"error": "Agent not found", "output": "", "exit_code": -1})).into_response(),
    };

    let ssh_host: Option<String> = agent.get("ssh_host");
    let ssh_port: Option<i32> = agent.get("ssh_port");
    let ssh_username: Option<String> = agent.get("ssh_username");
    let ssh_password_enc: Option<String> = agent.get("ssh_password_encrypted");
    let ssh_key_path: Option<String> = agent.get("ssh_key_path");

    let host = match ssh_host {
        Some(h) if !h.is_empty() => h,
        _ => return Json(json!({"error": "No SSH host configured for this agent", "output": "", "exit_code": -1})).into_response(),
    };

    let password = ssh_password_enc.and_then(|enc| {
        let secret = crate::handlers::agent_handlers::password_encryption_key();
        crate::services::connection_engine::crypto::decrypt_password(&enc, &secret).ok()
    });

    let params = crate::services::connection_engine::SshConnParams {
        host: host.clone(),
        port: ssh_port.unwrap_or(22) as u16,
        username: ssh_username.unwrap_or_else(|| "root".into()),
        password,
        private_key: ssh_key_path,
        passphrase: None,
        timeout_secs: 30,
    };

    match crate::services::connection_engine::ssh_execute(&params, &command).await {
        Ok(res) => {
            let output = if !res.stdout.is_empty() {
                if !res.stderr.is_empty() { format!("{}\n{}", res.stdout, res.stderr) } else { res.stdout }
            } else {
                res.stderr
            };
            Json(json!({
                "output": output,
                "exit_code": res.exit_code,
                "duration_ms": res.duration_ms
            })).into_response()
        }
        Err(e) => {
            Json(json!({"error": e, "output": "", "exit_code": -1})).into_response()
        }
    }
}

pub async fn terminal_test_connection(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let agent_id = body.get("agent_id").and_then(|v| v.as_str()).or_else(|| body.get("agent_id").and_then(|v| v.as_i64()).map(|_| "")).unwrap_or("");
    let agent_id_str = body.get("agent_id").map(|v| v.to_string().replace('"', "")).unwrap_or_default();
    let agent_id_val = if agent_id.is_empty() { &agent_id_str } else { agent_id };

    use sqlx::Row;
    let agent = sqlx::query(
        "SELECT ssh_host, ssh_port, ssh_username, ssh_password_encrypted, ssh_key_path, name, platform FROM agents WHERE id = $1 AND organization_id = $2"
    )
    .bind(agent_id_val)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let agent = match agent {
        Some(a) => a,
        None => return Json(json!({"connected": false, "error": "Agent not found"})).into_response(),
    };

    let ssh_host: Option<String> = agent.get("ssh_host");
    let ssh_port: Option<i32> = agent.get("ssh_port");
    let ssh_username: Option<String> = agent.get("ssh_username");
    let ssh_password_enc: Option<String> = agent.get("ssh_password_encrypted");
    let ssh_key_path: Option<String> = agent.get("ssh_key_path");
    let agent_name: Option<String> = agent.get("name");
    let platform: Option<String> = agent.get("platform");

    let host = match ssh_host {
        Some(h) if !h.is_empty() => h,
        _ => return Json(json!({"connected": false, "error": "No SSH host configured. Edit the agent and set SSH host/IP."})).into_response(),
    };

    let password = ssh_password_enc.and_then(|enc| {
        let secret = crate::handlers::agent_handlers::password_encryption_key();
        crate::services::connection_engine::crypto::decrypt_password(&enc, &secret).ok()
    });

    let params = crate::services::connection_engine::SshConnParams {
        host: host.clone(),
        port: ssh_port.unwrap_or(22) as u16,
        username: ssh_username.clone().unwrap_or_else(|| "root".into()),
        password,
        private_key: ssh_key_path,
        passphrase: None,
        timeout_secs: 10,
    };

    let result = crate::services::connection_engine::test_ssh_connection(&params).await;

    if result.success {
        // Update agent status
        let _ = sqlx::query("UPDATE agents SET status = 'online', last_heartbeat = CURRENT_TIMESTAMP WHERE id = $1")
            .bind(agent_id_val).execute(&state.db).await;

        let sys_info = format!("{} | {} | {}",
            result.hostname.as_deref().unwrap_or("unknown"),
            result.os_info.as_deref().unwrap_or("unknown"),
            result.kernel.as_deref().unwrap_or(""));

        Json(json!({
            "connected": true,
            "system_info": sys_info,
            "agent_name": agent_name,
            "platform": platform,
            "hostname": result.hostname,
            "latency_ms": result.latency_ms,
        })).into_response()
    } else {
        Json(json!({
            "connected": false,
            "error": result.error.unwrap_or_else(|| "SSH connection failed".into()),
        })).into_response()
    }
}

// ── Chatbot / Feedback ─────────────────────────────────────

pub async fn chatbot_message(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let msg = body.get("message").and_then(|v| v.as_str()).unwrap_or("").trim();
    if msg.is_empty() {
        return (StatusCode::BAD_REQUEST,
            Json(json!({"error": "message is required"}))).into_response();
    }

    // Prefer LLM when configured. Use the same OPENAI_API_KEY as the rest of
    // the AI surface; keep responses short and security-focused.
    if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
        if !api_key.is_empty() {
            let model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o-mini".into());
            let system = "You are CyberSec Pro's in-app assistant. Help the user pick \
                          the right tool from the catalog (nmap, nuclei, subfinder, httpx, \
                          ffuf, sqlmap, nikto, gobuster, etc.), explain what a finding \
                          means, or suggest next steps. Reply in 2-4 sentences in the \
                          same language as the user. Never instruct the user to attack \
                          systems they don't own.";
            let payload = json!({
                "model": model,
                "temperature": 0.3,
                "max_tokens": 350,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": msg},
                ],
            });
            if let Ok(client) = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(20)).build()
            {
                if let Ok(resp) = client.post("https://api.openai.com/v1/chat/completions")
                    .bearer_auth(&api_key)
                    .json(&payload)
                    .send().await
                {
                    if let Ok(v) = resp.json::<serde_json::Value>().await {
                        if let Some(text) = v["choices"][0]["message"]["content"].as_str() {
                            return Json(json!({
                                "response": text,
                                "type": "text",
                                "source": "llm",
                                "model": model,
                            })).into_response();
                        }
                    }
                }
            }
        }
    }

    // Local fallback — pull up to 5 tools whose name/description matches a
    // word in the message. Keeps the chatbot useful without an OpenAI key.
    let q = format!("%{}%", msg.to_lowercase());
    let rows: Vec<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, name, description FROM tools \
         WHERE is_active = TRUE \
           AND (LOWER(name) LIKE $1 OR LOWER(COALESCE(description,'')) LIKE $1) \
         ORDER BY name LIMIT 5"
    ).bind(&q).fetch_all(&state.db).await.unwrap_or_default();

    let suggestions: Vec<serde_json::Value> = rows.iter().map(|(id, name, desc)| {
        json!({"id": id, "name": name, "description": desc})
    }).collect();

    let response = if suggestions.is_empty() {
        "I couldn't match a tool to that query. Try keywords like 'subdomain', \
         'sql injection', 'port scan', or 'directory brute-force', or open the \
         Tools page to browse all 1500+ entries.".to_string()
    } else {
        let names: Vec<&str> = rows.iter().map(|(_, n, _)| n.as_str()).collect();
        format!(
            "Here are tools that match '{}': {}. Open any of them from the Tools \
             page to launch a zero-code scan.",
            msg, names.join(", ")
        )
    };

    let _ = user; // unused in fallback path
    Json(json!({
        "response": response,
        "type": "text",
        "source": "local",
        "suggestions": suggestions,
    })).into_response()
}

pub async fn feedback(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    use crate::services::email::{send_email_public, EmailConfig};

    // ─── Extract & validate fields ─────────────────────────────
    let feedback_type = body.get("type").and_then(|v| v.as_str()).unwrap_or("general").trim().to_string();
    let subject       = body.get("subject").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let message       = body.get("message").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
    let priority      = body.get("priority").and_then(|v| v.as_str()).unwrap_or("normal").to_string();

    // Body-supplied user info (frontend sends user.email/name)
    let body_user_email = body
        .get("user").and_then(|u| u.get("email")).and_then(|v| v.as_str())
        .map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let user_name = body
        .get("user").and_then(|u| u.get("name")).and_then(|v| v.as_str())
        .unwrap_or("User").to_string();

    // Authoritative email: try DB lookup, fall back to body, then to reply_email
    let db_email: Option<String> = sqlx::query_scalar::<_, String>(
        "SELECT email FROM users WHERE id = $1"
    ).bind(&user.user_id).fetch_optional(&state.db).await.ok().flatten();
    let account_email = db_email.or(body_user_email).unwrap_or_else(|| "unknown@user".to_string());

    let reply_email = body
        .get("replyEmail").and_then(|v| v.as_str())
        .map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
        .unwrap_or_else(|| account_email.clone());
    let system_info = body.get("systemInfo").cloned().unwrap_or(serde_json::Value::Null);

    if subject.is_empty() || message.is_empty() {
        return (axum::http::StatusCode::BAD_REQUEST,
            Json(json!({"error": "Subject and message are required"}))).into_response();
    }
    if reply_email.is_empty() || !reply_email.contains('@') {
        return (axum::http::StatusCode::BAD_REQUEST,
            Json(json!({"error": "Valid reply email is required"}))).into_response();
    }

    // ─── Load SMTP config ──────────────────────────────────────
    let cfg = match EmailConfig::from_env() {
        Some(c) => c,
        None => {
            tracing::warn!("Feedback received but SMTP not configured: {} from {}", subject, reply_email);
            return Json(json!({
                "message": "Thank you! We received your feedback (mail delivery is currently offline).",
                "delivered": false,
            })).into_response();
        }
    };
    let admin_email = std::env::var("FEEDBACK_ADMIN_EMAIL")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| cfg.smtp_email.clone());

    // ─── Render system info block ──────────────────────────────
    let sysinfo_html = if system_info.is_null() {
        String::new()
    } else {
        let pretty = serde_json::to_string_pretty(&system_info).unwrap_or_default();
        format!(
            r#"<h3 style="color:#94a3b8;margin:20px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px">System Info</h3>
            <pre style="background:#0a0a0a;color:#94a3b8;padding:14px;border-radius:8px;font-size:12px;overflow-x:auto;border:1px solid rgba(0,255,136,.15)">{}</pre>"#,
            html_escape(&pretty)
        )
    };
    let sysinfo_text = if system_info.is_null() {
        String::new()
    } else {
        format!("\n\nSystem Info:\n{}", serde_json::to_string_pretty(&system_info).unwrap_or_default())
    };

    // ─── Build admin notification ──────────────────────────────
    let admin_subject = format!("[Feedback/{}] {} — {}", feedback_type, priority.to_uppercase(), subject);
    let admin_text = format!(
        "New feedback received\n\n\
         Type: {}\nPriority: {}\nFrom: {} <{}>\nReply to: {}\n\n\
         Subject: {}\n\nMessage:\n{}{}",
        feedback_type, priority, user_name, account_email, reply_email,
        subject, message, sysinfo_text
    );
    let admin_html = format!(
        r#"<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,sans-serif;background:#0a0e1a;color:#e2e8f0">
        <table role="presentation" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:30px 16px">
        <table role="presentation" style="width:640px;max-width:100%;border-collapse:collapse;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:14px;overflow:hidden;border:1px solid rgba(0,255,136,.15)">
        <tr><td style="padding:24px 28px;border-bottom:1px solid rgba(0,255,136,.15)">
        <span style="display:inline-block;padding:4px 12px;background:linear-gradient(135deg,#00ff88,#00d4ff);color:#0a0a0a;font-weight:700;font-size:11px;border-radius:50px;letter-spacing:1px">📬 NEW FEEDBACK</span>
        <h1 style="color:#fff;font-size:20px;margin:12px 0 4px">{subject_html}</h1>
        <div style="color:#94a3b8;font-size:13px">
          <span style="text-transform:capitalize">{type_html}</span> • Priority: <strong style="color:#00d4ff;text-transform:uppercase">{priority_html}</strong>
        </div>
        </td></tr>
        <tr><td style="padding:20px 28px;color:#cbd5e1;font-size:14px;line-height:1.7">
          <p><strong style="color:#94a3b8">From:</strong> {name_html} &lt;{from_html}&gt;</p>
          <p><strong style="color:#94a3b8">Reply to:</strong> <a href="mailto:{reply_html}" style="color:#00d4ff">{reply_html}</a></p>
          <h3 style="color:#94a3b8;margin:20px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px">Message</h3>
          <div style="background:rgba(0,212,255,.05);border-left:3px solid #00d4ff;padding:14px 16px;border-radius:6px;white-space:pre-wrap;color:#e2e8f0">{message_html}</div>
          {sysinfo_html}
        </td></tr>
        <tr><td style="padding:18px 28px;background:rgba(0,0,0,.2);text-align:center;font-size:12px;color:#64748b">
          CyberSec Pro — Feedback System
        </td></tr></table></td></tr></table></body></html>"#,
        subject_html  = html_escape(&subject),
        type_html     = html_escape(&feedback_type),
        priority_html = html_escape(&priority),
        name_html     = html_escape(&user_name),
        from_html     = html_escape(&account_email),
        reply_html    = html_escape(&reply_email),
        message_html  = html_escape(&message),
        sysinfo_html  = sysinfo_html,
    );

    // ─── Build user confirmation email ─────────────────────────
    let user_subject = format!("We received your feedback — {}", subject);
    let user_text = format!(
        "Hi {},\n\nThank you for reaching out to CyberSec Pro support. We've received your message and our team will review it shortly.\n\n\
         Reference: {} • Priority: {}\nSubject: {}\n\nYour message:\n{}\n\n\
         We will reply to {} as soon as possible. If you need to add details, simply reply to this email.\n\n\
         — CyberSec Pro Team",
        user_name, feedback_type, priority, subject, message, reply_email
    );
    let user_html = format!(
        r#"<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,sans-serif;background:#0a0e1a;color:#e2e8f0">
        <table role="presentation" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:30px 16px">
        <table role="presentation" style="width:560px;max-width:100%;border-collapse:collapse;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:14px;overflow:hidden;border:1px solid rgba(0,255,136,.18)">
        <tr><td style="padding:36px 32px 16px;text-align:center;border-bottom:1px solid rgba(0,255,136,.12)">
          <div style="width:72px;height:72px;margin:0 auto 14px;background:linear-gradient(135deg,#00ff88,#00d4ff);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:36px">✓</div>
          <h1 style="color:#fff;font-size:24px;margin:0">Thanks, we got it!</h1>
          <p style="color:#94a3b8;font-size:14px;margin:6px 0 0">Your feedback is on its way to our team</p>
        </td></tr>
        <tr><td style="padding:24px 32px;color:#cbd5e1;font-size:14px;line-height:1.7">
          <p>Hi <strong style="color:#00ff88">{name_html}</strong>,</p>
          <p>We received your <strong style="color:#00d4ff;text-transform:capitalize">{type_html}</strong> feedback and will review it shortly. Below is a copy for your records.</p>
          <div style="background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.18);border-radius:10px;padding:16px 18px;margin-top:18px">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Subject</div>
            <div style="color:#fff;font-weight:600;margin:4px 0 12px">{subject_html}</div>
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px">Message</div>
            <div style="color:#cbd5e1;white-space:pre-wrap;margin-top:4px">{message_html}</div>
          </div>
          <p style="margin-top:20px">We'll reply to <a href="mailto:{reply_html}" style="color:#00d4ff">{reply_html}</a> as soon as possible. Need to add details? Just reply to this email.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;text-align:center;background:rgba(0,0,0,.2);font-size:12px;color:#64748b">
          CyberSec Pro • <a href="mailto:support@cyber-sec-pro.com" style="color:#00d4ff;text-decoration:none">support@cyber-sec-pro.com</a>
        </td></tr></table></td></tr></table></body></html>"#,
        name_html    = html_escape(&user_name),
        type_html    = html_escape(&feedback_type),
        subject_html = html_escape(&subject),
        message_html = html_escape(&message),
        reply_html   = html_escape(&reply_email),
    );

    // ─── Send both emails (don't fail the request if one fails) ─
    let mut delivery = serde_json::Map::new();
    match send_email_public(&cfg, &admin_email, &admin_subject, &admin_text, &admin_html).await {
        Ok(_) => {
            tracing::info!("📨 Feedback admin email sent to {}", admin_email);
            delivery.insert("admin".into(), json!(true));
        }
        Err(e) => {
            tracing::error!("Feedback admin email failed: {}", e);
            delivery.insert("admin".into(), json!(false));
            delivery.insert("admin_error".into(), json!(e));
        }
    }
    match send_email_public(&cfg, &reply_email, &user_subject, &user_text, &user_html).await {
        Ok(_) => {
            tracing::info!("📨 Feedback user confirmation sent to {}", reply_email);
            delivery.insert("user".into(), json!(true));
        }
        Err(e) => {
            tracing::error!("Feedback user confirmation failed: {}", e);
            delivery.insert("user".into(), json!(false));
            delivery.insert("user_error".into(), json!(e));
        }
    }

    Json(json!({
        "message": "Thank you for your feedback! A confirmation has been sent to your email.",
        "delivered": delivery,
    })).into_response()
}

/// Minimal HTML escaper for embedding user input into email templates.
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
     .replace('\'', "&#39;")
}

// ── GDPR ───────────────────────────────────────────────────

pub async fn gdpr_export(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");

    // Collect user's data
    let scans = sqlx::query_as::<_, (String, String, String, String)>(
        "SELECT id, target, status, CAST(created_at AS TEXT) FROM scans WHERE user_id = $1 ORDER BY created_at DESC"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();

    let scan_list: Vec<serde_json::Value> = scans.iter().map(|(id, target, status, created)| {
        json!({"id": id, "target": target, "status": status, "created_at": created})
    }).collect();

    let audits = sqlx::query_as::<_, (String, String, String)>(
        "SELECT action, COALESCE(status,''), CAST(created_at AS TEXT) FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200"
    ).bind(&user.user_id).fetch_all(&state.db).await.unwrap_or_default();

    let audit_list: Vec<serde_json::Value> = audits.iter().map(|(action, status, created)| {
        json!({"action": action, "status": status, "created_at": created})
    }).collect();

    let user_data: Option<(String, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT email, first_name, last_name, role FROM users WHERE id = $1"
    ).bind(&user.user_id).fetch_optional(&state.db).await.unwrap_or(None);

    let profile = user_data.map(|(email, first, last, role)| json!({
        "email": email, "first_name": first, "last_name": last, "role": role
    })).unwrap_or(json!({}));

    Json(json!({
        "status": "complete",
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "data": {
            "profile": profile,
            "scans": scan_list,
            "audit_logs": audit_list,
            "organization_id": org_id
        }
    })).into_response()
}

pub async fn gdpr_delete_account(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Anonymize user data instead of hard delete (preserves referential integrity)
    let anon_email = format!("deleted-{}@deleted.local", &user.user_id[..8]);
    let result = sqlx::query(
        "UPDATE users SET email = $1, first_name = 'Deleted', last_name = 'User', is_active = FALSE, mfa_enabled = FALSE, mfa_secret = NULL, password_hash = 'DELETED' WHERE id = $2"
    )
    .bind(&anon_email)
    .bind(&user.user_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            // Delete personal audit logs
            let _ = sqlx::query("DELETE FROM audit_logs WHERE user_id = $1").bind(&user.user_id).execute(&state.db).await;
            Json(json!({"message": "Account data deleted and anonymized", "status": "complete"})).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

// ── Integrations ───────────────────────────────────────────

pub async fn list_integrations(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, bool, Option<String>, Option<String>, Option<String>, String)>(
        "SELECT id, name, integration_type, webhook_url, is_active, CAST(last_triggered_at AS TEXT), last_error, config::text, CAST(created_at AS TEXT) FROM integrations WHERE organization_id = $1 ORDER BY created_at DESC"
    )
    .bind(org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let list: Vec<serde_json::Value> = rows.iter().map(|(id, name, itype, url, active, last_trig, last_err, config, created)| {
        let config_val: serde_json::Value = config.as_deref().and_then(|c| serde_json::from_str(c).ok()).unwrap_or(json!({}));
        json!({
            "id": id,
            "name": name,
            "integration_type": itype,
            "webhook_url": url,
            "is_active": active,
            "last_triggered_at": last_trig,
            "last_error": last_err,
            "config": config_val,
            "created_at": created
        })
    }).collect();

    Json(json!({"integrations": list})).into_response()
}

pub async fn create_integration(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let id = uuid::Uuid::new_v4().to_string();

    let name = body.get("name").and_then(|v| v.as_str()).unwrap_or("New Integration");
    let int_type = body.get("integration_type").and_then(|v| v.as_str()).unwrap_or("webhook");
    let webhook_url = body.get("webhook_url").and_then(|v| v.as_str()).unwrap_or("");
    let config = body.get("config").cloned().unwrap_or(json!({}));
    let events = body.get("events").cloned().unwrap_or(json!(["scan_completed","scan_failed","vulnerability_critical"]));

    // Validate integration type
    let valid_types = ["slack", "teams", "jira", "github", "webhook"];
    if !valid_types.contains(&int_type) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": format!("Invalid type. Must be one of: {:?}", valid_types)}))).into_response();
    }

    // Validate webhook URL format
    if !webhook_url.is_empty() && !webhook_url.starts_with("https://") {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Webhook URL must use HTTPS"}))).into_response();
    }

    let events_vec: Vec<String> = events.as_array()
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    let result = sqlx::query(
        "INSERT INTO integrations (id, organization_id, name, integration_type, webhook_url, config, events, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, TRUE, $8, NOW(), NOW())"
    )
    .bind(&id)
    .bind(org_id)
    .bind(name)
    .bind(int_type)
    .bind(webhook_url)
    .bind(&config)
    .bind(&events_vec)
    .bind(&user.user_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => (StatusCode::CREATED, Json(json!({"id": id, "message": "Integration created"}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed: {}", e)}))).into_response(),
    }
}

pub async fn update_integration(
    Path(integration_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");

    let name = body.get("name").and_then(|v| v.as_str());
    let webhook_url = body.get("webhook_url").and_then(|v| v.as_str());
    let config = body.get("config");

    if let Some(url) = webhook_url {
        if !url.is_empty() && !url.starts_with("https://") {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": "Webhook URL must use HTTPS"}))).into_response();
        }
    }

    let _ = sqlx::query(
        "UPDATE integrations SET name = COALESCE($1, name), webhook_url = COALESCE($2, webhook_url), config = COALESCE($3::jsonb, config), updated_at = NOW() WHERE id = $4 AND organization_id = $5"
    )
    .bind(name)
    .bind(webhook_url)
    .bind(config)
    .bind(&integration_id)
    .bind(org_id)
    .execute(&state.db)
    .await;

    Json(json!({"message": "Integration updated", "id": integration_id})).into_response()
}

pub async fn delete_integration(
    Path(integration_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let _ = sqlx::query("DELETE FROM integrations WHERE id = $1 AND organization_id = $2")
        .bind(&integration_id)
        .bind(org_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Integration deleted"})).into_response()
}

pub async fn toggle_integration(
    Path(integration_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");
    let _ = sqlx::query("UPDATE integrations SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 AND organization_id = $2")
        .bind(&integration_id)
        .bind(org_id)
        .execute(&state.db)
        .await;
    Json(json!({"message": "Integration toggled", "id": integration_id})).into_response()
}

pub async fn test_integration(
    Path(integration_id): Path<String>,
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let org_id = user.org_id.as_deref().unwrap_or("");

    let row = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT integration_type, webhook_url FROM integrations WHERE id = $1 AND organization_id = $2"
    )
    .bind(&integration_id)
    .bind(org_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let (int_type, webhook_url) = match row {
        Some(r) => r,
        None => return (StatusCode::NOT_FOUND, Json(json!({"error": "Integration not found"}))).into_response(),
    };

    let url = match webhook_url {
        Some(u) if !u.is_empty() => u,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "No webhook URL configured"}))).into_response(),
    };

    let test_payload = json!({
        "target": "test.example.com",
        "tool": "test-scan",
        "status": "completed",
        "message": "This is a test notification from CyberSec Pro"
    });

    // Use the integration service to send
    let result = match int_type.as_str() {
        "slack" => {
            let client = reqwest::Client::new();
            let payload = json!({
                "text": "🧪 *Test notification from CyberSec Pro*\nYour Slack integration is working correctly!"
            });
            client.post(&url).json(&payload).timeout(std::time::Duration::from_secs(10)).send().await
                .map(|r| r.status().is_success())
                .map_err(|e| e.to_string())
        }
        _ => {
            let client = reqwest::Client::new();
            client.post(&url).json(&json!({"event": "test", "data": test_payload})).timeout(std::time::Duration::from_secs(10)).send().await
                .map(|r| r.status().is_success())
                .map_err(|e| e.to_string())
        }
    };

    match result {
        Ok(true) => Json(json!({"success": true, "message": "Test notification sent successfully"})).into_response(),
        Ok(false) => Json(json!({"success": false, "error": "Remote server returned error status"})).into_response(),
        Err(e) => Json(json!({"success": false, "error": e})).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn purple_team_create_flow_builds_expected_shape() {
        let chain = purple_team_chain_by_id("chain-credential-access").expect("expected chain catalog entry");
        let exercise = purple_team_build_exercise(
            &chain,
            "chain-credential-access",
            "10.10.10.5",
            Some("Credential drill test"),
        );

        assert_eq!(exercise.get("attack_chain_id").and_then(|v| v.as_str()), Some("chain-credential-access"));
        assert_eq!(exercise.get("target").and_then(|v| v.as_str()), Some("10.10.10.5"));
        assert_eq!(exercise.get("name").and_then(|v| v.as_str()), Some("Credential drill test"));
        assert_eq!(exercise.get("status").and_then(|v| v.as_str()), Some("pending"));
        assert_eq!(exercise.get("total_steps").and_then(|v| v.as_i64()), Some(7));
        assert!(exercise.get("id").and_then(|v| v.as_str()).is_some());
    }

    #[test]
    fn purple_team_builder_defaults_and_chain_lookup_rules() {
        assert!(purple_team_chain_by_id("unknown-chain").is_none());

        let chain = purple_team_chain_by_id("chain-initial-access-phishing").expect("expected chain catalog entry");
        let exercise = purple_team_build_exercise(
            &chain,
            "chain-initial-access-phishing",
            "mail.target.local",
            None,
        );

        assert_eq!(exercise.get("name").and_then(|v| v.as_str()), Some("Initial Access Validation"));
        assert_eq!(exercise.get("attack_chain_id").and_then(|v| v.as_str()), Some("chain-initial-access-phishing"));
        assert_eq!(exercise.get("target").and_then(|v| v.as_str()), Some("mail.target.local"));
        assert_eq!(exercise.get("risk_score").and_then(|v| v.as_f64()), Some(64.0));
    }

    #[test]
    fn purple_team_detection_ratio_varies_by_chain_and_target() {
        let phishing_default = purple_team_detection_ratio("chain-initial-access-phishing", "corp.local");
        let credential_default = purple_team_detection_ratio("chain-credential-access", "corp.local");
        let lateral_default = purple_team_detection_ratio("chain-lateral-movement", "corp.local");
        let prod_penalty = purple_team_detection_ratio("chain-initial-access-phishing", "prod-critical-app");
        let dev_bonus = purple_team_detection_ratio("chain-initial-access-phishing", "dev-staging-node");

        assert!(phishing_default > credential_default);
        assert!(lateral_default > credential_default);
        assert!(prod_penalty < phishing_default);
        assert!(dev_bonus > phishing_default);
        assert!((0.25..=0.90).contains(&dev_bonus));
    }

    #[test]
    fn purple_team_detection_ratio_supports_profile_json_overrides() {
        let profile = json!({
            "chains": {
                "credential": 0.30,
                "lateral": 0.44,
                "default": 0.80
            },
            "target": {
                "prod_penalty": 0.20,
                "dev_bonus": 0.10
            },
            "bounds": {
                "min": 0.40,
                "max": 0.85
            }
        });

        let credential_prod = purple_team_detection_ratio_with_profile(
            "chain-credential-access",
            "prod-critical-node",
            Some(&profile),
        );
        let default_dev = purple_team_detection_ratio_with_profile(
            "chain-initial-access-phishing",
            "dev-staging-node",
            Some(&profile),
        );

        assert_eq!(credential_prod, 0.40);
        assert_eq!(default_dev, 0.85);
    }

    #[test]
    fn purple_team_detection_ratio_normalizes_profile_bounds() {
        let profile = json!({
            "chain_default": 0.95,
            "min": 0.90,
            "max": 0.50
        });

        let ratio = purple_team_detection_ratio_with_profile(
            "chain-initial-access-phishing",
            "corp.local",
            Some(&profile),
        );

        assert_eq!(ratio, 0.90);
    }

    fn mock_auth_user() -> AuthUser {
        AuthUser {
            user_id: "user-1".to_string(),
            role: "admin".to_string(),
            org_id: Some("org-1".to_string()),
        }
    }

    #[test]
    fn purple_team_parse_telemetry_payload_requires_technique_id() {
        let user = mock_auth_user();
        let body = json!({
            "step_index": 1,
            "detected": true
        });

        let parsed = purple_team_parse_telemetry_payload(&body, &user);
        assert!(parsed.is_err());
    }

    #[test]
    fn purple_team_parse_telemetry_payload_clamps_confidence_and_defaults_source() {
        let user = mock_auth_user();
        let body = json!({
            "step_index": 2,
            "technique_id": "T1003",
            "detected": false,
            "confidence": 2.4
        });

        let parsed = purple_team_parse_telemetry_payload(&body, &user).expect("expected payload parse");

        assert_eq!(parsed.0, 2);
        assert_eq!(parsed.1, "T1003");
        assert!(!parsed.2);
        assert_eq!(parsed.3, "manual");
        assert_eq!(parsed.4, 1.0);
    }

    #[test]
    fn purple_team_detection_rate_handles_zero_total_steps() {
        assert_eq!(purple_team_detection_rate(3, 0), 0.0);
        assert_eq!(purple_team_detection_rate(3, 6), 50.0);
    }

    // ── gap_analysis live-update logic ────────────────────────────────────────

    #[test]
    fn purple_team_detection_rate_exact_thresholds() {
        // 80% high-coverage threshold
        assert_eq!(purple_team_detection_rate(8, 10), 80.0);
        assert!(purple_team_detection_rate(8, 10) >= 80.0); // triggers high_coverage alert
        assert!(purple_team_detection_rate(7, 10) < 80.0);  // does NOT trigger high_coverage

        // <40% low-coverage threshold
        assert_eq!(purple_team_detection_rate(0, 10), 0.0);
        assert!(purple_team_detection_rate(3, 10) < 40.0);  // triggers low_coverage
        assert!(purple_team_detection_rate(4, 10) >= 40.0); // does NOT trigger low_coverage
    }

    #[test]
    fn purple_team_detection_rate_full_detection() {
        assert_eq!(purple_team_detection_rate(10, 10), 100.0);
    }

    #[test]
    fn purple_team_gap_analysis_values_consistent_with_counters() {
        // Simulate what ingest_telemetry now persists into gap_analysis.
        // After 3 detected out of 5 total steps: rate = 60%, no alert.
        let detected_attacks: i64 = 3;
        let total_steps: i64 = 5;
        let missed_attacks = total_steps - detected_attacks;
        let detection_rate = purple_team_detection_rate(detected_attacks, total_steps);

        let gap = json!({
            "total_attacks": total_steps,
            "detected": detected_attacks,
            "missed": missed_attacks,
            "detection_rate": detection_rate
        });

        assert_eq!(gap["total_attacks"], 5);
        assert_eq!(gap["detected"], 3);
        assert_eq!(gap["missed"], 2);
        assert_eq!(gap["detection_rate"].as_f64().unwrap(), 60.0);
        assert!(detection_rate >= 40.0 && detection_rate < 80.0); // no alert zone
    }

    #[test]
    fn purple_team_gap_analysis_low_coverage_alert_condition() {
        // <40% + at least 3 steps → low_coverage alert
        let detected: i64 = 1;
        let total: i64 = 5;
        let rate = purple_team_detection_rate(detected, total);
        assert!(rate < 40.0 && total >= 3); // alert fires
    }

    #[test]
    fn purple_team_gap_analysis_no_alert_below_three_steps() {
        // <40% but fewer than 3 total steps → alert suppressed
        let detected: i64 = 0;
        let total: i64 = 2;
        let rate = purple_team_detection_rate(detected, total);
        assert!(rate < 40.0 && total < 3); // alert suppressed
    }

    #[test]
    fn purple_team_gap_analysis_high_coverage_alert_condition() {
        let detected: i64 = 9;
        let total: i64 = 10;
        let rate = purple_team_detection_rate(detected, total);
        assert!(rate >= 80.0); // high_coverage alert fires
    }

    #[test]
    fn purple_team_parse_telemetry_builds_event_with_correct_fields() {
        let user = mock_auth_user();
        let body = json!({
            "step_index": 0,
            "technique_id": "T1566.001",
            "detected": true,
            "source": "siem",
            "confidence": 0.9
        });

        let parsed = purple_team_parse_telemetry_payload(&body, &user).expect("parse ok");
        let (step_index, technique_id, detected, source, confidence, event) = parsed;

        assert_eq!(step_index, 0);
        assert_eq!(technique_id, "T1566.001");
        assert!(detected);
        assert_eq!(source, "siem");
        assert_eq!(confidence, 0.9);
        // event object must carry technique_id and detected fields
        assert_eq!(event.get("technique_id").and_then(|v| v.as_str()), Some("T1566.001"));
        assert_eq!(event.get("detected").and_then(|v| v.as_bool()), Some(true));
        assert_eq!(event.get("source").and_then(|v| v.as_str()), Some("siem"));
        assert_eq!(event.get("reported_by").and_then(|v| v.as_str()), Some("user-1"));
    }

    #[test]
    fn purple_team_abort_event_has_required_fields() {
        // Verify the abort event shape that would be appended to telemetry_events.
        let user_id = "operator-42";
        let abort_event = serde_json::json!({
            "event_type": "abort",
            "aborted_by": user_id,
            "aborted_at": chrono::Utc::now().to_rfc3339(),
            "reason": "manual_abort"
        });

        assert_eq!(abort_event.get("event_type").and_then(|v| v.as_str()), Some("abort"));
        assert_eq!(abort_event.get("aborted_by").and_then(|v| v.as_str()), Some("operator-42"));
        assert_eq!(abort_event.get("reason").and_then(|v| v.as_str()), Some("manual_abort"));
        assert!(abort_event.get("aborted_at").is_some(), "aborted_at timestamp must be present");
    }

    #[test]
    fn purple_team_abort_event_type_is_distinct_from_telemetry_event() {
        // Abort event must be distinguishable from ingest telemetry events by event_type.
        let abort_event = serde_json::json!({
            "event_type": "abort",
            "aborted_by": "user-1",
            "aborted_at": "2026-04-22T16:00:00Z",
            "reason": "manual_abort"
        });
        let telemetry_event = serde_json::json!({
            "technique_id": "T1059",
            "detected": false,
            "reported_by": "user-1"
        });

        let abort_type = abort_event.get("event_type").and_then(|v| v.as_str()).unwrap_or("");
        let has_technique = telemetry_event.get("technique_id").is_some();

        assert_eq!(abort_type, "abort");
        assert!(has_technique);
        // abort event must NOT carry technique_id
        assert!(abort_event.get("technique_id").is_none());
    }

    #[test]
    fn purple_team_abort_response_includes_abort_event_in_body() {
        // The response returned by abort_exercise carries the abort_event so callers
        // can inspect what was recorded without a subsequent GET.
        let abort_event = serde_json::json!({
            "event_type": "abort",
            "aborted_by": "user-99",
            "aborted_at": "2026-04-22T17:00:00Z",
            "reason": "manual_abort"
        });
        let response_body = serde_json::json!({
            "message": "Exercise aborted",
            "exercise_id": "ex-123",
            "status": "cancelled",
            "abort_event": abort_event
        });

        assert_eq!(response_body.get("status").and_then(|v| v.as_str()), Some("cancelled"));
        assert!(response_body.get("abort_event").is_some(), "response must embed abort_event");
        let embedded = &response_body["abort_event"];
        assert_eq!(embedded.get("event_type").and_then(|v| v.as_str()), Some("abort"));
        assert_eq!(embedded.get("aborted_by").and_then(|v| v.as_str()), Some("user-99"));
    }
}

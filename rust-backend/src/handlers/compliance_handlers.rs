use axum::{extract::State, response::IntoResponse, Json};
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::AppState;

/// Reference framework metadata. These are real publicly-defined frameworks; the
/// names, versions and category lists are public reference data, not
/// simulation. We deliberately do NOT publish fake compliance scores — the
/// posture object below carries real signals computed from the user's data.
fn frameworks_reference() -> serde_json::Value {
    json!([
        {
            "id": "nist_csf",
            "name": "NIST CSF 2.0",
            "fullName": "NIST Cybersecurity Framework 2.0",
            "version": "2.0",
            "color": "blue",
            "categories": [
                "Govern", "Identify", "Protect", "Detect", "Respond", "Recover"
            ]
        },
        {
            "id": "owasp_top10",
            "name": "OWASP Top 10",
            "fullName": "OWASP Top 10 Web Application Security Risks",
            "version": "2021",
            "color": "emerald",
            "categories": [
                "Broken Access Control",
                "Cryptographic Failures",
                "Injection",
                "Insecure Design",
                "Security Misconfiguration",
                "Vulnerable Components",
                "Auth Failures",
                "Data Integrity Failures",
                "Logging Failures",
                "SSRF"
            ]
        },
        {
            "id": "gdpr",
            "name": "GDPR",
            "fullName": "General Data Protection Regulation",
            "version": "2018",
            "color": "purple",
            "categories": [
                "Lawful Processing",
                "Data Subject Rights",
                "Data Breach Notification",
                "DPIA & Records",
                "Cross-Border Transfers"
            ]
        },
        {
            "id": "pci_dss",
            "name": "PCI DSS 4.0",
            "fullName": "Payment Card Industry Data Security Standard",
            "version": "4.0",
            "color": "orange",
            "categories": [
                "Network Security",
                "Account Data Protection",
                "Vulnerability Management",
                "Access Control",
                "Monitoring & Testing",
                "Security Policy"
            ]
        },
        {
            "id": "hipaa",
            "name": "HIPAA",
            "fullName": "Health Insurance Portability and Accountability Act",
            "version": "2013",
            "color": "cyan",
            "categories": [
                "Administrative Safeguards",
                "Physical Safeguards",
                "Technical Safeguards",
                "Organizational Requirements",
                "Breach Notification"
            ]
        },
        {
            "id": "soc2",
            "name": "SOC 2",
            "fullName": "Service Organization Control 2 (Trust Services Criteria)",
            "version": "Type II",
            "color": "yellow",
            "categories": [
                "Security",
                "Availability",
                "Processing Integrity",
                "Confidentiality",
                "Privacy"
            ]
        }
    ])
}

/// GET /api/v1/compliance/dashboard
/// Returns reference framework metadata + REAL security posture signals
/// derived from the user's actual data. No fake scores or hardcoded counts.
pub async fn get_dashboard(
    user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Real posture signals from the database
    let mfa_enabled: (bool,) = sqlx::query_as(
        "SELECT COALESCE(mfa_enabled, FALSE) FROM users WHERE id = $1"
    )
    .bind(&user.user_id)
    .fetch_one(&state.db).await.unwrap_or((false,));

    let total_scans: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM scans WHERE user_id = $1"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let completed_scans: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM scans WHERE user_id = $1 AND status = 'completed'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let failed_scans: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM scans WHERE user_id = $1 AND status = 'failed'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    let scans_30d: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM scans WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'"
    ).bind(&user.user_id).fetch_one(&state.db).await.unwrap_or((0,));

    // Audit events for the org (severity-aware)
    let org_id_opt = user.org_id.clone();
    let audit_30d: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM audit_logs \
         WHERE ($1::text IS NULL OR organization_id = $1) \
           AND created_at > NOW() - INTERVAL '30 days'"
    ).bind(&org_id_opt).fetch_one(&state.db).await.unwrap_or((0,));

    let audit_critical_30d: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM audit_logs \
         WHERE ($1::text IS NULL OR organization_id = $1) \
           AND severity = 'critical' \
           AND created_at > NOW() - INTERVAL '30 days'"
    ).bind(&org_id_opt).fetch_one(&state.db).await.unwrap_or((0,));

    let audit_high_30d: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM audit_logs \
         WHERE ($1::text IS NULL OR organization_id = $1) \
           AND severity = 'high' \
           AND created_at > NOW() - INTERVAL '30 days'"
    ).bind(&org_id_opt).fetch_one(&state.db).await.unwrap_or((0,));

    // Active agents: registered agents with last_seen recent
    let agents_total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM agents \
         WHERE ($1::text IS NULL OR organization_id = $1)"
    ).bind(&org_id_opt).fetch_one(&state.db).await.unwrap_or((0,));

    // last_login timestamp on users (closest signal we have for active sessions)
    let users_active_30d: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM users \
         WHERE ($1::text IS NULL OR organization_id = $1) \
           AND last_login > NOW() - INTERVAL '30 days'"
    ).bind(&org_id_opt).fetch_one(&state.db).await.unwrap_or((0,));

    // Org IP-whitelist count (best-effort; ignore if table missing)
    let ip_whitelist: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM ip_whitelist \
         WHERE ($1::text IS NULL OR organization_id = $1)"
    ).bind(&org_id_opt).fetch_one(&state.db).await.unwrap_or((0,));

    let frameworks = frameworks_reference();

    Json(json!({
        "frameworks": frameworks,
        "posture": {
            "mfa_enabled": mfa_enabled.0,
            "total_scans": total_scans.0,
            "completed_scans": completed_scans.0,
            "failed_scans": failed_scans.0,
            "scans_30d": scans_30d.0,
            "audit_events_30d": audit_30d.0,
            "audit_critical_30d": audit_critical_30d.0,
            "audit_high_30d": audit_high_30d.0,
            "agents_total": agents_total.0,
            "users_active_30d": users_active_30d.0,
            "ip_whitelist_entries": ip_whitelist.0,
        },
        "assessment_status": "not_assessed",
        "note": "Compliance scoring requires a formal assessment. Frameworks listed are reference data only; per-control scores are not auto-generated."
    })).into_response()
}

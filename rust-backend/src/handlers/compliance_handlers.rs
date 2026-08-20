use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value as JsonValue};
use std::sync::Arc;

use crate::middleware::auth_middleware::AuthUser;
use crate::AppState;

/// GET /api/v1/consent — list the caller's consent records (GDPR Art. 15,
/// PIPEDA accountability, CCPA/CPRA "right to know").
pub async fn list_consent_records(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, String, Option<String>, Option<String>)>(
        "SELECT purpose, category, status, version, CAST(recorded_at AS TEXT), CAST(withdrawn_at AS TEXT), ip_address \
         FROM consent_records WHERE user_id = $1 ORDER BY recorded_at DESC"
    )
    .bind(&auth.user_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let consents: Vec<JsonValue> = rows.iter().map(|(p, c, s, v, rec, wit, ip)| json!({
        "purpose": p,
        "category": c,
        "status": s,
        "version": v,
        "recorded_at": rec,
        "withdrawn_at": wit,
        "ip_address": ip,
    })).collect();

    Json(json!({
        "consents": consents,
        "total": consents.len(),
    })).into_response()
}

#[derive(Deserialize)]
pub struct WithdrawConsentRequest {
    pub purpose: String,
}

/// POST /api/v1/consent/withdraw — withdraw consent for a purpose
/// (CCPA/CPRA right to opt-out, PIPEDA consent withdrawal). Immediate effect.
pub async fn withdraw_consent(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<WithdrawConsentRequest>,
) -> impl IntoResponse {
    let purpose = body.purpose.trim().to_lowercase();
    if purpose.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "purpose is required"}))).into_response();
    }

    let result = sqlx::query(
        "UPDATE consent_records SET status = 'withdrawn', withdrawn_at = NOW() \
         WHERE user_id = $1 AND LOWER(purpose) = $2 AND status IN ('active', 'granted')"
    )
    .bind(&auth.user_id)
    .bind(&purpose)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) => {
            if r.rows_affected() == 0 {
                return (StatusCode::NOT_FOUND, Json(json!({"error": "No active consent found for this purpose"}))).into_response();
            }
            let _ = crate::services::audit::log_audit(
                &state.db, "consent.withdraw", "consent", "info",
                None, None,
                Some(json!({"purpose": purpose, "user_id": auth.user_id})),
                Some("user"), None, "success", None,
            ).await;
            Json(json!({
                "ok": true,
                "message": "Consent withdrawn",
                "purpose": purpose,
                "status": "withdrawn",
                "withdrawn_at": chrono::Utc::now().to_rfc3339(),
            })).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

/// GET /api/v1/compliance/frameworks
pub async fn list_frameworks(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
) -> impl IntoResponse {
    match crate::services::compliance_mapper::list_frameworks(&state.db).await {
        Ok(frameworks) => {
            let total: i32 = frameworks.iter().map(|f| f.total_controls).sum();
            let tools: i32 = frameworks.iter().map(|f| f.mapped_tools).sum::<i32>() / frameworks.len().max(1) as i32;
            Json(json!({
                "frameworks": frameworks.iter().map(|f| json!({
                    "id": f.framework.id,
                    "name": f.framework.name,
                    "short_name": f.framework.short_name,
                    "version": f.framework.version,
                    "description": f.framework.description,
                    "category": f.framework.category,
                    "total_controls": f.total_controls,
                    "mapped_tools": f.mapped_tools,
                })).collect::<Vec<_>>(),
                "total_frameworks": frameworks.len(),
                "total_controls": total,
            })).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

/// GET /api/v1/compliance/frameworks/:framework_id
pub async fn get_framework_controls(
    State(state): State<Arc<AppState>>,
    _auth: AuthUser,
    Path(framework_id): Path<String>,
) -> impl IntoResponse {
    match crate::services::compliance_mapper::get_framework_controls(&state.db, &framework_id).await {
        Ok(controls) => Json(json!({
            "framework_id": framework_id,
            "controls": controls.iter().map(|c| json!({
                "control_id": c.control.control_id,
                "title": c.control.title,
                "description": c.control.description,
                "category": c.control.category,
                "subcategory": c.control.subcategory,
                "severity": c.control.severity,
                "mapped_tools": c.mapped_tools,
                "recent_scans": c.scan_results.len(),
            })).collect::<Vec<_>>(),
            "total_controls": controls.len(),
        })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

/// GET /api/v1/compliance/posture
pub async fn get_posture(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    match crate::services::compliance_mapper::get_org_posture(&state.db, &org_id).await {
        Ok(postures) => Json(json!({
            "organization_id": org_id,
            "frameworks": postures,
            "total_frameworks": postures.len(),
        })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

/// POST /api/v1/compliance/frameworks/:framework_id/assess
pub async fn assess_framework(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(framework_id): Path<String>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());
    match crate::services::compliance_mapper::assess_posture(&state.db, &org_id, &framework_id).await {
        Ok(result) => Json(result).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

/// GET /api/v1/compliance/frameworks/:framework_id/gap-analysis
pub async fn gap_analysis(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Path(framework_id): Path<String>,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());

    // Get all controls
    let controls: Vec<(String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT control_id, title, category, severity FROM compliance_controls WHERE framework_id = $1 ORDER BY control_id"
    )
    .bind(&framework_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // Get tools for this org that have scans
    let org_tools: Vec<(String, String)> = sqlx::query_as(
        "SELECT DISTINCT t.id, t.name FROM tools t \
         JOIN scans s ON s.tool_id = t.id \
         WHERE s.organization_id = $1 AND s.status = 'completed'"
    )
    .bind(&org_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let tool_ids: Vec<String> = org_tools.iter().map(|(id, _)| id.clone()).collect();

    let mut gaps = Vec::new();
    let mut covered = Vec::new();

    for (ctrl_id, title, category, severity) in &controls {
        let has_mapping: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM compliance_mappings WHERE control_id IN \
             (SELECT id FROM compliance_controls WHERE framework_id = $1 AND control_id = $2)"
        )
        .bind(&framework_id)
        .bind(ctrl_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or((0,));

        if has_mapping.0 == 0 {
            gaps.push(json!({
                "control_id": ctrl_id,
                "title": title,
                "category": category,
                "severity": severity,
                "reason": "no_tool_mapping",
            }));
        } else if !tool_ids.is_empty() {
            let has_scan: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM scans s JOIN tools t ON s.tool_id = t.id \
                 JOIN compliance_mappings cm ON cm.tool_id = t.id \
                 JOIN compliance_controls cc ON cm.control_id = cc.id \
                 WHERE cc.framework_id = $1 AND cc.control_id = $2 AND s.organization_id = $3 AND s.status = 'completed'"
            )
            .bind(&framework_id)
            .bind(ctrl_id)
            .bind(&org_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or((0,));

            if has_scan.0 == 0 {
                gaps.push(json!({
                    "control_id": ctrl_id,
                    "title": title,
                    "category": category,
                    "severity": severity,
                    "reason": "not_scanned",
                }));
            } else {
                covered.push(json!({
                    "control_id": ctrl_id,
                    "title": title,
                    "category": category,
                }));
            }
        } else {
            gaps.push(json!({
                "control_id": ctrl_id,
                "title": title,
                "category": category,
                "severity": severity,
                "reason": "no_scans_performed",
            }));
        }
    }

    Json(json!({
        "framework_id": framework_id,
        "total_controls": controls.len(),
        "covered": covered.len(),
        "gaps": gaps.len(),
        "gap_items": gaps,
        "covered_items": covered,
    }))
}


/// GET /api/v1/compliance/dashboard
pub async fn get_dashboard(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
) -> impl IntoResponse {
    let org_id = auth.org_id.clone().unwrap_or_else(|| auth.user_id.clone());

    let frameworks: Vec<(String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, name, short_name, version FROM compliance_frameworks WHERE is_active = true ORDER BY name"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let posture_data: Vec<JsonValue> = match crate::services::compliance_mapper::get_org_posture(&state.db, &org_id).await {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("get_org_posture failed for org {}: {}", org_id, e);
            vec![]
        }
    };

    let recent_scans: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM scans WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '30 days'"
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

    Json(json!({
        "frameworks": frameworks.iter().map(|(id, name, short, ver)| json!({
            "id": id, "name": name, "short_name": short, "version": ver
        })).collect::<Vec<_>>(),
        "posture": posture_data,
        "stats": {
            "total_frameworks": frameworks.len(),
            "recent_scans": recent_scans.0,
            "total_scans": total_scans.0,
        },
    }))
}

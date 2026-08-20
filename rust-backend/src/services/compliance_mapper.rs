use sqlx::PgPool;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ComplianceFramework {
    pub id: String,
    pub name: String,
    pub short_name: String,
    pub version: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ComplianceControl {
    pub id: String,
    pub framework_id: String,
    pub control_id: String,
    pub title: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub subcategory: Option<String>,
    pub severity: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ComplianceMapping {
    pub id: String,
    pub control_id: String,
    pub tool_id: String,
    pub coverage_type: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ScanComplianceResult {
    pub id: String,
    pub scan_id: String,
    pub control_id: String,
    pub status: String,
    pub finding: Option<String>,
    pub severity: Option<String>,
    pub remediation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct CompliancePosture {
    pub id: String,
    pub organization_id: String,
    pub framework_id: String,
    pub total_controls: i64,
    pub passed: i64,
    pub failed: i64,
    pub partial: i64,
    pub untested: i64,
    pub score_pct: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct FrameworkSummary {
    pub framework: ComplianceFramework,
    pub total_controls: i64,
    pub mapped_tools: i64,
}

#[derive(Debug, Serialize)]
pub struct ControlDetail {
    pub control: ComplianceControl,
    pub mapped_tools: Vec<MappedTool>,
    pub scan_results: Vec<ScanComplianceResult>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct MappedTool {
    pub tool_id: String,
    pub tool_name: String,
    pub coverage_type: Option<String>,
}

/// Get all active compliance frameworks with control counts
pub async fn list_frameworks(pool: &PgPool) -> Result<Vec<FrameworkSummary>, sqlx::Error> {
    let frameworks: Vec<ComplianceFramework> = sqlx::query_as(
        "SELECT id, name, short_name, version, description, category, is_active FROM compliance_frameworks WHERE is_active = true ORDER BY name"
    )
    .fetch_all(pool)
    .await?;

    let mut results = Vec::new();
    for fw in frameworks {
        let (control_count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM compliance_controls WHERE framework_id = $1"
        )
        .bind(&fw.id)
        .fetch_one(pool)
        .await?;

        let (tool_count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(DISTINCT cm.tool_id) FROM compliance_mappings cm \
             JOIN compliance_controls cc ON cm.control_id = cc.id \
             WHERE cc.framework_id = $1"
        )
        .bind(&fw.id)
        .fetch_one(pool)
        .await?;

        results.push(FrameworkSummary {
            framework: fw,
            total_controls: control_count,
            mapped_tools: tool_count,
        });
    }
    Ok(results)
}

/// Get controls for a specific framework
pub async fn get_framework_controls(
    pool: &PgPool,
    framework_id: &str,
) -> Result<Vec<ControlDetail>, sqlx::Error> {
    let controls: Vec<ComplianceControl> = sqlx::query_as(
        "SELECT id, framework_id, control_id, title, description, category, subcategory, severity \
         FROM compliance_controls WHERE framework_id = $1 ORDER BY control_id"
    )
    .bind(framework_id)
    .fetch_all(pool)
    .await?;

    let mut results = Vec::new();
    for ctrl in controls {
        let tools: Vec<MappedTool> = sqlx::query_as(
            "SELECT cm.tool_id, t.name as tool_name, cm.coverage_type \
             FROM compliance_mappings cm JOIN tools t ON cm.tool_id = t.id \
             WHERE cm.control_id = $1 ORDER BY t.name"
        )
        .bind(&ctrl.id)
        .fetch_all(pool)
        .await?;

        let scan_results: Vec<ScanComplianceResult> = sqlx::query_as(
            "SELECT id, scan_id, control_id, status, finding, severity, remediation \
             FROM scan_compliance_results WHERE control_id = $1 ORDER BY tested_at DESC LIMIT 10"
        )
        .bind(&ctrl.id)
        .fetch_all(pool)
        .await?;

        results.push(ControlDetail {
            control: ctrl,
            mapped_tools: tools,
            scan_results,
        });
    }
    Ok(results)
}

/// Assess compliance posture for an organization based on their scan results
pub async fn assess_posture(
    pool: &PgPool,
    org_id: &str,
    framework_id: &str,
) -> Result<JsonValue, sqlx::Error> {
    // Get all controls for this framework
    let controls: Vec<ComplianceControl> = sqlx::query_as(
        "SELECT id, framework_id, control_id, title, description, category, subcategory, severity \
         FROM compliance_controls WHERE framework_id = $1"
    )
    .bind(framework_id)
    .fetch_all(pool)
    .await?;

    let total = controls.len() as i64;
    let mut passed = 0i64;
    let mut failed = 0i64;
    let mut partial = 0i64;
    let mut untested = 0i64;
    let mut control_results = Vec::new();

    for ctrl in &controls {
        // Get tools mapped to this control
        let mapped_tools: Vec<String> = sqlx::query_as(
            "SELECT t.name FROM compliance_mappings cm JOIN tools t ON cm.tool_id = t.id WHERE cm.control_id = $1"
        )
        .bind(&ctrl.id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|row: (String,)| row.0)
        .collect();

        if mapped_tools.is_empty() {
            untested += 1;
            control_results.push(json!({
                "control_id": ctrl.control_id,
                "title": ctrl.title,
                "status": "untested",
                "mapped_tools": [],
                "category": ctrl.category,
            }));
            continue;
        }

        // Check if any scan of those tools found issues
        let scan_findings: Vec<(Option<String>,)> = sqlx::query_as(
            "SELECT scr.status FROM scan_compliance_results scr \
             WHERE scr.control_id = $1 AND scr.scan_id IN \
             (SELECT s.id FROM scans s JOIN tools t ON s.tool_id = t.id \
              WHERE s.organization_id = $2 AND s.status = 'completed')"
        )
        .bind(&ctrl.id)
        .bind(org_id)
        .fetch_all(pool)
        .await?;

        let ctrl_status = if scan_findings.is_empty() {
            // No scan results yet - check if any completed scans exist for mapped tools
            let has_scans: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM scans s JOIN tools t ON s.tool_id = t.id \
                 WHERE s.organization_id = $1 AND t.name = ANY($2) AND s.status = 'completed'"
            )
            .bind(org_id)
            .bind(&mapped_tools)
            .fetch_one(pool)
            .await?;

            if has_scans.0 > 0 { "partial" } else { "untested" }
        } else {
            let has_failure = scan_findings.iter().any(|f| f.0.as_deref() == Some("failed"));
            if has_failure { "failed" } else { "passed" }
        };

        match ctrl_status {
            "passed" => passed += 1,
            "failed" => failed += 1,
            "partial" => partial += 1,
            _ => untested += 1,
        }

        control_results.push(json!({
            "control_id": ctrl.control_id,
            "title": ctrl.title,
            "status": ctrl_status,
            "mapped_tools": mapped_tools,
            "category": ctrl.category,
        }));
    }

    let score = if total > 0 { (passed as f64 / total as f64) * 100.0 } else { 0.0 };

    // Update or insert posture record
    let _ = sqlx::query(
        "INSERT INTO compliance_posture (organization_id, framework_id, total_controls, passed, failed, partial, untested, score_pct, last_assessed_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) \
         ON CONFLICT (organization_id, framework_id) DO UPDATE SET \
         total_controls = $3, passed = $4, failed = $5, partial = $6, untested = $7, score_pct = $8, last_assessed_at = NOW(), updated_at = NOW()"
    )
    .bind(org_id)
    .bind(framework_id)
    .bind(total)
    .bind(passed)
    .bind(failed)
    .bind(partial)
    .bind(untested)
    .bind(score)
    .execute(pool)
    .await;

    Ok(json!({
        "framework_id": framework_id,
        "total_controls": total,
        "passed": passed,
        "failed": failed,
        "partial": partial,
        "untested": untested,
        "score_pct": score,
        "controls": control_results,
    }))
}

/// Get organization's compliance posture across all frameworks
pub async fn get_org_posture(
    pool: &PgPool,
    org_id: &str,
) -> Result<Vec<JsonValue>, sqlx::Error> {
    let postures: Vec<CompliancePosture> = sqlx::query_as(
        "SELECT id, organization_id, framework_id, total_controls, passed, failed, partial, untested, CAST(score_pct AS float8) as score_pct \
         FROM compliance_posture WHERE organization_id = $1 ORDER BY framework_id"
    )
    .bind(org_id)
    .fetch_all(pool)
    .await?;

    let mut results = Vec::new();
    for p in postures {
        let fw: Option<ComplianceFramework> = sqlx::query_as(
            "SELECT id, name, short_name, version, description, category, is_active \
             FROM compliance_frameworks WHERE id = $1"
        )
        .bind(&p.framework_id)
        .fetch_optional(pool)
        .await?;

        if let Some(fw) = fw {
            results.push(json!({
                "framework": fw,
                "posture": {
                    "total_controls": p.total_controls,
                    "passed": p.passed,
                    "failed": p.failed,
                    "partial": p.partial,
                    "untested": p.untested,
                    "score_pct": p.score_pct,
                },
            }));
        }
    }
    Ok(results)
}

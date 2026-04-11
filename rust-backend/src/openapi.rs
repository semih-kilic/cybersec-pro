/// CyberSec Pro — OpenAPI Documentation
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "CyberSec Pro API",
        version = "4.0.0",
        description = "CyberSec Professional — Security Operations Platform API",
        contact(name = "Semih Kılıç", email = "support@semihkilic.com", url = "https://semihkilic.com"),
        license(name = "Proprietary")
    ),
    servers(
        (url = "https://cybersecpro.semihkilic.com", description = "Production"),
        (url = "http://localhost:5001", description = "Local Development")
    ),
    paths(),
    components(schemas()),
    tags(
        (name = "auth", description = "Authentication & OAuth"),
        (name = "scans", description = "Security Scan Operations"),
        (name = "tools", description = "Security Tool Catalog"),
        (name = "agents", description = "Remote Agent Management"),
        (name = "reports", description = "Report Generation"),
        (name = "schedules", description = "Scheduled Scan Engine"),
        (name = "integrations", description = "Slack/Teams/Webhook Integrations"),
        (name = "admin", description = "Super Admin Operations"),
        (name = "settings", description = "User & Organization Settings"),
        (name = "billing", description = "Stripe Billing & Subscriptions")
    )
)]
pub struct ApiDoc;

/// Build the full OpenAPI spec with manually registered paths
pub fn openapi_spec() -> utoipa::openapi::OpenApi {
    let mut doc = ApiDoc::openapi();

    // Manually register key endpoints (avoids heavy macro annotation on every handler)
    register_paths(&mut doc);

    doc
}

fn register_paths(doc: &mut utoipa::openapi::OpenApi) {
    use utoipa::openapi::*;
    use utoipa::openapi::path::*;

    let bearer = SecurityScheme::Http(
        security::HttpBuilder::new()
            .scheme(security::HttpAuthScheme::Bearer)
            .bearer_format("JWT")
            .description(Some("JWT access token"))
            .build()
    );
    doc.components.get_or_insert_with(ComponentsBuilder::new().into)
        .security_schemes.insert("bearerAuth".to_string(), RefOr::T(bearer));

    let paths = vec![
        // ── Auth ──
        path_item("POST", "/api/v1/auth/register", "auth", "Register a new user account",
            Some(r#"{"email":"user@example.com","password":"StrongPass1!","first_name":"John","last_name":"Doe"}"#),
            "200: {access_token, refresh_token, user}"),
        path_item("POST", "/api/v1/auth/login", "auth", "Login with email/password (supports MFA)",
            Some(r#"{"email":"user@example.com","password":"pass","mfa_code":"123456"}"#),
            "200: {access_token, refresh_token, user}"),
        path_item("POST", "/api/v1/auth/google", "auth", "Google OAuth code exchange",
            Some(r#"{"code":"auth_code","redirect_uri":"https://..."}"#),
            "200: {access_token, refresh_token, user}"),
        path_item("POST", "/api/v1/auth/github", "auth", "GitHub OAuth code exchange",
            Some(r#"{"code":"auth_code","redirect_uri":"https://..."}"#),
            "200: {access_token, refresh_token, user}"),
        path_item("POST", "/api/v1/auth/refresh", "auth", "Refresh access token", None,
            "200: {access_token}"),
        path_item("POST", "/api/v1/auth/forgot-password", "auth", "Request password reset email",
            Some(r#"{"email":"user@example.com"}"#), "200: {message}"),
        path_item("POST", "/api/v1/auth/reset-password", "auth", "Reset password with token",
            Some(r#"{"token":"...","new_password":"NewPass1!"}"#), "200: {message}"),
        path_item("GET", "/api/v1/auth/me", "auth", "Get current user profile", None,
            "200: {user}"),

        // ── Scans ──
        path_item("GET", "/api/v1/scans", "scans", "List user's scans (paginated)", None,
            "200: {scans, total, page, per_page}"),
        path_item("POST", "/api/v1/scan/start", "scans", "Start a new security scan",
            Some(r#"{"tool_name":"nmap","target":"192.168.1.0/24","agent_id":"opt"}"#),
            "200: {scan_id, status, message}"),
        path_item("GET", "/api/v1/scan/{scan_id}/output", "scans", "Stream scan output (SSE)", None,
            "200: text/event-stream"),
        path_item("POST", "/api/v1/scan/{scan_id}/stop", "scans", "Cancel a running scan", None,
            "200: {message}"),
        path_item("GET", "/api/v1/scans/{scan_id}", "scans", "Get scan details", None,
            "200: {scan}"),

        // ── Tools ──
        path_item("GET", "/api/v1/tools", "tools", "List available security tools", None,
            "200: {tools}"),
        path_item("GET", "/api/v1/tools/catalog", "tools", "Full tool catalog with categories", None,
            "200: {categories}"),

        // ── Agents ──
        path_item("GET", "/api/v1/agents", "agents", "List organization agents", None,
            "200: {agents}"),
        path_item("POST", "/api/v1/agents", "agents", "Register a new agent (SSH device)",
            Some(r#"{"name":"Kali VM","ssh_host":"10.0.0.5","ssh_port":22,"ssh_username":"kali","ssh_password":"..."}"#),
            "200: {agent}"),
        path_item("POST", "/api/v1/agents/{agent_id}/execute", "agents", "Execute command on agent via SSH",
            Some(r#"{"command":"whoami"}"#), "200: {output, exit_code}"),

        // ── Schedules ──
        path_item("GET", "/api/v1/schedules", "schedules", "List scheduled scans", None,
            "200: {schedules}"),
        path_item("POST", "/api/v1/schedules", "schedules", "Create a scheduled scan",
            Some(r#"{"name":"Nightly Nmap","tool_name":"nmap","target":"10.0.0.0/24","cron_expression":"0 2 * * *","schedule_type":"recurring"}"#),
            "200: {schedule}"),
        path_item("PUT", "/api/v1/schedules/{id}", "schedules", "Update a scheduled scan", None,
            "200: {schedule}"),
        path_item("DELETE", "/api/v1/schedules/{id}", "schedules", "Delete a scheduled scan", None,
            "200: {message}"),

        // ── Integrations ──
        path_item("GET", "/api/v1/integrations", "integrations", "List active integrations", None,
            "200: {integrations}"),
        path_item("POST", "/api/v1/integrations", "integrations", "Create a webhook/Slack/Teams integration",
            Some(r#"{"name":"Slack Alerts","integration_type":"slack","webhook_url":"https://hooks.slack.com/..."}"#),
            "200: {integration}"),
        path_item("POST", "/api/v1/integrations/{id}/test", "integrations", "Send test notification", None,
            "200: {message}"),
        path_item("POST", "/api/v1/integrations/{id}/toggle", "integrations", "Enable/disable integration", None,
            "200: {is_active}"),

        // ── Reports ──
        path_item("GET", "/api/v1/reports", "reports", "List generated reports", None,
            "200: {reports}"),
        path_item("POST", "/api/v1/reports/generate", "reports", "Generate a new report",
            Some(r#"{"name":"Monthly Security Report","scan_ids":["..."]}"#),
            "200: {report}"),

        // ── Settings ──
        path_item("GET", "/api/v1/settings/notifications", "settings", "Get notification preferences", None,
            "200: {preferences}"),
        path_item("PUT", "/api/v1/settings/notifications", "settings", "Update notification preferences",
            Some(r#"{"email_scan_complete":true,"email_weekly_report":false,"quiet_hours_enabled":true}"#),
            "200: {preferences}"),
        path_item("GET", "/api/v1/settings/team", "settings", "List team members", None,
            "200: {members}"),
        path_item("POST", "/api/v1/settings/team/invite", "settings", "Invite team member",
            Some(r#"{"email":"new@team.com","role":"analyst"}"#), "200: {message}"),
        path_item("GET", "/api/v1/roles", "settings", "List available roles", None,
            "200: {roles}"),

        // ── Billing ──
        path_item("POST", "/api/v1/billing/create-checkout", "billing", "Create Stripe checkout session",
            Some(r#"{"price_id":"price_..."}"#), "200: {session_url}"),
        path_item("GET", "/api/v1/billing/portal", "billing", "Get Stripe customer portal URL", None,
            "200: {portal_url}"),

        // ── Admin ──
        path_item("GET", "/api/v1/admin/overview", "admin", "Admin dashboard overview (superadmin only)", None,
            "200: {total_users, total_orgs, total_scans, ...}"),
    ];

    for (path_str, item) in paths {
        doc.paths.paths.insert(path_str.to_string(), RefOr::T(item));
    }
}

fn path_item(
    method: &str,
    path: &str,
    tag: &str,
    summary: &str,
    body_example: Option<&str>,
    response_desc: &str,
) -> (&str, utoipa::openapi::path::PathItem) {
    use utoipa::openapi::*;
    use utoipa::openapi::path::*;

    let mut op = OperationBuilder::new()
        .tag(tag)
        .summary(Some(summary.to_string()))
        .security(Some(vec![SecurityRequirement::new::<&str, [&str; 0], &str>("bearerAuth", [])]))
        .response(
            "200",
            ResponseBuilder::new().description(response_desc).build()
        );

    if let Some(example) = body_example {
        let body = request_body::RequestBodyBuilder::new()
            .content("application/json",
                ContentBuilder::new()
                    .example(Some(serde_json::from_str(example).unwrap_or_default()))
                    .build()
            )
            .build();
        op = op.request_body(Some(body));
    }

    let operation = op.build();
    let mut item = PathItem::new(HttpMethod::Get, operation.clone());
    match method {
        "POST" => { item = PathItem::new(HttpMethod::Post, operation); }
        "PUT" => { item = PathItem::new(HttpMethod::Put, operation); }
        "DELETE" => { item = PathItem::new(HttpMethod::Delete, operation); }
        "GET" => { /* default */ }
        _ => { }
    }

    (path, item)
}

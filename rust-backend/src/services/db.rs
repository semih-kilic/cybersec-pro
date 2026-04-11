use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;

/// Initialize database connection pool.
/// Schema is managed by init-db.sql in the Docker entrypoint.
pub async fn init_db(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(database_url)
        .await?;

    // Run schema migrations inline (idempotent)
    run_migrations(&pool).await?;

    tracing::info!("PostgreSQL connected and schema verified");
    Ok(pool)
}

async fn run_migrations(pool: &PgPool) -> anyhow::Result<()> {
    // Execute each statement separately — PostgreSQL doesn't support multi-statement in one query
    for stmt in SCHEMA_STATEMENTS.iter() {
        if !stmt.trim().is_empty() {
            sqlx::query(stmt).execute(pool).await?;
        }
    }
    Ok(())
}

const SCHEMA_STATEMENTS: &[&str] = &[
r#"CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan_type TEXT DEFAULT 'starter',
    stripe_customer_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
)"#,

r#"CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'user',
    organization_id TEXT REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    verification_sent_at TIMESTAMP,
    oauth_provider TEXT,
    oauth_id TEXT,
    avatar_url TEXT,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    mfa_backup_codes JSONB,
    mfa_enabled_at TIMESTAMP
)"#,

r#"CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id),
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    category TEXT DEFAULT 'system',
    severity TEXT DEFAULT 'info',
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    resource_type TEXT,
    resource_id TEXT,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMP DEFAULT NOW()
)"#,

"CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)",
"CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id)",

r#"CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    stripe_subscription_id TEXT UNIQUE,
    plan_type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
)"#,

r#"CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    hostname TEXT,
    ip_address TEXT,
    platform TEXT DEFAULT 'linux',
    os_info TEXT,
    version TEXT,
    status TEXT DEFAULT 'pending',
    connection_type TEXT DEFAULT 'direct',
    ssh_host TEXT,
    ssh_port INTEGER DEFAULT 22,
    ssh_username TEXT,
    ssh_key_path TEXT,
    ssh_password_encrypted TEXT,
    vpn_config_path TEXT,
    vpn_status TEXT DEFAULT 'disconnected',
    vpn_assigned_ip TEXT,
    proxy_endpoint TEXT,
    proxy_api_key TEXT,
    proxy_protocol TEXT DEFAULT 'https',
    agent_websocket_id TEXT,
    agent_capabilities JSONB,
    agent_docker_enabled BOOLEAN DEFAULT FALSE,
    auto_update BOOLEAN DEFAULT TRUE,
    registration_token TEXT UNIQUE,
    api_key TEXT UNIQUE,
    last_heartbeat TIMESTAMP,
    cpu_usage REAL DEFAULT 0,
    memory_usage REAL DEFAULT 0,
    active_scans INTEGER DEFAULT 0,
    total_scans INTEGER DEFAULT 0,
    max_concurrent_scans INTEGER DEFAULT 5,
    location TEXT,
    network_zone TEXT DEFAULT 'public',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)"#,

r#"CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    command_template TEXT,
    parameters JSONB,
    plan_required TEXT DEFAULT 'starter',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    tool_type TEXT DEFAULT 'cli',
    hardware_required JSONB,
    gui_required BOOLEAN DEFAULT FALSE,
    install_command TEXT,
    example_usage TEXT,
    official_url TEXT,
    business_name TEXT DEFAULT '',
    business_description TEXT DEFAULT '',
    business_category TEXT DEFAULT '',
    subcategory TEXT DEFAULT '',
    risk_context TEXT DEFAULT '',
    tool_group TEXT DEFAULT 'misc',
    binary_name TEXT DEFAULT '',
    kali_package TEXT DEFAULT ''
)"#,

r#"CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    target_type TEXT DEFAULT 'web',
    target_url TEXT,
    target_ip TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)"#,

r#"CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    tool_id TEXT NOT NULL REFERENCES tools(id),
    target TEXT NOT NULL,
    parameters JSONB,
    status TEXT DEFAULT 'pending',
    agent_id TEXT REFERENCES agents(id),
    project_id INTEGER REFERENCES projects(id),
    output TEXT,
    error_log TEXT,
    findings JSONB,
    report_path TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
)"#,

"CREATE INDEX IF NOT EXISTS idx_scans_org ON scans(organization_id)",
"CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status)",

r#"CREATE TABLE IF NOT EXISTS usage_tracking (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    tool_id TEXT NOT NULL REFERENCES tools(id),
    scan_id TEXT REFERENCES scans(id),
    usage_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW()
)"#,

r#"CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    template TEXT DEFAULT 'full',
    format TEXT DEFAULT 'html',
    status TEXT DEFAULT 'generating',
    scan_ids JSONB,
    sections JSONB,
    total_findings INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    info_count INTEGER DEFAULT 0,
    risk_score INTEGER DEFAULT 0,
    risk_level TEXT DEFAULT 'None',
    content TEXT,
    file_path TEXT,
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
)"#,

r#"CREATE TABLE IF NOT EXISTS sso_configs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id),
    provider_type TEXT NOT NULL,
    provider_name TEXT,
    is_enabled BOOLEAN DEFAULT FALSE,
    saml_entity_id TEXT,
    saml_sso_url TEXT,
    saml_certificate TEXT,
    saml_sign_requests BOOLEAN DEFAULT TRUE,
    oidc_client_id TEXT,
    oidc_client_secret TEXT,
    oidc_issuer_url TEXT,
    oidc_scopes TEXT DEFAULT 'openid profile email',
    ldap_host TEXT,
    ldap_port INTEGER DEFAULT 389,
    ldap_use_ssl BOOLEAN DEFAULT FALSE,
    ldap_bind_dn TEXT,
    ldap_bind_password TEXT,
    ldap_base_dn TEXT,
    ldap_user_filter TEXT DEFAULT '(sAMAccountName={username})',
    ldap_group_filter TEXT,
    domain_hint TEXT,
    enforce_sso BOOLEAN DEFAULT FALSE,
    jit_provisioning BOOLEAN DEFAULT TRUE,
    default_role TEXT DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
)"#,

r#"CREATE TABLE IF NOT EXISTS scheduled_scans (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    target TEXT NOT NULL,
    parameters JSONB,
    schedule_type TEXT DEFAULT 'daily',
    cron_expression TEXT,
    hour INTEGER DEFAULT 2,
    minute INTEGER DEFAULT 0,
    day_of_week TEXT,
    day_of_month INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    run_count INTEGER DEFAULT 0,
    agent_id TEXT REFERENCES agents(id),
    project_id INTEGER REFERENCES projects(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)"#,

r#"CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_scan_complete BOOLEAN DEFAULT TRUE,
    email_weekly_report BOOLEAN DEFAULT TRUE,
    email_security_alerts BOOLEAN DEFAULT TRUE,
    browser_notifications BOOLEAN DEFAULT TRUE,
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_from TEXT DEFAULT '22:00',
    quiet_hours_to TEXT DEFAULT '08:00',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
)"#,

r#"CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_preview TEXT NOT NULL,
    permissions JSONB DEFAULT '["read"]'::jsonb,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
)"#,

r#"CREATE TABLE IF NOT EXISTS team_invitations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    invited_by TEXT NOT NULL REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
)"#,

// Add password_reset columns to existing users table (idempotent)
"ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT",
"ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP",

// Integrations table
r#"CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    integration_type TEXT NOT NULL,
    webhook_url TEXT,
    config JSONB DEFAULT '{}',
    events TEXT[] DEFAULT ARRAY['scan_completed','scan_failed','vulnerability_critical'],
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP,
    last_error TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)"#,

// Add role column if missing (for RBAC expansion)
"ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'",
"ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'",
];

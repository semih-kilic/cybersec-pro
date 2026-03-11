use sqlx::SqlitePool;

/// Initialize database connection pool and run migrations.
pub async fn init_db(database_url: &str) -> anyhow::Result<SqlitePool> {
    let pool = SqlitePool::connect(database_url).await?;

    // Create tables if they don't exist (compatible with existing Flask/SQLAlchemy schema)
    sqlx::query(SCHEMA_SQL).execute(&pool).await?;

    tracing::info!("Database connected and schema verified");
    Ok(pool)
}

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    plan_type TEXT DEFAULT 'starter',
    stripe_customer_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'user',
    organization_id TEXT REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    email_verified BOOLEAN DEFAULT 0,
    verification_token TEXT,
    verification_sent_at TIMESTAMP,
    oauth_provider TEXT,
    oauth_id TEXT,
    avatar_url TEXT,
    mfa_enabled BOOLEAN DEFAULT 0,
    mfa_secret TEXT,
    mfa_backup_codes JSON,
    mfa_enabled_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id),
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    category TEXT DEFAULT 'system',
    severity TEXT DEFAULT 'info',
    ip_address TEXT,
    user_agent TEXT,
    details JSON,
    resource_type TEXT,
    resource_id TEXT,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    stripe_subscription_id TEXT UNIQUE,
    plan_type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
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
    agent_capabilities JSON,
    agent_docker_enabled BOOLEAN DEFAULT 0,
    auto_update BOOLEAN DEFAULT 1,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    command_template TEXT,
    parameters JSON,
    plan_required TEXT DEFAULT 'starter',
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tool_type TEXT DEFAULT 'cli',
    hardware_required JSON,
    gui_required BOOLEAN DEFAULT 0,
    install_command TEXT,
    example_usage TEXT,
    official_url TEXT,
    business_name TEXT DEFAULT '',
    business_description TEXT DEFAULT '',
    business_category TEXT DEFAULT '',
    subcategory TEXT DEFAULT '',
    risk_context TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    tool_id TEXT NOT NULL REFERENCES tools(id),
    target TEXT NOT NULL,
    parameters JSON,
    status TEXT DEFAULT 'pending',
    agent_id TEXT REFERENCES agents(id),
    project_id INTEGER REFERENCES projects(id),
    output TEXT,
    error_log TEXT,
    findings JSON,
    report_path TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scans_org ON scans(organization_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);

CREATE TABLE IF NOT EXISTS usage_tracking (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    tool_id TEXT NOT NULL REFERENCES tools(id),
    scan_id TEXT REFERENCES scans(id),
    usage_date DATE DEFAULT (date('now')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    template TEXT DEFAULT 'full',
    format TEXT DEFAULT 'html',
    status TEXT DEFAULT 'generating',
    scan_ids JSON,
    sections JSON,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sso_configs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id),
    provider_type TEXT NOT NULL,
    provider_name TEXT,
    is_enabled BOOLEAN DEFAULT 0,
    saml_entity_id TEXT,
    saml_sso_url TEXT,
    saml_certificate TEXT,
    saml_sign_requests BOOLEAN DEFAULT 1,
    oidc_client_id TEXT,
    oidc_client_secret TEXT,
    oidc_issuer_url TEXT,
    oidc_scopes TEXT DEFAULT 'openid profile email',
    ldap_host TEXT,
    ldap_port INTEGER DEFAULT 389,
    ldap_use_ssl BOOLEAN DEFAULT 0,
    ldap_bind_dn TEXT,
    ldap_bind_password TEXT,
    ldap_base_dn TEXT,
    ldap_user_filter TEXT DEFAULT '(sAMAccountName={username})',
    ldap_group_filter TEXT,
    domain_hint TEXT,
    enforce_sso BOOLEAN DEFAULT 0,
    jit_provisioning BOOLEAN DEFAULT 1,
    default_role TEXT DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    target_type TEXT DEFAULT 'web',
    target_url TEXT,
    target_ip TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduled_scans (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    target TEXT NOT NULL,
    parameters JSON,
    schedule_type TEXT DEFAULT 'daily',
    cron_expression TEXT,
    hour INTEGER DEFAULT 2,
    minute INTEGER DEFAULT 0,
    day_of_week TEXT,
    day_of_month INTEGER,
    is_active BOOLEAN DEFAULT 1,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    run_count INTEGER DEFAULT 0,
    agent_id TEXT REFERENCES agents(id),
    project_id INTEGER REFERENCES projects(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"#;

use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;

/// Initialize database connection pool.
/// Schema is managed by init-db.sql in the Docker entrypoint.
pub async fn init_db(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(2)
        .idle_timeout(std::time::Duration::from_secs(300))
        .max_lifetime(std::time::Duration::from_secs(1800))
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
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
)"#,

r#"ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT"#,

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
    discovered_subnets JSONB,
    agent_docker_enabled BOOLEAN DEFAULT FALSE,
    auto_update BOOLEAN DEFAULT TRUE,
    registration_token TEXT UNIQUE,
    api_key_hash TEXT UNIQUE,
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

// ── Security hardening: API keys stored hashed (SHA-256), never plaintext ──
// Adds an `api_key_hash` column, converts any existing plaintext keys to
// hashes, drops the legacy column and enforces uniqueness on the hash so
// credentials at rest are never readable.
r#"ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_key_hash TEXT"#,
r#"DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema='public' AND table_name='agents' AND column_name='api_key') THEN
        EXECUTE 'UPDATE agents SET api_key_hash = encode(sha256(api_key::bytea), ''hex'') WHERE api_key IS NOT NULL AND api_key_hash IS NULL';
        EXECUTE 'ALTER TABLE agents DROP COLUMN api_key';
    END IF;
END $$;"#,
r#"CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_api_key_hash ON agents(api_key_hash) WHERE api_key_hash IS NOT NULL"#,

// Agent job execution protocol v2: `args` carries a JSON argv array so the agent
// runs tools without shell interpolation (fixes the shell-escape bug) and can
// report exact invocation details. The legacy `command` string is kept for
// backwards compatibility with already-deployed agents.
r#"ALTER TABLE agent_jobs ADD COLUMN IF NOT EXISTS args JSONB"#,
r#"CREATE INDEX IF NOT EXISTS idx_agent_jobs_agent_status ON agent_jobs (agent_id, status, created_at)"#,

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

r#"CREATE TABLE IF NOT EXISTS purple_team_exercises (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    attack_chain_id TEXT NOT NULL,
    target TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    total_steps BIGINT DEFAULT 0,
    completed_steps BIGINT DEFAULT 0,
    detected_attacks BIGINT DEFAULT 0,
    missed_attacks BIGINT DEFAULT 0,
    risk_score DOUBLE PRECISION DEFAULT 0,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)"#,

"CREATE INDEX IF NOT EXISTS idx_purple_team_exercises_org_created ON purple_team_exercises(organization_id, created_at DESC)",
"CREATE INDEX IF NOT EXISTS idx_purple_team_exercises_status ON purple_team_exercises(organization_id, status)",

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

r#"CREATE TABLE IF NOT EXISTS purple_team_profiles (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)"#,

"CREATE INDEX IF NOT EXISTS idx_purple_team_profiles_updated_at ON purple_team_profiles(updated_at)",

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

// ── Phase 1: Login History ──────────────────────────────────────────────────
r#"CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    country TEXT,
    city TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    failure_reason TEXT,
    mfa_used BOOLEAN DEFAULT FALSE,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
)"#,
"CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id)",
"CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at)",

// ── Phase 1: IP Whitelist ───────────────────────────────────────────────────
r#"CREATE TABLE IF NOT EXISTS ip_whitelist (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    ip_cidr TEXT NOT NULL,
    label TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
)"#,
"CREATE INDEX IF NOT EXISTS idx_ip_whitelist_org ON ip_whitelist(organization_id)",

// ── Phase 1: API Key extra columns ─────────────────────────────────────────
"ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS usage_count BIGINT DEFAULT 0",
"ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_per_hour INTEGER DEFAULT 1000",
"ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS allowed_ips TEXT[]",
"ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS description TEXT",
"ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMP",

// ── Phase 1: Suspicious login flags on users ───────────────────────────────
"ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0",
"ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP",
"ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP",
"ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN DEFAULT FALSE",

// ── Phase 3: Scan templates ────────────────────────────────────────────────
r#"CREATE TABLE IF NOT EXISTS scan_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
    created_by TEXT REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    tool_id TEXT REFERENCES tools(id),
    parameters JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)"#,
"CREATE INDEX IF NOT EXISTS idx_scan_templates_org ON scan_templates(organization_id)",

// ── Phase 5: Analytics snapshots ──────────────────────────────────────────
r#"CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_scans INTEGER DEFAULT 0,
    completed_scans INTEGER DEFAULT 0,
    failed_scans INTEGER DEFAULT 0,
    critical_findings INTEGER DEFAULT 0,
    high_findings INTEGER DEFAULT 0,
    medium_findings INTEGER DEFAULT 0,
    low_findings INTEGER DEFAULT 0,
    risk_score DOUBLE PRECISION DEFAULT 0,
    tools_used JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, snapshot_date)
)"#,
"CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_org_date ON analytics_snapshots(organization_id, snapshot_date DESC)",

// ── Phase 6: Strix AI Jobs ────────────────────────────────────────────────
r#"CREATE TABLE IF NOT EXISTS cybersec_ai_jobs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    target TEXT NOT NULL,
    target_type TEXT DEFAULT 'url',
    job_type TEXT DEFAULT 'autonomous_pentest',
    status TEXT DEFAULT 'queued',
    agents_config JSONB DEFAULT '{}',
    results JSONB,
    findings_count INTEGER DEFAULT 0,
    poc_verified_count INTEGER DEFAULT 0,
    auto_fix_prs JSONB DEFAULT '[]',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
)"#,
"CREATE INDEX IF NOT EXISTS idx_cybersec_ai_jobs_org ON cybersec_ai_jobs(organization_id)",
"CREATE INDEX IF NOT EXISTS idx_cybersec_ai_jobs_status ON cybersec_ai_jobs(status)",

// ── Phase 7: Newsletter subscribers ─────────────────────────────────────
r#"CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    source TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
)"#,
"CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(is_active)",

// ── Phase 8: God Mode feature flags ─────────────────────────────────────
r#"CREATE TABLE IF NOT EXISTS feature_flags (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
)"#,

// ── Phase 18.6: trial-abuse prevention ──────────────────────────────────
// Normalized email = lowercase, +tag stripped, gmail dots removed.
// Used to block the same person registering twice via aliases.
r#"ALTER TABLE users ADD COLUMN IF NOT EXISTS email_normalized TEXT"#,
r#"ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ip TEXT"#,
"CREATE INDEX IF NOT EXISTS idx_users_email_normalized ON users(email_normalized)",
"CREATE INDEX IF NOT EXISTS idx_users_signup_ip ON users(signup_ip)",

// ── Phase 22: real community / discussion forum ─────────────────────────
r#"CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    category TEXT NOT NULL DEFAULT 'General',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    like_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
)"#,
"CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC)",
"CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category)",
"CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id)",

r#"CREATE TABLE IF NOT EXISTS community_post_likes (
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
)"#,

r#"CREATE TABLE IF NOT EXISTS community_post_replies (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
)"#,
"CREATE INDEX IF NOT EXISTS idx_community_replies_post ON community_post_replies(post_id, created_at)",

// ── Target authorization (bypass-proof ownership confirmation) ────────
r#"CREATE TABLE IF NOT EXISTS target_authorizations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    target TEXT NOT NULL,
    target_type TEXT NOT NULL,
    scope_statement TEXT NOT NULL,
    statement_version TEXT NOT NULL,
    confirmed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    last_used_at TIMESTAMP
)"#,
"CREATE UNIQUE INDEX IF NOT EXISTS idx_target_auth_org_target ON target_authorizations(organization_id, target)",
"CREATE INDEX IF NOT EXISTS idx_target_auth_org ON target_authorizations(organization_id)",
r#"ALTER TABLE scans ADD COLUMN IF NOT EXISTS authorization_id TEXT REFERENCES target_authorizations(id)"#,
r#"ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS authorization_id TEXT REFERENCES target_authorizations(id)"#,
r#"ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS scope_statement TEXT"#,
r#"ALTER TABLE scheduled_scans ADD COLUMN IF NOT EXISTS statement_version TEXT"#,
// CASL opt-out flag: users who withdrew consent to commercial email.
r#"ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE"#,

// ── Consent & privacy records (PIPEDA 5.1 / CCPA CPRA / GDPR) ─────────
// Every consent event (registration, policy updates, withdrawal) is logged so
// the org can demonstrate lawful processing on request.
r#"CREATE TABLE IF NOT EXISTS consent_records (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL,
    purpose         TEXT NOT NULL,               -- 'account', 'marketing', 'analytics', 'data_sharing', 'processed_personal_data'
    category        TEXT NOT NULL DEFAULT 'essential',  -- essential | functional | marketing
    status          TEXT NOT NULL DEFAULT 'granted',    -- granted | withdrawn
    version         TEXT NOT NULL DEFAULT '2026-01-01',
    ip_address      TEXT,
    user_agent      TEXT,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at    TIMESTAMPTZ
)"#,
"CREATE INDEX IF NOT EXISTS idx_consent_records_user ON consent_records(user_id, purpose)",
"CREATE INDEX IF NOT EXISTS idx_consent_records_org ON consent_records(organization_id)",

// ── Compliance framework mapping tables (mirror migrations/006) ───────
r#"CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL UNIQUE,
    version TEXT,
    description TEXT,
    category TEXT DEFAULT 'security',
    website_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)"#,
r#"CREATE TABLE IF NOT EXISTS compliance_controls (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    framework_id TEXT NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    control_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    subcategory TEXT,
    severity TEXT DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(framework_id, control_id)
)"#,
r#"CREATE TABLE IF NOT EXISTS compliance_mappings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    control_id TEXT NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,
    tool_id TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    coverage_type TEXT DEFAULT 'full',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(control_id, tool_id)
)"#,

// ── Compliance frameworks: PIPEDA, CCPA, CPRA (Canada & California) ───
// Idempotent seeds; ON CONFLICT (short_name) keeps them safe on re-runs.
r#"INSERT INTO compliance_frameworks (name, short_name, version, description, category) VALUES
('Personal Information Protection and Electronic Documents Act', 'PIPEDA', '2023', 'Canadian federal privacy law governing how private-sector organizations collect, use and disclose personal information', 'privacy'),
('California Consumer Privacy Act', 'CCPA', '2020', 'California consumer privacy rights — access, deletion, opt-out of sale', 'privacy'),
('California Privacy Rights Act', 'CPRA', '2023', 'Amends CCPA: adds right to correct, sensitive data limits, proportionate use', 'privacy')
ON CONFLICT (short_name) DO NOTHING"#,

// PIPEDA principles (10 fair information practices) — SSP (Schedule 1 of PIPEDA).
r#"INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory, severity) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name='PIPEDA'), 'PIPEDA-1', 'Accountability', 'Organization is responsible for personal information under its control and designates someone accountable', 'Privacy', 'Governance', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='PIPEDA'), 'PIPEDA-2', 'Identifying Purposes', 'Purposes for which personal information is collected shall be identified at or before collection', 'Privacy', 'Purpose', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='PIPEDA'), 'PIPEDA-3', 'Consent', 'Knowledge and consent of the individual are required for the collection, use, or disclosure', 'Privacy', 'Consent', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='PIPEDA'), 'PIPEDA-4', 'Limiting Collection', 'Collection of personal information shall be limited to that which is necessary for the identified purposes', 'Privacy', 'Minimization', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='PIPEDA'), 'PIPEDA-5', 'Limiting Use, Disclosure, Retention', 'Personal information shall not be used or disclosed for purposes other than those identified, and retained only as long as necessary', 'Privacy', 'Retention', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='PIPEDA'), 'PIPEDA-6', 'Accuracy', 'Personal information shall be as accurate, complete, and up-to-date as is necessary for the purposes', 'Privacy', 'Data Quality', 'medium'),
((SELECT id FROM compliance_frameworks WHERE short_name='PIPEDA'), 'PIPEDA-7', 'Safeguards', 'Personal information shall be protected by security safeguards appropriate to the sensitivity', 'Privacy', 'Security', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='PIPEDA'), 'PIPEDA-8', 'Openness', 'An organization shall make readily available specific information about its policies and practices', 'Privacy', 'Transparency', 'medium'),
((SELECT id FROM compliance_frameworks WHERE short_name='PIPEDA'), 'PIPEDA-9', 'Individual Access', 'An individual shall be able to challenge the accuracy and completeness of their information and have it amended', 'Privacy', 'Access', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='PIPEDA'), 'PIPEDA-10', 'Challenging Compliance', 'An individual shall be able to address a challenge concerning compliance with the principles', 'Privacy', 'Redress', 'medium')
ON CONFLICT DO NOTHING"#,

// CCPA/CPRA consumer rights + business obligations.
r#"INSERT INTO compliance_controls (framework_id, control_id, title, description, category, subcategory, severity) VALUES
((SELECT id FROM compliance_frameworks WHERE short_name='CCPA'), 'CCPA-1', 'Right to Know', 'Consumers may request disclosure of personal information collected, used, shared or sold', 'Privacy', 'Access', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='CCPA'), 'CCPA-2', 'Right to Delete', 'Consumers may request deletion of personal information, subject to exceptions', 'Privacy', 'Deletion', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='CCPA'), 'CCPA-3', 'Right to Opt-Out of Sale', 'Consumers may direct a business not to sell or share their personal information', 'Privacy', 'Opt-Out', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='CCPA'), 'CCPA-4', 'Right to Non-Discrimination', 'Businesses may not discriminate against consumers exercising privacy rights', 'Privacy', 'Fairness', 'medium'),
((SELECT id FROM compliance_frameworks WHERE short_name='CCPA'), 'CCPA-5', 'Notice at Collection', 'Businesses must notify consumers at or before collection of categories and purposes', 'Privacy', 'Transparency', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='CCPA'), 'CCPA-6', 'Privacy Policy Disclosure', 'The privacy policy must disclose categories collected, purposes, categories of third parties', 'Privacy', 'Transparency', 'medium'),
((SELECT id FROM compliance_frameworks WHERE short_name='CCPA'), 'CCPA-7', 'Service Provider Contracts', 'Contracts with service providers must restrict use of personal information', 'Privacy', 'Governance', 'medium'),
((SELECT id FROM compliance_frameworks WHERE short_name='CPRA'), 'CPRA-1', 'Right to Correct', 'Consumers may request correction of inaccurate personal information', 'Privacy', 'Access', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='CPRA'), 'CPRA-2', 'Right to Limit Sensitive Data Use', 'Consumers may direct a business to limit use of sensitive personal information', 'Privacy', 'Consent', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='CPRA'), 'CPRA-3', 'Proportionate Collection & Use', 'Collection and use of personal information must be reasonably necessary and proportionate', 'Privacy', 'Minimization', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='CPRA'), 'CPRA-4', 'Sensitive Data Retention', 'Sensitive personal information must not be retained longer than reasonably necessary', 'Privacy', 'Retention', 'high'),
((SELECT id FROM compliance_frameworks WHERE short_name='CPRA'), 'CPRA-5', 'Automated Decision-Making', 'Access and explanation rights for automated decision-making and profiling', 'Privacy', 'Transparency', 'medium')
ON CONFLICT DO NOTHING"#,

// CCPA 100k+ household threshold: US residents with $25M+ revenue etc. require
// annual audits and risk assessments. Kept as an informational control set.
];


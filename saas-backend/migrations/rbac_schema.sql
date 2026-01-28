-- ================================================
-- 🛡️ CyberSec Pro - RBAC Database Schema
-- Role-Based Access Control for Security Tools
-- Author: Semih Kılıç
-- Version: 1.0.0
-- ================================================

-- ================================
-- 1. PLANS TABLE
-- Defines subscription tiers
-- ================================
CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,         -- 'starter', 'professional', 'team', 'enterprise'
    display_name VARCHAR(100) NOT NULL,       -- 'Starter', 'Professional', etc.
    price_monthly DECIMAL(10,2) NOT NULL,     -- 0.00, 29.00, 79.00, 149.00
    price_yearly DECIMAL(10,2),               -- Annual pricing with discount
    level INTEGER NOT NULL UNIQUE,            -- 1, 2, 3, 4 (for hierarchy comparison)
    
    -- Limits
    daily_scan_limit INTEGER DEFAULT 10,      -- Scans per day
    monthly_scan_limit INTEGER DEFAULT 300,   -- Scans per month
    concurrent_scans INTEGER DEFAULT 1,       -- Simultaneous scans
    multi_tool_limit INTEGER DEFAULT 1,       -- Tools per multi-scan
    project_limit INTEGER DEFAULT 1,          -- Max projects
    team_member_limit INTEGER DEFAULT 1,      -- Team members (for Team+)
    remote_agent_limit INTEGER DEFAULT 0,     -- Remote agents (for Team+)
    
    -- Features (JSON for flexibility)
    features JSON,                            -- {"api_access": true, "pdf_reports": true, ...}
    
    -- Stripe
    stripe_price_id VARCHAR(100),             -- Stripe price ID for subscriptions
    stripe_yearly_price_id VARCHAR(100),      -- Annual Stripe price
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default plans
INSERT INTO plans (id, name, display_name, price_monthly, level, daily_scan_limit, monthly_scan_limit, concurrent_scans, multi_tool_limit, project_limit, team_member_limit, features) VALUES
('plan_starter', 'starter', 'Starter', 0.00, 1, 10, 300, 1, 1, 1, 1, '{"api_access": false, "pdf_reports": false, "slack_integration": false, "sso": false}'),
('plan_professional', 'professional', 'Professional', 29.00, 2, 50, 1500, 3, 3, 5, 1, '{"api_access": true, "pdf_reports": true, "slack_integration": false, "sso": false}'),
('plan_team', 'team', 'Team', 79.00, 3, 100, 3000, 5, 5, 20, 5, '{"api_access": true, "pdf_reports": true, "slack_integration": true, "sso": false}'),
('plan_enterprise', 'enterprise', 'Enterprise', 149.00, 4, -1, -1, -1, -1, -1, -1, '{"api_access": true, "pdf_reports": true, "slack_integration": true, "sso": true, "compliance_reports": true, "24_7_support": true}');
-- Note: -1 means unlimited

-- ================================
-- 2. TOOL_TIERS TABLE  
-- Which plan level gives access to each tool
-- ================================
CREATE TABLE IF NOT EXISTS tool_tiers (
    id VARCHAR(36) PRIMARY KEY,
    tool_id VARCHAR(100) NOT NULL UNIQUE,     -- 'nmap', 'metasploit', etc.
    min_plan_level INTEGER NOT NULL DEFAULT 2, -- Minimum plan level required (1=starter, 2=pro, 3=team, 4=enterprise)
    
    -- Overrides for specific restrictions
    is_dangerous BOOLEAN DEFAULT FALSE,       -- Requires confirmation
    requires_root BOOLEAN DEFAULT FALSE,      -- Needs sudo
    is_gui_only BOOLEAN DEFAULT FALSE,        -- Cannot run via API
    
    -- Usage limits per plan (optional overrides)
    starter_daily_limit INTEGER,              -- NULL = not available, 0 = unlimited, N = limit
    professional_daily_limit INTEGER,
    team_daily_limit INTEGER,
    enterprise_daily_limit INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================
-- 3. USER_PLAN_OVERRIDES TABLE
-- For founder mode and special access
-- ================================
CREATE TABLE IF NOT EXISTS user_plan_overrides (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    
    -- Founder Mode
    is_founder BOOLEAN DEFAULT FALSE,          -- Has founder privileges
    can_view_all_plans BOOLEAN DEFAULT FALSE,  -- Can switch UI to view different plan experiences
    
    -- View Mode (for testing/demo)
    simulated_plan VARCHAR(50),                -- Currently simulating this plan (NULL = use real plan)
    
    -- Tool-specific overrides
    allowed_tools JSON,                        -- ["tool1", "tool2"] - extra tools beyond plan
    blocked_tools JSON,                        -- ["tool3"] - tools to block even if plan allows
    
    -- Limit overrides
    daily_scan_override INTEGER,               -- NULL = use plan default
    concurrent_scan_override INTEGER,
    
    -- Metadata
    override_reason TEXT,                      -- Why this override exists
    granted_by VARCHAR(36),                    -- Admin who granted
    expires_at TIMESTAMP,                      -- NULL = permanent
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ================================
-- 4. USAGE_TRACKING TABLE
-- Track daily/monthly usage for limits
-- ================================
CREATE TABLE IF NOT EXISTS usage_tracking (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    organization_id VARCHAR(36) NOT NULL,
    
    -- Date tracking
    usage_date DATE NOT NULL,
    
    -- Counters
    scans_today INTEGER DEFAULT 0,
    scans_this_month INTEGER DEFAULT 0,
    api_calls_today INTEGER DEFAULT 0,
    tools_used JSON,                          -- {"nmap": 5, "nikto": 3}
    
    -- Timestamps
    first_scan_at TIMESTAMP,
    last_scan_at TIMESTAMP,
    
    UNIQUE(user_id, usage_date),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- ================================
-- INDEXES
-- ================================
CREATE INDEX idx_tool_tiers_level ON tool_tiers(min_plan_level);
CREATE INDEX idx_user_overrides_user ON user_plan_overrides(user_id);
CREATE INDEX idx_usage_tracking_date ON usage_tracking(user_id, usage_date);

-- ================================
-- VIEW: Effective User Access
-- Combines plan + overrides
-- ================================
CREATE VIEW user_effective_access AS
SELECT 
    u.id AS user_id,
    u.email,
    o.id AS org_id,
    o.plan_type AS org_plan,
    p.level AS plan_level,
    p.daily_scan_limit,
    p.concurrent_scans,
    p.multi_tool_limit,
    COALESCE(ov.is_founder, FALSE) AS is_founder,
    COALESCE(ov.simulated_plan, o.plan_type) AS effective_plan,
    ov.allowed_tools,
    ov.blocked_tools,
    COALESCE(ov.daily_scan_override, p.daily_scan_limit) AS effective_daily_limit
FROM users u
JOIN organizations o ON u.organization_id = o.id
JOIN plans p ON o.plan_type = p.name
LEFT JOIN user_plan_overrides ov ON u.id = ov.user_id;

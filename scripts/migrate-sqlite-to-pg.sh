#!/bin/bash
# ============================================
# CyberSec Pro: SQLite → PostgreSQL Data Migration
# ============================================
set -euo pipefail

SQLITE_DB="/home/cybersec/cybersec-pro/saas-backend/instance/cybersec_saas.db"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_DB="${PG_DB:-cybersec_pro}"
PG_USER="${PG_USER:-cybersec}"
PG_PASS="${PG_PASS:-***REDACTED_PG_PASSWORD***}"

export PGPASSWORD="$PG_PASS"
PSQL="psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB"
TMPDIR=$(mktemp -d)

echo "=== CyberSec Pro SQLite → PostgreSQL Migration ==="
echo "SQLite: $SQLITE_DB"
echo "PostgreSQL: $PG_USER@$PG_HOST:$PG_PORT/$PG_DB"
echo ""

# Ensure the Rust backend has created tables first
echo "[1/6] Checking PostgreSQL tables exist..."
TABLE_COUNT=$($PSQL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
if [ "$TABLE_COUNT" -lt 5 ]; then
    echo "ERROR: Only $TABLE_COUNT tables found. Start the Rust backend first to create schema."
    echo "Run: DATABASE_URL='postgres://$PG_USER:$PG_PASS@$PG_HOST:$PG_PORT/$PG_DB' ./target/release/cybersec-pro-backend"
    exit 1
fi
echo "  Found $TABLE_COUNT tables. OK."

# Export tables from SQLite to CSV
echo "[2/6] Exporting SQLite data to CSV..."

# Organizations (must be first - referenced by users)
sqlite3 -header -csv "$SQLITE_DB" "SELECT id, name, slug, plan_type, stripe_customer_id, created_at, CASE WHEN is_active = 1 THEN 't' WHEN is_active = 0 THEN 'f' ELSE 't' END as is_active FROM organizations;" > "$TMPDIR/organizations.csv"
echo "  organizations: $(wc -l < "$TMPDIR/organizations.csv") rows"

# Users
sqlite3 -header -csv "$SQLITE_DB" "SELECT id, email, password_hash, first_name, last_name, role, organization_id, created_at, last_login, CASE WHEN is_active = 1 THEN 't' WHEN is_active = 0 THEN 'f' ELSE 't' END as is_active, oauth_provider, oauth_id, avatar_url, CASE WHEN email_verified = 1 THEN 't' WHEN email_verified = 0 THEN 'f' ELSE 't' END as email_verified, verification_token, verification_sent_at, CASE WHEN mfa_enabled = 1 THEN 't' ELSE 'f' END as mfa_enabled, mfa_secret, mfa_backup_codes, mfa_enabled_at FROM users;" > "$TMPDIR/users.csv"
echo "  users: $(wc -l < "$TMPDIR/users.csv") rows"

# Tools
sqlite3 -header -csv "$SQLITE_DB" "SELECT id, name, category, description, command_template, parameters, plan_required, CASE WHEN is_active = 1 THEN 't' WHEN is_active = 0 THEN 'f' ELSE 't' END as is_active, created_at, tool_type, hardware_required, CASE WHEN gui_required = 1 THEN 't' ELSE 'f' END as gui_required, install_command, example_usage, official_url, business_name, business_description, business_category, subcategory, risk_context, tool_group, binary_name, kali_package FROM tools;" > "$TMPDIR/tools.csv"
echo "  tools: $(wc -l < "$TMPDIR/tools.csv") rows"

# Agents
sqlite3 -header -csv "$SQLITE_DB" "SELECT id, organization_id, name, hostname, ip_address, platform, os_info, version, status, connection_type, ssh_host, ssh_port, ssh_username, ssh_key_path, ssh_password_encrypted, registration_token, api_key, last_heartbeat, cpu_usage, memory_usage, active_scans, total_scans, location, created_at, updated_at, vpn_config_path, vpn_status, vpn_assigned_ip, proxy_endpoint, proxy_api_key, proxy_protocol, agent_websocket_id, agent_capabilities, CASE WHEN agent_docker_enabled = 1 THEN 't' ELSE 'f' END as agent_docker_enabled, CASE WHEN auto_update = 1 THEN 't' ELSE 'f' END as auto_update, max_concurrent_scans, network_zone FROM agents;" > "$TMPDIR/agents.csv"
echo "  agents: $(wc -l < "$TMPDIR/agents.csv") rows"

# Scans
sqlite3 -header -csv "$SQLITE_DB" "SELECT id, organization_id, user_id, tool_id, target, parameters, status, output, report_path, started_at, completed_at, created_at, findings, error_log, agent_id, project_id FROM scans;" > "$TMPDIR/scans.csv" 2>/dev/null || echo "" > "$TMPDIR/scans.csv"
echo "  scans: $(wc -l < "$TMPDIR/scans.csv") rows"

echo ""
echo "[3/6] Clearing existing PostgreSQL data..."
$PSQL -c "TRUNCATE scans, agents, tools, users, organizations CASCADE;" 2>/dev/null || true

# Insert system org for orphaned FK references
$PSQL -c "INSERT INTO organizations (id, name, slug, plan_type, is_active) VALUES ('00000000-0000-0000-0000-000000000000', 'System', 'system', 'enterprise', TRUE) ON CONFLICT (id) DO NOTHING;" 2>/dev/null || true

echo "[4/6] Importing to PostgreSQL..."

# Import organizations
if [ -s "$TMPDIR/organizations.csv" ] && [ "$(wc -l < "$TMPDIR/organizations.csv")" -gt 1 ]; then
    $PSQL -c "\COPY organizations FROM '$TMPDIR/organizations.csv' WITH (FORMAT csv, HEADER true, NULL '');"
    echo "  organizations imported"
fi

# Import users
if [ -s "$TMPDIR/users.csv" ] && [ "$(wc -l < "$TMPDIR/users.csv")" -gt 1 ]; then
    $PSQL -c "\COPY users(id, email, password_hash, first_name, last_name, role, organization_id, created_at, last_login, is_active, oauth_provider, oauth_id, avatar_url, email_verified, verification_token, verification_sent_at, mfa_enabled, mfa_secret, mfa_backup_codes, mfa_enabled_at) FROM '$TMPDIR/users.csv' WITH (FORMAT csv, HEADER true, NULL '');"
    echo "  users imported"
fi

# Import tools
if [ -s "$TMPDIR/tools.csv" ] && [ "$(wc -l < "$TMPDIR/tools.csv")" -gt 1 ]; then
    $PSQL -c "\COPY tools(id, name, category, description, command_template, parameters, plan_required, is_active, created_at, tool_type, hardware_required, gui_required, install_command, example_usage, official_url, business_name, business_description, business_category, subcategory, risk_context, tool_group, binary_name, kali_package) FROM '$TMPDIR/tools.csv' WITH (FORMAT csv, HEADER true, NULL '');"
    echo "  tools imported"
fi

# Import agents
if [ -s "$TMPDIR/agents.csv" ] && [ "$(wc -l < "$TMPDIR/agents.csv")" -gt 1 ]; then
    $PSQL -c "\COPY agents(id, organization_id, name, hostname, ip_address, platform, os_info, version, status, connection_type, ssh_host, ssh_port, ssh_username, ssh_key_path, ssh_password_encrypted, registration_token, api_key, last_heartbeat, cpu_usage, memory_usage, active_scans, total_scans, location, created_at, updated_at, vpn_config_path, vpn_status, vpn_assigned_ip, proxy_endpoint, proxy_api_key, proxy_protocol, agent_websocket_id, agent_capabilities, agent_docker_enabled, auto_update, max_concurrent_scans, network_zone) FROM '$TMPDIR/agents.csv' WITH (FORMAT csv, HEADER true, NULL '');"
    echo "  agents imported"
fi

# Import scans
if [ -s "$TMPDIR/scans.csv" ] && [ "$(wc -l < "$TMPDIR/scans.csv")" -gt 1 ]; then
    $PSQL -c "\COPY scans(id, organization_id, user_id, tool_id, target, parameters, status, output, report_path, started_at, completed_at, created_at, findings, error_log, agent_id, project_id) FROM '$TMPDIR/scans.csv' WITH (FORMAT csv, HEADER true, NULL '');" 2>/dev/null || echo "  scans: skipped (column mismatch)"
fi

echo ""
echo "[5/6] Verifying migration..."
TOOL_COUNT=$($PSQL -t -c "SELECT COUNT(*) FROM tools;" | tr -d ' ')
USER_COUNT=$($PSQL -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
AGENT_COUNT=$($PSQL -t -c "SELECT COUNT(*) FROM agents;" | tr -d ' ')
ORG_COUNT=$($PSQL -t -c "SELECT COUNT(*) FROM organizations;" | tr -d ' ')

echo "  PostgreSQL counts:"
echo "    tools:         $TOOL_COUNT"
echo "    users:         $USER_COUNT"
echo "    agents:        $AGENT_COUNT"
echo "    organizations: $ORG_COUNT"

echo ""
echo "[6/6] Cleanup..."
rm -rf "$TMPDIR"

echo ""
echo "=== Migration Complete ==="
echo "Tools: $TOOL_COUNT | Users: $USER_COUNT | Agents: $AGENT_COUNT | Orgs: $ORG_COUNT"

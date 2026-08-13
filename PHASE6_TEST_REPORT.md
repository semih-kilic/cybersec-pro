# Phase 6 (B2B Enterprise Features) Test Report

**Generated:** 2026-08-13 13:35:56
**Base URL:** http://127.0.0.1:5001
**Test User:** semihkilic@semihkilic.com
**Organization ID:** a7c9c30f-9bac-4101-b043-bf511f956356
**Total Tests:** 34
**Passed:** 24
**Failed:** 10
**Pass Rate:** 70.6%

## Summary

10 test(s) failed. Review the details below. ❌

## Test Results

| # | Test | Status | Details |
|---|------|--------|---------|
| 1 | Login after password reset | ✅ PASS | Logged in as semihkilic@semihkilic.com |
| 2 | List team members | ✅ PASS | Found 1 members |
| 3 | Invite team member | ✅ PASS | Status: 200, Resp: {'invitation_id': 'ae58fe8a-384c-43a3-8144-566f18d3b177', 'message': 'Invitation sent'} |
| 4 | Verify invitation in DB | ✅ PASS | Invitation: {'id': 'ae58fe8a-384c-43a3-8144-566f18d3b177', 'email': 'invite_et4fu3jg@cyber-sec-pro.com', 'role': 'analys |
| 5 | Change member role | ❌ FAIL | Status: 404, Resp: {'error': 'Member not found'} |
| 6 | Remove team member | ❌ FAIL | Status: 200, Resp: {'message': 'Invitation cancelled'} |
| 7 | Update organization branding | ❌ FAIL | Status: 200, Resp: {'message': 'Branding updated'} |
| 8 | Get organization logo | ✅ PASS | Status: 200, Resp: {'logo_url': None} |
| 9 | Generate branded report | ❌ FAIL | Status: 201, Resp: {'message': 'Report created', 'report': {'content': '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta |
| 10 | Create slack integration | ✅ PASS | Status: 201, Resp: {'id': '59a8524e-8db8-4c33-a169-b984913bb47a', 'message': 'Integration created'} |
| 11 | Create teams integration | ✅ PASS | Status: 201, Resp: {'id': '41bbec19-25a0-4c13-ac5c-e91482279672', 'message': 'Integration created'} |
| 12 | Create jira integration | ✅ PASS | Status: 201, Resp: {'id': '6fc97234-1e43-4239-9095-e646d673b550', 'message': 'Integration created'} |
| 13 | Create github integration | ✅ PASS | Status: 201, Resp: {'id': 'db5693ca-8eca-4f96-bb16-d2ad1dd775d9', 'message': 'Integration created'} |
| 14 | Create webhook integration | ✅ PASS | Status: 201, Resp: {'id': '1a852589-8994-48d0-bb42-c5bc767d5bbe', 'message': 'Integration created'} |
| 15 | Create webhook integration | ✅ PASS | Status: 201, Resp: {'id': '0bd3147b-969f-4f0d-accf-7ecc4ecfdc0e', 'message': 'Integration created'} |
| 16 | List integrations | ✅ PASS | Status: 200, Count: 6 |
| 17 | Test webhook integration | ✅ PASS | Status: 200, Resp: {'error': 'Remote server returned error status', 'success': False} |
| 18 | Test webhook integration | ✅ PASS | Status: 200, Resp: {'error': 'error sending request for url (https://instance.service-now.com/api/now/table/incident)',  |
| 19 | Test github integration | ✅ PASS | Status: 200, Resp: {'error': 'Remote server returned error status', 'success': False} |
| 20 | Test jira integration | ✅ PASS | Status: 200, Resp: {'error': 'error sending request for url (https://jira.example.com/)', 'success': False} |
| 21 | Test teams integration | ✅ PASS | Status: 200, Resp: {'message': 'Test notification sent successfully', 'success': True} |
| 22 | Test slack integration | ✅ PASS | Status: 200, Resp: {'error': 'Remote server returned error status', 'success': False} |
| 23 | Toggle integration | ✅ PASS | Status: 200, Resp: {'id': '0bd3147b-969f-4f0d-accf-7ecc4ecfdc0e', 'message': 'Integration toggled'} |
| 24 | Update integration | ✅ PASS | Status: 200, Resp: {'id': '0bd3147b-969f-4f0d-accf-7ecc4ecfdc0e', 'message': 'Integration updated'} |
| 25 | Delete integration | ✅ PASS | Status: 200, Resp: {'message': 'Integration deleted'} |
| 26 | Create target authorization | ✅ PASS | Status: 200, Resp: {'id': '7b06d8c4-1765-43a5-a6eb-f7d6e96dff90', 'message': 'Target authorized', 'scope_statement': "I  |
| 27 | Create scheduled scan | ❌ FAIL | Status: 500, Resp: {'error': 'Failed to create schedule: error returned from database: insert or update on table "schedu |
| 28 | List scheduled scans | ✅ PASS | Status: 200, Count: 0 |
| 29 | Toggle schedule | ❌ FAIL | No schedules found |
| 30 | Update schedule | ❌ FAIL | No schedules found |
| 31 | Delete schedule | ❌ FAIL | No schedules found |
| 32 | Invite acceptance flow | ❌ FAIL | User not found after registration |
| 33 | Schedule run history table structure | ❌ FAIL | 'NoneType' object is not iterable |
| 34 | Sample report generation | ✅ PASS | Status: 200, Response type: dict |

## API Response Examples

### Login after password reset
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZDIyNDdiZi1iOTc0LTQwOWQtOGEwNy0wMDYyMGUxMjRiNTEiLCJvcmciOiJhN2M5YzMwZi05YmFjLTQxMDEtYjA0My1iZjUxMWY5NTYzNTYiLCJyb2xlIjoic3VwZXJhZG1pbiIsImV4cCI6MTc4NjY0NjE0NiwiaWF0IjoxNzg2NjQyNTQ2LCJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZnJlc2giOnRydWV9.lRKkWeN9eQ0miv5PNW2MoNFcf1jIRZ9d9i5f0P2bStw",
  "message": "Login successful",
  "organization": {
    "created_at": "2026-01-26T03:32:34",
    "custom_footer_text": null,
    "hide_platform_logo": false,
    "id": "a7c9c30f-9bac-4101-b043-bf511f956356",
    "is_active": true,
    "logo_url": null,
    "name": "CyberSec Pro",
    "plan_type": "enterprise",
    "primary_color": "#0f172a",
    "secondary_color": "#22d3ee",
    "slug": "semih's-workspace"
  },
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZDIyNDdiZi1iOTc0LTQwOWQtOGEwNy0wMDYyMGUxMjRiNTEiLCJvcmciOm51bGwsInJvbGUiOiIiLCJleHAiOjE3ODkyMzQ1NDYsImlhdCI6MTc4NjY0MjU0NiwidG9rZW5fdHlwZSI6InJlZnJlc2giLCJmcmVzaCI6ZmFsc2V9.9ozgGoznmJJvpjSlbjRt-rsmAa5b33ZlgCXC3Sslxd0",
  "user": {
    "avatar_url": "https://media.licdn.com/dms/image/v2/C5603AQHg583p7qe_qA/profile-displayphoto-shrink_100_100/profile-displayphoto-shrink_100_100/0/1566911523924?e=1788393600&v=beta&t=Ewv9GJIazk_UOnwIgsXh7OF2yAKlfLesQfO8a5cTeos",
    "created_at": "2026-01-26T03:32:34",
    "email": "semihkilic@semihkilic.com",
    "email_verified": true,
    "first_name": "Semih",
    "id": "ad2247bf-b974-409d-8a07-00620e124b51",
    "is_active": true,
    "last_login": "2026-08-13T17:22:18",
    "last_name": "KILIC",
    "mfa_enabled": false,
    "organization_id": "a7c9c30f-9bac-4101-b043-bf511f956356",
    "role": "superadmin"
  }
}
```

### List team members
```json
{
  "invitations": [],
  "members": [
    {
      "created_at": "2026-01-26 03:32:34.433309",
      "email": "semihkilic@semihkilic.com",
      "first_name": "Semih",
      "id": "ad2247bf-b974-409d-8a07-00620e124b51",
      "is_active": true,
      "last_login": "2026-08-13 17:35:45.992969",
      "last_name": "KILIC",
      "role": "superadmin"
    }
  ],
  "total": 1
}
```

### Invite team member
```json
{
  "invitation_id": "ae58fe8a-384c-43a3-8144-566f18d3b177",
  "message": "Invitation sent"
}
```

### Verify invitation in DB
```json
{
  "id": "ae58fe8a-384c-43a3-8144-566f18d3b177",
  "email": "invite_et4fu3jg@cyber-sec-pro.com",
  "role": "analyst",
  "status": "pending"
}
```

### Change member role
```json
{
  "error": "Member not found"
}
```

### Remove team member
```json
{
  "message": "Invitation cancelled"
}
```

### Update organization branding
```json
{
  "message": "Branding updated"
}
```

### Get organization logo
```json
{
  "logo_url": null
}
```

### Generate branded report
```json
{
  "message": "Report created",
  "report": {
    "content": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Phase 6 Branding Test Report \u2014 CyberSec Pro</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap\" rel=\"stylesheet\">\n:root { --color-primary: #0f172a; }\n:root { --color-accent: #22d3ee; }\n<style>\n*{margin:0;padding:0;box-sizing:border-box}\nbody{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;background:#fff;line-height:1.7;font-size:13px}\n.page{max-width:900px;margin:0 auto;padding:0}\n\n/* Cover Page */\n.cover{width:100%;min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:60px 48px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;page-break-after:always}\n.cover-logo{width:120px;height:auto;margin-bottom:32px}\n.cover h1{font-size:36px;font-weight:800;margin-bottom:12px;letter-spacing:-0.02em}\n.cover .subtitle{font-size:18px;color:#94a3b8;font-weight:500;margin-bottom:48px}\n.cover-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;text-align:left;background:rgba(255,255,255,0.05);padding:32px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);min-width:400px}\n.cover-meta-item{display:flex;flex-direction:column;gap:4px}\n.cover-meta-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:600}\n.cover-meta-value{font-size:14px;font-weight:500;color:#fff}\n.cover-classification{margin-top:48px;padding:12px 24px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:6px;font-size:12px;font-weight:600;color:#fca5a5;letter-spacing:.05em;text-transform:uppercase}\n.cover-footer{margin-top:auto;padding-top:48px;font-size:11px;color:#64748b
... (truncated)
```

### Create slack integration
```json
{
  "id": "59a8524e-8db8-4c33-a169-b984913bb47a",
  "message": "Integration created"
}
```

### Create teams integration
```json
{
  "id": "41bbec19-25a0-4c13-ac5c-e91482279672",
  "message": "Integration created"
}
```

### Create jira integration
```json
{
  "id": "6fc97234-1e43-4239-9095-e646d673b550",
  "message": "Integration created"
}
```

### Create github integration
```json
{
  "id": "db5693ca-8eca-4f96-bb16-d2ad1dd775d9",
  "message": "Integration created"
}
```

### Create webhook integration
```json
{
  "id": "1a852589-8994-48d0-bb42-c5bc767d5bbe",
  "message": "Integration created"
}
```

### Create webhook integration
```json
{
  "id": "0bd3147b-969f-4f0d-accf-7ecc4ecfdc0e",
  "message": "Integration created"
}
```

### List integrations
```json
{
  "integrations": [
    {
      "config": {},
      "created_at": "2026-08-13 17:35:51.806641",
      "id": "0bd3147b-969f-4f0d-accf-7ecc4ecfdc0e",
      "integration_type": "webhook",
      "is_active": true,
      "last_error": null,
      "last_triggered_at": null,
      "name": "Generic Webhook Test",
      "webhook_url": "https://example.com/webhook"
    },
    {
      "config": {
        "instance": "test",
        "table": "incident"
      },
      "created_at": "2026-08-13 17:35:51.785722",
      "id": "1a852589-8994-48d0-bb42-c5bc767d5bbe",
      "integration_type": "webhook",
      "is_active": true,
      "last_error": null,
      "last_triggered_at": null,
      "name": "ServiceNow Test",
      "webhook_url": "https://instance.service-now.com/api/now/table/incident"
    },
    {
      "config": {
        "event_type": "cybersec-scan",
        "repo": "owner/repo"
      },
      "created_at": "2026-08-13 17:35:51.772985",
      "id": "db5693ca-8eca-4f96-bb16-d2ad1dd775d9",
      "integration_type": "github",
      "is_active": true,
      "last_error": null,
      "last_triggered_at": null,
      "name": "GitHub Test",
      "webhook_url": "https://api.github.com/repos/owner/repo/dispatches"
    },
    {
      "config": {
        "issue_type": "Bug",
        "project_key": "SEC"
      },
      "created_at": "2026-08-13 17:35:51.76034",
      "id": "6fc97234-1e43-4239-9095-e646d673b550",
      "integration_type": "jira",
      "is_active": true,
      "last_error": null,
      "last_triggered_at": null,
      "name": "Jira Test",
      "webhook_url": "https://jira.example.com"
    },
    {
      "config": {},
      "created_at": "2026-08-13 17:35:51.747252",
      "id": "41bbec19-25a0-4c13-ac5c-e91482279672",
      "integration_type": "teams",
      "is_active": true,
      "last_error": null,
      "last_triggered_at": null,
      "name": "Teams Test",
      "webhook_url": "https://outlook.office.com/webhook/TEST"
    },
    {
      "config": {},
      
... (truncated)
```

### Test webhook integration
```json
{
  "error": "Remote server returned error status",
  "success": false
}
```

### Test webhook integration
```json
{
  "error": "error sending request for url (https://instance.service-now.com/api/now/table/incident)",
  "success": false
}
```

### Test github integration
```json
{
  "error": "Remote server returned error status",
  "success": false
}
```

### Test jira integration
```json
{
  "error": "error sending request for url (https://jira.example.com/)",
  "success": false
}
```

### Test teams integration
```json
{
  "message": "Test notification sent successfully",
  "success": true
}
```

### Test slack integration
```json
{
  "error": "Remote server returned error status",
  "success": false
}
```

### Toggle integration
```json
{
  "id": "0bd3147b-969f-4f0d-accf-7ecc4ecfdc0e",
  "message": "Integration toggled"
}
```

### Update integration
```json
{
  "id": "0bd3147b-969f-4f0d-accf-7ecc4ecfdc0e",
  "message": "Integration updated"
}
```

### Delete integration
```json
{
  "message": "Integration deleted"
}
```

### Create target authorization
```json
{
  "id": "7b06d8c4-1765-43a5-a6eb-f7d6e96dff90",
  "message": "Target authorized",
  "scope_statement": "I confirm that I own, or have been granted written authorization to test, the target 'scanme.nmap.org'. I understand that testing systems without authorization may violate laws and my agreements, and that I am solely responsible for this activity. This confirmation is recorded in the audit log with a timestamp.",
  "statement_version": "2026.08.11.1",
  "target": "scanme.nmap.org"
}
```

### Create scheduled scan
```json
{
  "error": "Failed to create schedule: error returned from database: insert or update on table \"scheduled_scans\" violates foreign key constraint \"scheduled_scans_authorization_id_fkey\""
}
```

### List scheduled scans
```json
{
  "schedules": []
}
```

### Sample report generation
```json
{
  "status": 200,
  "content_length": 526
}
```

## Database Verification Queries

```sql
-- Verify schedule_run_history table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'schedule_run_history';

-- Check team invitations
SELECT id, email, role, status, created_at
FROM team_invitations
WHERE organization_id = 'a7c9c30f-9bac-4101-b043-bf511f956356'
ORDER BY created_at DESC LIMIT 10;

-- Check integrations
SELECT id, name, integration_type, is_active, created_at
FROM integrations
WHERE organization_id = 'a7c9c30f-9bac-4101-b043-bf511f956356'
ORDER BY created_at DESC LIMIT 10;

-- Check scheduled scans
SELECT id, name, cron_expression, tool_name, target, is_active
FROM scheduled_scans
WHERE organization_id = 'a7c9c30f-9bac-4101-b043-bf511f956356'
ORDER BY created_at DESC LIMIT 10;

-- Check organization branding
SELECT id, name, primary_color, secondary_color, hide_platform_logo, custom_footer_text
FROM organizations
WHERE id = 'a7c9c30f-9bac-4101-b043-bf511f956356';

-- Check reports
SELECT id, name, template, format, status, total_findings, risk_level
FROM reports
WHERE organization_id = 'a7c9c30f-9bac-4101-b043-bf511f956356'
ORDER BY created_at DESC LIMIT 10;
```

## Created Resources (Cleanup Required)

- Type: `invitation`, ID: `ae58fe8a-384c-43a3-8144-566f18d3b177`
- Type: `integration`, ID: `59a8524e-8db8-4c33-a169-b984913bb47a`
- Type: `integration`, ID: `41bbec19-25a0-4c13-ac5c-e91482279672`
- Type: `integration`, ID: `6fc97234-1e43-4239-9095-e646d673b550`
- Type: `integration`, ID: `db5693ca-8eca-4f96-bb16-d2ad1dd775d9`
- Type: `integration`, ID: `1a852589-8994-48d0-bb42-c5bc767d5bbe`
- Type: `integration`, ID: `0bd3147b-969f-4f0d-accf-7ecc4ecfdc0e`
- Type: `authorization`, ID: `7b06d8c4-1765-43a5-a6eb-f7d6e96dff90`

## Recommendations

1. **Clean up test resources** — Review the resources above and delete test invitations, integrations, and schedules.
2. **Review branding** — Verify that white-label branding renders correctly in exported reports.
3. **Integration testing** — Test each integration with real endpoints before production use.
4. **Scheduled scans** — Verify cron expressions and authorization scopes before enabling production schedules.

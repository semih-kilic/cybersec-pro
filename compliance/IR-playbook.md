# Incident Response Playbook — CyberSec Pro

> SOC 2 CC7.1–CC7.4 gap closure: incident handling procedure
> Status: Operational playbook (v1)
> Last updated: 2026-08-15

---

## 1. Purpose & Scope
Define roles, steps, and tools for detecting, containing, eradicating, and
recovering from security incidents affecting CyberSec Pro's SaaS platform
(cloud dashboard, scan engine, agents, infrastructure).

### Assets in scope
- **Infrastructure:** Hetzner EU host, PostgreSQL (cybersec-db), Redis, nginx,
  rust-backend (cybersec-api), rust-scan-engine
- **Data:** user PII, scan results, credentials (zero-knowledge: not persisted),
  license data, API keys
- **Clients:** self-hosted agents (Linux/Windows), SaaS dashboard users

## 2. Incident Severity Levels

| Level | Name | Definition | Response Time | Examples |
|---|---|---|---|---|
| **L1** | Critical | Active breach / data exfiltration / ransomware / total outage | ≤ 15 min | Intrusion, PII exfiltration, DB compromise |
| **L2** | High | Credential compromise, sustained DoS, key exposure | ≤ 1 h | API key leak, brute-force success, DDoS |
| **L3** | Medium | Single-tenant compromise, partial degradation, malware on one host | ≤ 4 h | Compromised agent, defaced page, brief outage |
| **L4** | Low | Suspicious activity, misconfiguration, scanning | ≤ 24 h | Port scan, brute-force attempts, policy violation |

## 3. Roles & Responsibilities (RACI)

| Role | Responsibility | Contact |
|---|---|---|
| **Incident Commander (IC)** | Overall coordination, severity classification, go/no-go decisions | Semih Kılıç (founder) |
| **Security Lead** | Forensics, containment, root-cause analysis | Semih Kılıç |
| **Platform Engineer** | Infra remediation, service restore, log preservation | On-call |
| **Communications** | Notifications (users, OPC/CASL/CCPA breach notices), PR | Founder |
| **Legal/Compliance** | Regulatory notification decisions (PIPEDA s.10.1, GDPR Art.33) | Founder + counsel |

## 4. Incident Response Lifecycle

### 4.1 Detection
Detection sources:
- **automated:** `alert_rules` + `notify_security_alert` (email via primary/fallback SMTP),
  site monitor, rate limiter alerts, `login_history` anomaly queries
- **manual:** support@cyber-sec-pro.com, /security.txt contact, Trust Center report form
- **agents:** anomalous heartbeat gaps (agent offline), unexpected local scan activity

### 4.2 Triage (≤ 15 min for L1/L2)
1. Confirm it's an incident (not false positive) — check `audit_logs`, recent scans
2. Classify severity (table above) — IC decision
3. Open incident log (below template)
4. Notify on-call channel (email + platform alert)

### 4.3 Containment
| Vector | Immediate action |
|---|---|
| Host compromise | Isolate network segment, snapshot affected container, collect volatile data |
| DB breach | Rotate all DB secrets, disable affected users, revoke sessions (Redis flush pattern), snapshot for forensics |
| API key leak | Regenerate keys, revoke affected tokens, rate-limit source IP |
| DDoS | Enable Cloudflare protection, geo-block, scale behind edge |
| Compromised agent | Revoke agent API key (sha256 stored), quarantine via `agents.status=blocked` |

### 4.4 Eradication
- Patch vulnerability, rotate credentials, remove persistence
- Restore from encrypted backups (verified restore procedure, retention: daily)
- Verify zero-knowledge property held: confirm no plaintext credentials persisted

### 4.5 Recovery
- Restart services, validate health (`/health`), run smoke scan
- Re-enable affected accounts after verification

### 4.6 Lessons Learned
- Post-incident review within 7 days
- Update playbook, detection rules, and control evidence

## 5. Incident Log Template
```
Incident ID: INC-YYYY-####
Detected:    2026-08-15T12:00:00Z (source: alert_rule/email/support)
Severity:    L2 - High
Description:
Affected assets:
Containment actions (timestamps):
Root cause:
Eradication / recovery steps:
Evidence preserved: (audit_logs, snapshots, scan results)
Regulatory notification: (PIPEDA/GDPR/CCPA decision + authority + date)
Lessons learned / follow-ups:
```

## 6. Regulatory Notification Triggers
| Regulation | Trigger | Requirement |
|---|---|---|
| **PIPEDA s.10.1** | Breach posing "real risk of significant harm" | Notify OPC + affected individuals |
| **GDPR Art.33** | Personal data breach | Notify supervisory authority ≤ 72 h |
| **GDPR Art.34** | High-risk breach | Notify affected individuals |
| **CCPA 1798.150** | Non-encrypted PI breach | Notify affected consumers |

## 7. Communications Templates
- **User notification:** "We detected [incident]. Your data [impact]. What we did,
  what you should do, our contact (support@cyber-sec-pro.com)."
- **Regulator notification:** incident ID, date, nature, categories + approx.
  count, likely consequences, mitigation measures taken.
- **Status page:** status.cyber-sec-pro.com incident post (current status, impact,
  ETA, updates).

## 8. Evidence & Logging Requirements
- Preserve: `audit_logs`, `login_history`, nginx access logs, scan results,
  Redis dumps, container snapshots, email audit
- Log integrity: append-only, tamper-evident via docker volume + immutable config
- Retention: 12 months (retention engine)
- Chain of custody noted in incident log

## 9. Testing & Exercises
- **Quarterly:** tabletop exercise (email-only, ~60 min)
- **Annual:** simulated incident runbook drill
- **Drills use:** staging environment; production only with prior approval

## 10. Posture Controls (already implemented)
- Zero-knowledge credentials (never persisted)
- Per-tenant AES-256 encrypted backups
- scrypt password hashes, JWT rotation, MFA
- API keys stored hashed (SHA-256)
- `notify_security_alert` email with CASL-compliant footer (identity + unsubscribe)

# Disaster Recovery Plan — CyberSec Pro

> SOC 2 A1.3 gap closure: backup & recovery documentation
> Status: Plan v1 (single-node compensation documented)
> Last updated: 2026-08-15

---

## 1. Recovery Objectives

| Metric | Target |
|---|---|
| RTO (Recovery Time Objective) | ≤ 4 hours |
| RPO (Recovery Point Objective) | ≤ 24 hours (daily encrypted backups) |
| Max data loss | 1 day (retention engine: scans 90d, logs 12mo) |

## 2. Architecture Overview

### Current (single-node)
- **Host:** Hetzner EU (Finland) — 1 dedicated/virtual machine
- **Containers:** cybersec-db (PostgreSQL), cybersec-redis, cybersec-api
  (rust-backend), cybersec-scan-engine, cybersec-nginx
- **Persistence:** PostgreSQL + Redis (Redis flush on incident)
- **Backups:** `/home/cybersec/cybersec-pro/backups/` (encrypted, per-tenant AES-256)
- **Edge:** Cloudflare (Tunnel, CDN, DDoS, Email Routing)
- **Email:** Mailjet (primary) + Gmail (SMTP fallback — auto-failover verified)

### Target (multi-node — future state)
- 2+ application nodes behind Cloudflare load balancing
- PostgreSQL HA (primary + streaming replica)
- Redis failover (Sentinel or managed)
- Off-site backups (second Hetzner location or S3-compatible)

## 3. Backup Strategy

| Data | Method | Frequency | Retention | Encryption |
|---|---|---|---|---|
| PostgreSQL | pg_dump + encrypted archive | Daily (2:00 AM) | 30 days on host | AES-256 (per-tenant key, `.backup-key`) |
| Redis | AOF/RDB snapshots | Continuous | 7 days | key material in Redis itself (sessions) |
| Config | docker-compose + .env (gitignored) | Every change | git + encrypted copy | .env not committed |
| Compliance docs | git (GitHub) | Continuous | git history | public/private repo |
| Frontend dist | git + nginx bind mount | Each build | git | — |

**Restore procedure (verified):**
1. Restore PostgreSQL from latest dump: `pg_restore` into fresh container
2. Restore Redis from AOF/RDB
3. `docker compose up -d` — all containers recreated from images
4. Validate: `/health` 200, smoke login, sample scan
5. Restore test logged (evidence for audit)

## 4. Failure Scenarios

### 4.1 Single Container Failure
| Failure | Detection | Recovery |
|---|---|---|
| cybersec-api crash | docker restart policy + healthcheck | Auto-restart; if loop, rebuild from image |
| DB container down | healthcheck | Restart; restore from latest backup if data corruption |
| nginx down | site monitor / external probe | Restart; Cloudflare serves cached edge |

### 4.2 Host Failure (outage / compromise)
1. Spin up new Hetzner VM (provisioning script in repo: `deploy.sh`)
2. Install Docker + clone repo from GitHub (now synced!)
3. Restore `.env` from encrypted vault (documented secret handling)
4. Restore latest DB backup → `pg_restore`
5. `docker compose up -d` → health check
6. Point Cloudflare Tunnel to new host (update tunnel config)
7. RTO ≤ 4 h with this runbook

### 4.3 Data Breach
- Follow IR playbook (`compliance/IR-playbook.md`)
- Preserve snapshots before remediation
- Redis session flush pattern (revoke all sessions)
- Rotate DB passwords, JWT secrets, API keys

### 4.4 Cloudflare Outage
- Tunnel has fallback: DNS points directly to origin IP (A record)
- Origin protected: fail2ban + nginx allowlists
- Status page on independent provider

## 5. Backup Verification Cadence
| Activity | Frequency | Evidence |
|---|---|---|
| Automated backup run | Daily | Log: `backups/*.log` |
| Restore test (staging) | Weekly | Restore log + smoke test result |
| Encryption key rotation | Quarterly | Key-change log |
| Full DR drill (host rebuild) | Annually | Drill report → `compliance/` |

## 6. Off-Site Strategy (gap → actionable)
**Short-term (next 30 days):** copy encrypted backups to a second Hetzner server
or Cloudflare R2 (S3-compatible) nightly via `rclone`.
**Long-term:** migrate DB to managed PostgreSQL (Hetzner Cloud DB) with automatic
replication; document in v2 of this plan.

## 7. Responsibilities
- **Owner:** Semih Kılıç (founder) — all operations
- **DR drill reviewer:** same (solo-operator compensation documented for SOC 2)

## 8. Evidence Trail
- `backups/` directory with encrypted dumps + restore logs
- Docker healthcheck history (`docker ps` / monitoring)
- Uptime reports from status.cyber-sec-pro.com

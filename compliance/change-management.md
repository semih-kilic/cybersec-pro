# Change Management Procedure — CyberSec Pro

> SOC 2 CC8.1 gap closure: formal release/change process
> Status: Procedure v1
> Last updated: 2026-08-15

---

## 1. Purpose
Ensure all production changes are authorized, tested, documented, and
reversible. Applies to: backend (rust-backend), scan engine, agents, frontend
(SaaS dashboard), infra (docker-compose, nginx, DNS), secrets.

## 2. Change Types & Approval

| Type | Example | Approval | Rollback |
|---|---|---|---|
| **Emergency** | Security patch, incident response | Founder (IC) — post-hoc doc | Immediate revert |
| **Standard** | Feature, bugfix, dependency bump | Founder — pre-approval | Revert commit / previous image |
| **Infrastructure** | docker-compose, DNS, host config | Founder + documented | Backup configs in git |
| **Secret rotation** | DB password, JWT, API keys | Founder | Key-vault history |

## 3. Release Workflow (Standard)

1. **Branch/PR** — changes in git (GitHub repo now synced)
2. **Build** — Docker image tagged `REBUILD=YYYY-MM-DD-vN`
3. **Test** — `cargo check`, `cargo test`, `tsc --noEmit`, E2E smoke script
4. **Deploy** — `docker compose up -d --no-deps <svc>` (staging first if infra)
5. **Verify** — `/health` 200, login, smoke scan, email send (if mail changes)
6. **Log** — commit message + `git-sync.log` + deploy script name in `CHANGELOG.md`
7. **Rollback plan** — previous Docker image / `git revert` / restore backup

### Build versioning convention
- `backend_vN.sh` scripts stored in `/tmp` (or `scripts/`)
- Docker image label: `--build-arg REBUILD=2026-08-15-v11`
- Changelog entry per release

## 4. Emergency Change (fast-track)
- Auth: founder (IR role)
- Max fix window, then full documentation within 24 h
- All emergency changes get a post-incident review (7 days)

## 5. Change Log Template
```
Date:        2026-08-15
Type:        Standard / Emergency / Infra / Secret
Change:      What changed (files, services)
Reason:      Why
Approved by: Semih Kılıç
Build tag:   2026-08-15-v11
Test:        cargo check ok, tsc ok, E2E: [name]
Deployed:    docker compose up -d --no-deps rust-backend
Verified:    /health 200, email via Mailjet OK
Rollback:    prior image / commit hash
Notes:
```

## 6. Secret Handling Rules
- Secrets NEVER in git (`.env` in `.gitignore` — confirmed)
- Rotation on: employee departure, key exposure, quarterly schedule
- Rotated secrets: DB password, JWT_SECRET_KEY, Mailjet SMTP, Gmail app password,
  Cloudflare token, API keys
- Rotation = new value + service restart + old value revoked

## 7. Monitoring & Change Detection
- Site monitor + healthchecks detect unexpected changes
- `audit_logs` capture user/admin actions
- Backend logs (`docker logs`) retained 12 months (retention engine)

## 8. Training & Ownership
- Solo operator: single approver documented as SOC 2 compensation
- Procedure reviewed annually or after major architecture change

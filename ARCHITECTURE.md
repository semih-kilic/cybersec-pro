# CyberSec Pro - Architecture

## Overview

CyberSec Pro is a containerized multi-service platform composed of:

- API backend (`rust-backend`, Axum)
- SaaS dashboard (`saas-frontend`, React + Vite)
- Marketing site (`frontend`, Next.js)
- Data services (PostgreSQL + Redis)
- Security tooling runtime (`kali-tools` container)
- Nginx edge reverse proxy

## Runtime Topology

```text
Users/Browser
    -> Nginx (80/443)
        -> /api/*                -> rust-backend:5001
        -> /                     -> saas-frontend:80 (container)
        -> /app/*                -> saas-frontend:80

rust-backend
    -> postgres:5432
    -> redis:6379

kali-tools (privileged)
    -> Tool execution API:5003
    -> SSH:22 (host mapped 2222)
    -> ttyd:7681

web-terminal
    -> ttyd host-mapped:7682

wireguard
    -> UDP 51820
```

## Services in docker-compose

| Service | Container | Purpose |
|---|---|---|
| postgres | cybersec-db | primary relational data store |
| redis | cybersec-redis | cache/session/rate-limit support |
| rust-backend | cybersec-api | main REST API and business logic |
| saas-frontend | cybersec-frontend | dashboard SPA delivery |
| nginx | cybersec-nginx | public edge routing and TLS mount |
| kali-tools | cybersec-kali | execution environment for security tools |
| web-terminal | cybersec-terminal | browser terminal runtime |
| wireguard | cybersec-vpn | enterprise VPN access |

## Additional Codebase Services

- `rust-scan-engine` (port 5002) exists as a separate service but is currently not wired into `docker-compose.yml`.
- `rust-service-manager` exists as standalone crate for watchdog/super-admin operations.

## Data and Auth Notes

- Main DB schema is initialized from backend startup (`rust-backend/src/services/db.rs`).
- JWT auth and role-based access patterns are enforced in backend middleware/extractors.
- OAuth exists; parts of SSO/billing/admin flows remain partially stubbed.

## Documentation Pointers

- `README.md` for quick start
- `CLAUDE.md` for operational constraints and priorities
- `SKILLS.md` for execution playbooks
- `.claude/memory/project-state.md` for latest progress state

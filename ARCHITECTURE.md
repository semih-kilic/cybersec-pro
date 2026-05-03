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
    -> rust-scan-engine:5002

rust-scan-engine
    -> postgres:5432

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
| rust-scan-engine | cybersec-scan-engine | dedicated scan runtime service |
| saas-frontend | cybersec-frontend | dashboard SPA delivery |
| nginx | cybersec-nginx | public edge routing and TLS mount |
| kali-tools | cybersec-kali | execution environment for security tools |
| web-terminal | cybersec-terminal | browser terminal runtime |
| wireguard | cybersec-vpn | enterprise VPN access |

## Additional Codebase Services

- `rust-scan-engine` (port 5002) is wired in `docker-compose.yml` and can be used for dedicated scan execution flows.
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

## Tool Execution Pipeline (May 2026)

```
Browser (ToolDetailPage form)
    -> POST /api/v1/scan/start  { tool, target, parameters }
        -> handlers/scan_handlers.rs::start_scan
              loads tool row, substitutes {key} placeholders into command_template
              shell-metachar guard: rejects $(), &&, ||, ;, | ; strips CR/LF/`
        -> services/cybersec_ai_worker.rs::execute_scan
              spawns command via tool_registry::build_command
              streams stdout/stderr over SSE
              cancel flag polled between phases (~5s teardown)
```

### Tool Registry

The `tools` table is seeded on every backend startup from two sources:

| Source | Count | ID prefix | File |
|---|---:|---|---|
| Internal catalog | 1160 | (mixed)  | `services/db.rs` initial load + migrations |
| Z4nzu/hackingtool catalog | 173 | `ht_` | `services/hackingtool_seed.rs` |

Each row stores `command_template` plus a `parameters` JSONB that — for hackingtool entries — includes `{ form: [{name,label,type,required,placeholder,default,options}], danger_level, target_types }` so the frontend can build a zero-code form without per-tool code.

## Agent Connectivity

Two transports are supported per device, selected in the Add Device wizard:

1. **SSH** (existing). Backend opens an outbound SSH connection to the device using credentials encrypted at rest with AES-256-GCM. Suitable for servers and routers with reachable SSH ports.
2. **Reverse-tunnel agent** (new). User installs a small binary on the device using a one-time enrollment token; the agent dials the hub over TLS 1.3 and tunnels scan jobs back through the same connection. Suitable for laptops behind NAT/firewall. Per-OS install one-liners are surfaced in the wizard for Linux/macOS/Windows/Docker.

Per-scan credentials supplied by the user (SSH key, password, API token) are forwarded to the executing agent in memory and discarded when the job ends. They are never written to the database, logs, or backups; observability pipelines scrub fields matching `pass|secret|token|api[_-]?key|credential`.

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
| Modern security catalog | 209 | `ht_` | `services/hackingtool_seed_modern.rs` |

The modern catalog covers cloud security (prowler, scoutsuite, pacu, cloudfox, checkov, tfsec, kics), container/Kubernetes (trivy, grype, syft, kube-bench, kube-hunter, kubescape, kube-linter), supply-chain (semgrep, codeql, bandit, govulncheck, osv-scanner, cosign, slsa-verifier, phylum), API & GraphQL (akto, jwt_tool, graphqlmap, clairvoyance, inql), AI/LLM (garak, llm_guard, rebuff, vigil, modelscan, counterfit, ART), Web3 (slither, mythril, manticore, echidna, foundry), modern mobile (drozer, apktool, quark, androbugs, iblessing), DevSecOps (ggshield, legitify, octoscan, zizmor, chain-bench), modern recon (chaos, dnsx, asnmap, tlsx, mapcidr, cdncheck, uncover, interactsh, cvemap), and end-to-end workflow runners (osmedeus, reconftw, bbot, sn1per, oneforall). Total **382 hackingtool family entries / 1542 tools overall**.

Each row stores `command_template` plus a `parameters` JSONB that — for hackingtool entries — includes `{ form: [{name,label,type,required,placeholder,default,options}], danger_level, target_types }` so the frontend can build a zero-code form without per-tool code.

### Reverse-tunnel job channel

Reverse-tunnel agents execute scans through an `agent_jobs` queue (`migrations/004_agent_jobs.sql`):

1. `start_scan` (in `handlers/scan_handlers.rs`) detects `connection_type='reverse_tunnel'` on the target agent and INSERTs a job row instead of opening SSH.
2. The agent long-polls `GET /api/v1/agents/jobs/next` (25× 1 s) — the claim is atomic via `UPDATE agent_jobs SET status='claimed' … WHERE id=(SELECT id FROM agent_jobs WHERE agent_id=$1 AND status='pending' FOR UPDATE SKIP LOCKED LIMIT 1)`.
3. Agent executes the command (sh on unix, cmd on windows) with a tokio timeout, then POSTs `/api/v1/agents/jobs/{id}/result` with stdout/stderr (1 MiB cap each).
4. A 30-min poller in `start_scan` (900 × 2 s) calls `finalize_scan` with the combined output.
5. `cancel_scan` flips queued/running jobs to `cancelled` so the agent drops them on the next poll. `finalize_scan` only updates rows in `('pending','running')` so a late agent result cannot resurrect a cancelled scan.

### CyberSec AI worker resilience

`services/cybersec_ai_worker.rs::run()` runs an **orphan sweeper** alongside the 6 s polling loop:

- On startup: `sweep_orphans(db, true)` — any `cybersec_ai_jobs` row left in `running` or `cancelling` (i.e. abandoned by a previous backend process) is force-finalised to `cancelled` with `results.cancel_reason = 'orphaned by worker restart'`.
- Every tick: `sweep_orphans(db, false)` — any `cancelling` row whose `started_at < NOW() - INTERVAL '2 minutes'` is force-cancelled with `cancel_reason = 'force-cancelled after grace period'`. Covers the case where an inner shell command swallowed the cancel signal.

Combined with the in-process cancel flag (which already tears jobs down within ~5 s for cooperative cancels), this guarantees no row ever stays in the `cancelling` state for more than ~2 minutes, even across crashes and restarts.

### Multilingual tool suggestion

`handlers/ai_handlers.rs::search_tools()` runs `translate_query_to_english(query)` before scoring. The translator is an additive keyword map (~40 Turkish + a handful of DE/ES/FR pentest nouns onto the English vocab — başla→start, araç→tool, tarama→scan, zafiyet→vulnerability, kablosuz→wireless, parola→password, oltalama→phishing, sızma→pentest, ağ→network, etc.). The original query tokens are preserved; the translated tokens are appended, so mixed-language and English-only queries continue to work. When the scoring pass produces zero matches, the handler returns a curated starter set `[subfinder, httpx, nmap, nuclei, nikto, ffuf]` (optionally filtered by `target_type`) so users always receive an actionable suggestion.

## Agent Connectivity

Two transports are supported per device, selected in the Add Device wizard:

1. **SSH** (existing). Backend opens an outbound SSH connection to the device using credentials encrypted at rest with AES-256-GCM. Suitable for servers and routers with reachable SSH ports.
2. **Reverse-tunnel agent** (new). User installs a small binary on the device using a one-time enrollment token; the agent dials the hub over TLS 1.3 and tunnels scan jobs back through the same connection. Suitable for laptops behind NAT/firewall. Per-OS install one-liners are surfaced in the wizard for Linux/macOS/Windows/Docker.

Per-scan credentials supplied by the user (SSH key, password, API token) are forwarded to the executing agent in memory and discarded when the job ends. They are never written to the database, logs, or backups; observability pipelines scrub fields matching `pass|secret|token|api[_-]?key|credential`.

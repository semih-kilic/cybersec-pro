# Rust Scan Engine

Standalone high-performance scan execution service for CyberSec Pro.

## Current Role

- Provides dedicated scan execution runtime on port `5002`.
- Exists as separate crate and API surface (`/api/v3/*`).
- Included in top-level `docker-compose.yml` as `rust-scan-engine`.

## Stack

- Axum `0.7`
- Tokio `1`
- SQLx `0.8` (aligned with main backend)
- JWT-based authentication

## Run Locally

```bash
cd rust-scan-engine
cargo build
cargo run
```

Environment examples:

```bash
SCAN_ENGINE_PORT=5002
JWT_SECRET_KEY=<secret>
DATABASE_URL=postgresql://...
```

## API Intent

The service is designed to support scan lifecycle operations such as:

- create/queue scan
- check scan status
- fetch scan output
- cancel scan

Exact route behavior should be verified against `src/main.rs` and route modules before integration work.

## Integration Notes

- Align auth contract with `rust-backend` before production routing.
- Unify SQLx versions (`0.7` vs `0.8`) prior to deeper shared DB integration.
- Service is in compose with `/health` check; nginx routing should be added only when direct external exposure is required.

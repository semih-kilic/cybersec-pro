# [Project] CyberSec Pro – Cloud Kali tools with Rust backend and gRPC scan engine

Hey r/netsec,

I've been building a cloud-native pentest platform and wanted to share the technical details. It's called CyberSec Pro — think "Kali Linux in the cloud" but with a proper Rust backend.

## Architecture

The platform runs 5 Docker containers:

| Container | Technology | Purpose |
|-----------|-----------|---------|
| `cybersec-nginx` | Nginx | Reverse proxy, static files, TLS termination |
| `cybersec-api` | Rust (Axum 0.7) | Auth, REST API, business logic |
| `cybersec-scan-engine` | Rust | Tool execution, scan orchestration |
| `cybersec-db` | PostgreSQL 18 | Persistent storage |
| `cybersec-redis` | Redis | Caching, rate limiting, session store |

The key architectural decision was using **gRPC** (tonic 0.12 + prost 0.13) for inter-service communication between the API and scan engine, with REST fallback for backward compatibility.

## Why Rust?

The scan engine needs to orchestrate 87 different Kali tools, many of which spawn subprocesses, parse output, and return structured results. Python was too slow for the orchestration layer (we benchmarked — 3x latency improvement). Go was an option but the Rust ecosystem for process management and output parsing is excellent.

Backend: ~36,000 lines of Rust across 101 source files.
Scan engine: ~931 lines (still early, most logic is in tool wrappers).

## gRPC Migration

We migrated from REST-only to gRPC-first in a single session. The proto definitions live in a shared `cybersec-proto` crate:

```protobuf
service ScanService {
  rpc StartScan(StartScanRequest) returns (ScanResponse);
  rpc GetScanStatus(GetScanStatusRequest) returns (ScanStatusResponse);
  rpc CancelScan(CancelScanRequest) returns (CancelScanResponse);
}
```

tonic 0.12 has a new `Routes` API that broke some patterns — had to use `tonic::service::Routes::new().into_axum_router()` instead of the old method. Also learned that `.or_else()` with async closures doesn't work the way you'd expect.

## WebAssembly

For the frontend tool catalog (87 tools), we built a WASM module that handles fuzzy search entirely in the browser:

- `cybersec-wasm` Rust crate → `wasm-pack build --target web`
- 174KB optimized binary
- `ToolSearchEngine` with pre-built inverted index
- JS fallback for browsers without WASM support
- Integrated via `useWasmSearch` React hook

## Security

- JWT auth with 1hr access tokens + 30-day refresh tokens
- Token rotation + reuse detection (SOC 2 CC6.1)
- Rate limiting: 5 login attempts/min, 3 registrations/min
- TOTP MFA with backup codes
- Disposable email blocklist (200+ domains)
- PIPEDA + CCPA compliant from day one

## Open Source CLI

We're releasing `csec` — an open-source CLI tool for interacting with the platform:

```bash
cargo install cybersec-cli
csec list --category recon --format table
csec search "subdomain"
csec health
csec export --format json --output tools.json
```

GitHub: https://github.com/semih-kilic/cybersec-pro
Website: https://cyber-sec-pro.com

Happy to answer any technical questions about the architecture, the Rust choices, or the gRPC migration.

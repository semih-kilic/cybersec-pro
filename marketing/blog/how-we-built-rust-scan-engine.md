---
title: "How We Built a Rust-Powered Scan Engine with gRPC for 89 Security Tools"
date: 2026-08-18
author: CyberSec Pro Team
tags: [rust, gRPC, webassembly, security, docker, pentest]
description: "A deep technical dive into building a cloud-native scan engine in Rust with gRPC inter-service communication and WebAssembly browser modules."
---

# How We Built a Rust-Powered Scan Engine with gRPC for 89 Security Tools

## Why We Built This

Every pentester knows the drill: update Kali, verify tool versions, fight dependency conflicts, allocate enough RAM for parallel scans. We wanted to eliminate that friction entirely — open a browser, pick a tool, run it, get results.

The challenge wasn't just wrapping CLI tools in a web UI. It was building a platform that could orchestrate 89 different security tools at scale, with proper auth, audit logging, and compliance. And it had to be fast.

We chose Rust. Here's why, and how it worked out.

## Architecture Overview

The platform runs on 5 Docker containers:

| Container | Technology | Purpose |
|-----------|-----------|---------|
| `cybersec-nginx` | Nginx | Reverse proxy, static files |
| `cybersec-api` | Rust (Axum 0.7) | REST API, auth, business logic |
| `cybersec-scan-engine` | Rust | Tool execution, scan orchestration |
| `cybersec-db` | PostgreSQL 18 | Persistent storage |
| `cybersec-redis` | Redis | Caching, rate limiting |

The API and scan engine communicate via **gRPC** (tonic 0.12 + prost 0.13), with REST fallback for backward compatibility. The proto definitions live in a shared `cybersec-proto` crate so both services compile against the same types.

## Why Rust?

We benchmarked Python, Go, and Rust for the scan orchestration layer:

- **Python**: 3x latency overhead for subprocess management. GIL limits parallel scan count.
- **Go**: Solid performance, but the error handling verbosity slowed development.
- **Rust**: Best performance, zero-cost abstractions, excellent subprocess/process-group handling via `tokio::process`.

The backend ended up at ~36,244 lines of Rust across 101 source files. The scan engine is leaner at ~931 lines — most logic lives in tool-specific wrappers.

## The gRPC Migration

We started with REST-only, then migrated to gRPC-first in a single session. Here's the proto definition:

```protobuf
syntax = "proto3";
package cybersec.scan;

service ScanService {
  rpc StartScan(StartScanRequest) returns (ScanResponse);
  rpc GetScanStatus(GetScanStatusRequest) returns (ScanStatusResponse);
  rpc CancelScan(CancelScanRequest) returns (CancelScanResponse);
}

message StartScanRequest {
  string tool_id = 1;
  string target = 2;
  map<string, string> options = 3;
  string organization_id = 4;
}
```

tonic 0.12 changed the routing API. We had to adapt:

```rust
// tonic 0.12 — Routes API
let routes = tonic::service::Routes::new(
    ScanServiceServer::new(scan_engine)
).into_axum_router();

// Combined with REST fallback
let app = Router::new()
    .route("/api/v2/scan", post(rest_start_scan))
    .merge(routes)
    .with_state(state);
```

One gotcha: `async` closures with `.or_else()` don't work the way you'd expect in axum. We had to restructure the fallback pattern to use `match` instead.

## WebAssembly: Search in the Browser

For the frontend tool catalog (89 tools), we built a WASM module:

```rust
#[wasm_bindgen]
pub struct ToolSearchEngine {
    tools: Vec<ToolIndex>,
    // Pre-built inverted index for fuzzy search
}
```

- Compiled with `wasm-pack build --target web`
- Optimized to 174KB (`opt-level = "s"`, LTO enabled)
- `useWasmSearch` React hook integrates with the existing `ToolsPage.tsx`
- JS fallback for browsers without WASM support

The search runs entirely client-side — no API round-trip for filtering 89 tools. Users notice instant results.

## Scaling to 89 Tools

Each tool has metadata in PostgreSQL:

```sql
CREATE TABLE tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    command TEXT,
    plan_required TEXT DEFAULT 'trial'
);
```

14 categories. Tool health monitoring runs via Docker exec. Auto-categorization groups tools by function (recon, exploitation, forensics, etc.).

## Compliance from Day One

As a Canadian company, PIPEDA was non-negotiable:

- **Data residency**: Hetzner Finland (EU)
- **Consent**: Explicit checkbox on registration, audit trail in `consent_records`
- **Vendor DPAs**: Tracked for Cloudflare, Stripe, Mailjet/Sinch, Hetzner
- **Email verification**: Mandatory — throwaway emails blocked via 200+ domain blocklist
- **SOC 2**: DR plan, change management, IR playbook, pentest plan all completed

## Lessons Learned

**1. Docker DNS caching is a silent killer.** Nginx resolves upstream IPs once at startup. Container restarts → stale IPs → 502 errors. Fix: `resolver 127.0.0.11 valid=10s` + variable proxy_pass.

**2. gRPC version compatibility is fragile.** tonic 0.12 broke patterns from 0.11. Lock versions and test upgrades in isolation.

**3. WASM is production-ready.** 174KB binary, instant search, no performance complaints. The tooling (wasm-pack, wasm-bindgen) is mature.

**4. Build in public.** Sharing progress on Hacker News and Reddit kept us accountable and surfaced bugs early.

## What's Next

- Agent deployment (Python/Rust agents on target machines)
- Real-time collaboration (WebSocket-based scan streaming)
- AI-powered scan recommendations
- Reporting engine (PDF/HTML export)

---

*CyberSec Pro is a cloud-native pentest platform built with Rust, gRPC, and WebAssembly. [Try it free](https://cyber-sec-pro.com) or [check the code](https://github.com/semih-kilic/cybersec-pro).*

# We built our entire pentest platform in Rust + Docker — here's the architecture

After 1,101 commits and 2 weeks of intense development, we have a working cloud-native pentest platform. The stack is entirely Rust for the backend services, and I wanted to share what we learned.

## The Stack

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Nginx     │────▶│  Rust API    │────▶│  PostgreSQL  │
│  (proxy)    │     │  (Axum 0.7)  │     │   (18)       │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │ gRPC
                    ┌──────▼───────┐     ┌─────────────┐
                    │  Scan Engine │────▶│    Redis     │
                    │  (Rust)      │     │  (cache)     │
                    └──────────────┘     └─────────────┘
```

## Key Decisions

**1. gRPC for internal communication**
The API and scan engine communicate via gRPC (tonic 0.12). REST fallback exists for backward compatibility. Proto definitions live in a shared `cybersec-proto` crate.

Why? Sub-millisecond latency between services. When you're orchestrating 1,000+ parallel scans, every millisecond in service-to-service overhead compounds.

**2. WebAssembly for browser-side compute**
Tool search (87 tools) runs as a 174KB WASM binary in the browser. No API round-trip for filtering. `wasm-pack build --target web` + `useWasmSearch` React hook.

**3. Multi-stage Docker builds**
Every Rust service uses multi-stage builds. Builder stage compiles, runtime stage copies only the binary. Result: scan engine image is ~50MB.

```dockerfile
FROM rust:1.78 AS builder
# ... compile ...
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/scan-engine /usr/local/bin/
```

**4. DNS caching gotcha**
We hit a nasty bug: nginx caches DNS resolution of upstream containers at startup. When the API container restarts with a new IP, nginx keeps the old one → 502 Bad Gateway.

Fix: `resolver 127.0.0.11 valid=10s ipv6=off;` + variable-based `proxy_pass` instead of upstream block.

**5. Token security**
- Access tokens: 1 hour
- Refresh tokens: 30 days with rotation + Redis-based reuse detection
- MFA: TOTP with hashed backup codes
- All tokens validated with `jsonwebtoken` crate

## Metrics

- 101 Rust source files, ~38,651 lines
- 5 containers, all healthy
- gRPC latency: <1ms between services
- Cold start: scan engine ready in <2 seconds

GitHub: https://github.com/semih-kilic/cybersec-pro
Website: https://cyber-sec-pro.com

What would you do differently? Happy to discuss architecture decisions.

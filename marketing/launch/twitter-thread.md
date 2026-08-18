# CyberSec Pro Launch Thread (7 tweets)

## Tweet 1 (Hook)
We just shipped 1,510 Kali Linux tools to the cloud.

No VM. No setup. No dependency hell.

Built with Rust + gRPC + WebAssembly.

Here's what we built and why 👇

## Tweet 2 (Problem)
Every pentester wastes hours:
- Updating Kali boxes
- Fixing broken dependencies
- Managing VMs
- Dealing with tool version drift

We wanted "open browser → run scan → get results"

## Tweet 3 (Stack)
The stack:
- Rust (Axum) backend — 36k LOC
- Rust scan engine — gRPC + REST
- PostgreSQL + Redis
- WebAssembly — 174KB browser search
- 5 Docker containers, auto-scaling

## Tweet 4 (gRPC)
We migrated from REST to gRPC in one session.

tonic 0.12 + prost 0.13 for protobuf.

Internal service calls: <1ms latency.

The shared proto crate pattern is 🤌

## Tweet 5 (WASM)
We compiled Rust → WebAssembly for the frontend.

Tool search (1,510 tools) runs entirely in the browser.

174KB binary. Fuzzy matching. Zero API calls for filtering.

## Tweet 6 (Compliance)
We're Canadian, so PIPEDA from day one.

Also: CCPA-CPRA, SOC 2 ready, vendor DPA tracking.

Data stays in EU (Hetzner Finland).

Compliance isn't optional.

## Tweet 7 (CTA)
Open source CLI coming soon: `cargo install cybersec-cli`

1,510 tools. 35 categories. Zero infrastructure.

Try it: cyber-sec-pro.com
GitHub: github.com/semih-kilic/cybersec-pro

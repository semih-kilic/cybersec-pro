# Show HN: CyberSec Pro – 89 Kali Linux tools, zero infrastructure

I've been building CyberSec Pro, a cloud-native platform that gives you instant access to 89 Kali Linux security tools without managing any infrastructure.

**The problem:** Every pentester and security team wastes hours setting up and maintaining their Kali boxes. Tool versions drift, dependencies break, and you can't easily share results with your team.

**What we built:**
- **Rust backend** (Axum 0.7, ~36k LOC) with JWT auth, rate limiting, and SOC 2 audit logging
- **Rust scan engine** with gRPC (tonic) for inter-service communication + REST fallback for backward compat
- **WebAssembly modules** — tool search runs entirely in the browser (174KB binary, fuzzy matching, pre-built index)
- **Auto-scaling Docker containers** — nginx, API, scan engine, PostgreSQL, Redis
- **89 tools** across 14 categories (recon, exploitation, forensics, wireless, web, crypto, etc.)

**Tech stack:**
```
Rust (Axum) → gRPC (tonic/prost) → Docker → PostgreSQL → Redis
Next.js frontend → WebAssembly (wasm-pack) → Cloudflare CDN
```

**What makes it different from existing SaaS pentest tools:**
1. The scan engine is Rust, not Python — we can run 1,000+ parallel scans without melting
2. gRPC between services means sub-millisecond internal calls
3. WASM search means the tool catalog loads instantly, no API round-trip for filtering
4. PIPEDA + CCPA compliant from day one (we're Canadian, eh)
5. Data stays in EU (Hetzner Finland)

**Early days** — still lots to build (agent deployment, real-time collaboration, reporting). But the core platform works and we're running real scans.

Would love feedback from the HN community on:
- Is the pricing model right? (Trial → Starter → Pro → Enterprise)
- What would make you actually switch from your current setup?
- Security concerns with cloud-based pentest tools?

https://cyber-sec-pro.com
GitHub: https://github.com/semih-kilic/cybersec-pro

---

*Built by a solo dev in 2 weeks. Yes, that's insane. No, I don't recommend it.*

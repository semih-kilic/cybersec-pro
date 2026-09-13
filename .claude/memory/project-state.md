# CyberSec Pro - Project State
Last updated: 2026-09-12

## Active Development Snapshot

### Platform
- Main API: `rust-backend` (Axum, port 5001, `sqlx 0.8`)
- Scan engine: `rust-scan-engine` (port 5002) — **integrated** in `docker-compose.yml`, reached only from the backend over `SCAN_ENGINE_URL`, never from the edge
- SaaS app: `saas-frontend` (React + Vite)
- Marketing app: `frontend` (Next.js 16, static export, `[locale]` routing, 10 locales)
- Infra: Postgres, Redis, nginx (publishes port 80 only; Cloudflare Tunnel terminates TLS), web-terminal

### i18n status
- **Marketing (`frontend/src/i18n/messages/`)**: `{en,tr,de,fr,es,ar,ja,zh,ru,ko}` — **414 keys, all ten at parity** (completed 2026-09-12). `en.json` is the source of truth; `src/i18n/request.ts` deep-merges to English, so a missing key renders silently in English — **parity must be measured with a key diff, never eyeballed**.
- **Dashboard (`saas-frontend/src/i18n/locales/`)**: `{en,de,es,fr,it,tr,pt,ru,ja,ko,zh,ar}` — react-i18next with inline English defaults; a string change means editing both the default argument and all locale files. CI gate: `npm run i18n:check` / `i18n:residual`.

### Frontend CI/Gates Status
- `saas-frontend`: npm-based (`npm ci`), gates `i18n:check`, `i18n:residual`, `type-check`, `test:purple-flow`, `build`. Vitest suite currently 60/60.
- Real-browser smoke tests: `scripts/browser-smoke/marketing.mjs` (52/52 clean) and `dashboard.mjs` (needs `SMOKE_JWT`). Not yet wired into CI.

### Honesty baseline (2026-09) — do not regress
The product must describe itself truthfully. Verified allow/deny list of security claims is **CLAUDE.md §16**. Established facts:
- **No WebSocket server.** Scan output is SSE (`scan_handlers::scan_output_stream`). Never write "WebSocket" in user copy.
- **Canonical tool count is 88** (active + curated), not the ~1,510 catalogue rows. Keep every surface consistent.
- **No HSM, key rotation, WebAuthn, ABAC, WORM, SIEM export, SBOM automation, ML anomaly/IDS-IPS, dedicated instances, or third-party pentest.** Retention is 90 days (scans) / 365 (audit logs).
- **PGP key is a placeholder** — both Trust Centers gate it behind `PGP_KEY_PUBLISHED = false`; `security.txt` has no `Encryption:` line.
- Generated report: no false certifications, no fictitious analyst signature, real SHA-256 content digest.

### Key Technical Debt
1. Purple Team is DB-backed deterministic simulation; production-grade execution telemetry + correlation with real scan findings is still on the roadmap.
2. Billing/Stripe flow is partially stubbed (webhooks + portal work; broader flow incomplete).
3. Blog posts are strong now but the platform has no CMS — content lives in `frontend/src/lib/blog-content.ts`.
4. `dashboard.mjs` smoke test and Brotli at the edge remain un-wired (both low priority).

### Recent Progress (2026-09-11 → 2026-09-12)
- **AI discoverability**: removed origin + Cloudflare AI-crawler blocks; generated `sitemap.xml` (1,130 URLs, hreflang, 0 dead), `llms.txt`/`llms-full.txt`, IndexNow submission, per-tool + pricing structured data; fixed React #418 (Cloudflare email obfuscation) via `frontend/src/components/Email.tsx`.
- **Honesty audit**: corrected both Trust Centers, the `/security` page, the hero badge, and the report generator (see baseline above); documented in CLAUDE.md §16.
- **Marketing i18n**: brought 8 locales from ~50% to 414/414; built a real pricing page mirroring `plan.rs`.
- **Blog**: all 10 posts rewritten to 1,200–1,900 words, verified against installed tools; `renderMarkdown` table rendering fixed.
- **Tool params**: unified in `saas-frontend/src/lib/toolFormParams.ts` (21 tests) — fixed unmasked credential fields and the missing target-types panel on the scan page.
- **Feed hardening**: `news_feed.rs` rejects non-http(s) links (3 tests); deleted dead `TestimonialsSection`.

### Working Conventions
- Verify a claim against the code (file + line) before writing it into any user-facing surface.
- After a frontend build, `nginx -t && nginx -s reload` (60s `open_file_cache` serves the old index.html otherwise). `dist/`/`out/` are gitignored — verify the deployed chunk, not the `.tsx`.
- Reach the origin with `curl -H "Host: <host>" http://127.0.0.1/...` (TLS terminates at the edge).
- Keep docs synced to real manifests (`Cargo.toml`, `package.json`, `docker-compose.yml`).

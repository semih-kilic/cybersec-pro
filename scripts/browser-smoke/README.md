# Browser smoke tests

Two scripts that load the real, deployed site in headless Chromium and fail on
anything a user would see in the console or on the page.

They exist because a whole class of defect here survives `tsc`, vitest and
bundle inspection. Everything below was found by these scripts, in production,
after the unit suite was green:

- every tool page crashed with React #31 for 63 of the 88 curated tools
- a dead Socket.IO client retried a handshake forever against a server that
  does not exist — 916 requests and counting, each answered with a full
  `index.html`
- the CSP blocked Google Analytics, so analytics had been collecting nothing
- `/dashboard/` shipped with no security headers at all, while deeper routes
  had them (an `add_header` in a location silently drops inherited ones)
- every marketing page in every locale threw a CORS error from a `next/link`
  prefetch pointed at another origin

## Running them

```bash
# dashboard — needs a token
SMOKE_JWT="$(scripts/browser-smoke/mint-jwt.sh)" node scripts/browser-smoke/dashboard.mjs

# marketing — public, no auth
node scripts/browser-smoke/marketing.mjs
```

Both exit non-zero when something fails, so they drop straight into CI or a
post-deploy step.

## Requirements

`playwright-core` plus a Chromium binary. Chromium is already at
`/usr/bin/chromium` on this host; point `CHROME_PATH` elsewhere if needed.

The driver is declared in this directory's own `package.json`, deliberately
separate from `saas-frontend` and `frontend` so it never reaches a user
bundle. Node resolves it by walking up from the script, so install once:

```bash
cd scripts/browser-smoke && npm install
```

(`NODE_PATH` does not work here — ESM ignores it.)

## Environment

| Variable | Default | Notes |
|---|---|---|
| `SMOKE_JWT` | — | required by `dashboard.mjs`; stored as `localStorage.token` |
| `SMOKE_BASE` | `https://app.cyber-sec-pro.com/dashboard` | dashboard origin |
| `SMOKE_MARKETING_BASE` | `https://cyber-sec-pro.com` | marketing origin |
| `SMOKE_TOOL` / `SMOKE_SCAN` / `SMOKE_PROJECT` | a known tool id | ids for parameterised routes; scan/project are skipped when unset |
| `SMOKE_USER` / `SMOKE_ORG` / `SMOKE_ROLE` / `SMOKE_TTL` | superadmin test account, 1h | passed to `mint-jwt.sh` |
| `CHROME_PATH` | `/usr/bin/chromium` | browser binary |

## Run them against what is actually deployed

A frontend fix is not live until the bundle is rebuilt **and** nginx is
reloaded — `dist/` is gitignored, so git looks clean while the old bundle is
still being served, and nginx's `open_file_cache` keeps handing out the
previous `index.html` after Vite replaces it. Before trusting a green run:

```bash
cd saas-frontend && npm run build          # or: cd frontend && npm run build
docker exec cybersec-nginx nginx -t && docker exec cybersec-nginx nginx -s reload
```

## What counts as a failure

Third-party noise (analytics, font hosts) is classified separately and never
fails a run — only app errors do. `marketing.mjs` additionally fails if a
compliance claim removed in the Trust Center honesty pass reappears, so a
revert or a bad merge cannot quietly reinstate a certification that is not
held.

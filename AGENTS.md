# AGENTS.md — CyberSec Pro

## Read first
- `CONTEXT.md` — domain language and invariants. Speak this language.

## Skills
`.agents/skills/` contains engineering + productivity skills
(mattpocock/skills). Key ones for this repo:
- `engineering/tdd` — red-green-refactor; backend has 300+ unit tests, keep them green
- `engineering/code-review` — two-axis review before committing
- `engineering/diagnosing-bugs` — disciplined loop for hard bugs
- `engineering/improve-codebase-architecture` — run periodically; see tech-debt report
- `engineering/grill-with-docs` — align before large changes; update CONTEXT.md inline

## Hard rules
1. Rust backend builds ONLY inside Docker (`docker compose build rust-backend`).
2. Never break the security posture: auth tiers, kill-switch, audit logs.
3. Plan truth = `organizations.plan_type`. Billing changes must keep webhook
   idempotency (`stripe_events`) intact.
4. Frontend dark-designed pages need a scope class to survive light mode
   (see CONTEXT.md theme system).

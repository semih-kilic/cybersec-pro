# CyberSec Pro Skills Playbook

This file defines practical, repeatable workflows for this repository.

## 1) i18n Translation Skill

There are **two** locale trees; they use different i18n libraries and different workflows.

### Marketing site — `frontend/src/i18n/messages/{en,tr,de,fr,es,ar,ja,zh,ru,ko}.json`
- next-intl, 10 locales, `en.json` is the source of truth.
- **Trap:** `src/i18n/request.ts` deep-merges every locale against English, so a missing key renders silently *as English* — a half-translated locale looks fine on the page. Coverage must be **measured**, never eyeballed.
- Flow: author `en` (and `tr`) first → translate the block into the other locales → **verify with a flatten-and-diff script** over the JSON files (`en` key set minus each locale) → build → check the built page shows the localized string, not the English fallback.
- Current status: **409 keys, all ten at parity** (2026-09-13; 414 → 409 when the unbacked bug-bounty reward table was removed).

### Dashboard — `saas-frontend/src/i18n/locales/{en,de,es,fr,it,tr,pt,ru,ja,ko,zh,ar}.json`
- react-i18next with inline English defaults in the TSX. Changing a string means editing **both** the `t('key', 'English default')` argument **and** every locale JSON.
- Flow: pick a scope in `en.json` → translate user-facing strings in each locale → keep technical placeholders/IDs stable → `npm run i18n:check` and `npm run i18n:residual`.

Quality checks (both trees):
- no broken JSON, no accidental key drift
- no untranslated high-visibility labels (measure, don't assume)
- proper nouns / technical tokens intentional and consistent

## 2) Rust API Implementation Skill

Flow:
1. Inspect nearest implemented handler pattern.
2. Implement endpoint without breaking extractor/middleware style.
3. Use parameterized SQL and explicit error responses.
4. Add logging/audit where data changes occur.
5. Run crate-level checks before completion.

## 3) Safe Infra Change Skill

Applies to:
- `docker-compose.yml`
- `nginx/nginx.conf`
- service startup/deploy scripts

Flow:
1. Diff current behavior before edit.
2. Make smallest possible config change.
3. Validate compose/nginx syntax.
4. Document operational impact and rollback path.

## 4) Documentation Sync Skill

When code/config changes:
1. Update `CLAUDE.md` for architecture/workflow changes.
2. Update `.claude/memory/project-state.md` for current status.
3. Keep this `SKILLS.md` aligned with real practices.

## 5) Definition of Done

A change is complete when:
- implementation is applied,
- touched files pass syntax/quality checks,
- and related docs are updated.

## 6) CI Artifact Review Skill

After CI runs, inspect workflow artifacts to triage quickly:
- `i18n-reports`:
  - `saas-frontend/i18n-coverage-report.json`
  - `saas-frontend/i18n-residual-report.json`
- `backend-reports`:
  - `rust-backend/ci-reports/cargo-check.log`
  - `rust-backend/ci-reports/cargo-clippy.log`
  - `rust-backend/ci-reports/cargo-clippy-exit.txt`

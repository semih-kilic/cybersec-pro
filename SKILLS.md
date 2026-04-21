# CyberSec Pro Skills Playbook

This file defines practical, repeatable workflows for this repository.

## 1) i18n Translation Skill

Target:
- `saas-frontend/src/i18n/locales/{en,de,es,fr,it}.json`

Flow:
1. Pick one scope from `en.json`.
2. Read same scope in all locales.
3. Translate user-facing strings in `de/es/fr/it`.
4. Keep technical placeholders stable when appropriate.
5. Run `npm run i18n:check` and fix syntax/coverage issues.

Quality checks:
- no broken JSON
- no accidental key drift
- no untranslated user-facing high-visibility labels

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

#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# CyberSec Pro — Dependency Audit Report
# Quick overview of all outdated packages across the entire project
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

BASEDIR="/home/cybersec/cybersec-pro"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

header() { echo -e "\n${BOLD}${BLUE}─── $* ───${NC}"; }
ok()     { echo -e "  ${GREEN}✓${NC} $*"; }
warn()   { echo -e "  ${YELLOW}⚠${NC} $*"; }
fail()   { echo -e "  ${RED}✗${NC} $*"; }

echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       CyberSec Pro — Dependency Audit Report               ║${NC}"
echo -e "${BOLD}║       $(date '+%Y-%m-%d %H:%M:%S')                            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"

# ═══════════════════════════════════════════════════════════════════════════════
# FRONTEND (Next.js)
# ═══════════════════════════════════════════════════════════════════════════════
header "Frontend (Next.js) — frontend/"
cd "$BASEDIR/frontend"

echo -e "  ${BOLD}Package${NC}                   ${BOLD}Current${NC}   ${BOLD}Wanted${NC}   ${BOLD}Latest${NC}"
echo "  ─────────────────────────── ──────── ──────── ────────"

npm outdated 2>/dev/null | while IFS= read -r line; do
    pkg=$(echo "$line" | awk '{print $1}')
    cur=$(echo "$line" | awk '{print $2}')
    want=$(echo "$line" | awk '{print $3}')
    latest=$(echo "$line" | awk '{print $4}')

    if [[ "$cur" == "$latest" ]]; then
        echo -e "  ${GREEN}✓${NC} $pkg"
    elif [[ "$cur" == "$want" ]]; then
        echo -e "  ${YELLOW}↑${NC} $pkg  ($cur → $latest)"
    else
        echo -e "  ${RED}↓${NC} $pkg  ($cur → $want latest:$latest)"
    fi
done

frontend_outdated=$(npm outdated --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")
echo -e "\n  Total outdated: ${BOLD}$frontend_outdated${NC}"

# Security audit
echo -e "\n  ${BOLD}Security Audit:${NC}"
audit_result=$(npm audit --omit=dev --json 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    v = d.get('metadata',{}).get('vulnerabilities',{})
    total = sum(v.values())
    if total == 0:
        print('OK')
    else:
        crit = v.get('critical',0)
        high = v.get('high',0)
        mod = v.get('moderate',0)
        low = v.get('low',0)
        print(f'{total} vulns: {crit} critical, {high} high, {mod} moderate, {low} low')
except:
    print('N/A')
" 2>/dev/null)

if [[ "$audit_result" == "OK" ]]; then
    ok "No known vulnerabilities"
else
    warn "$audit_result"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SAAS FRONTEND (React/Vite)
# ═══════════════════════════════════════════════════════════════════════════════
header "SaaS Frontend (React/Vite) — saas-frontend/"
cd "$BASEDIR/saas-frontend"

echo -e "  ${BOLD}Package${NC}                   ${BOLD}Current${NC}   ${BOLD}Wanted${NC}   ${BOLD}Latest${NC}"
echo "  ─────────────────────────── ──────── ──────── ────────"

npm outdated 2>/dev/null | while IFS= read -r line; do
    pkg=$(echo "$line" | awk '{print $1}')
    cur=$(echo "$line" | awk '{print $2}')
    want=$(echo "$line" | awk '{print $3}')
    latest=$(echo "$line" | awk '{print $4}')

    if [[ "$cur" == "$latest" ]]; then
        echo -e "  ${GREEN}✓${NC} $pkg"
    elif [[ "$cur" == "$want" ]]; then
        echo -e "  ${YELLOW}↑${NC} $pkg  ($cur → $latest)"
    else
        echo -e "  ${RED}↓${NC} $pkg  ($cur → $want latest:$latest)"
    fi
done

saas_outdated=$(npm outdated --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")
echo -e "\n  Total outdated: ${BOLD}$saas_outdated${NC}"

echo -e "\n  ${BOLD}Security Audit:${NC}"
audit_result=$(npm audit --omit=dev --json 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    v = d.get('metadata',{}).get('vulnerabilities',{})
    total = sum(v.values())
    if total == 0:
        print('OK')
    else:
        crit = v.get('critical',0)
        high = v.get('high',0)
        mod = v.get('moderate',0)
        low = v.get('low',0)
        print(f'{total} vulns: {crit} critical, {high} high, {mod} moderate, {low} low')
except:
    print('N/A')
" 2>/dev/null)

if [[ "$audit_result" == "OK" ]]; then
    ok "No known vulnerabilities"
else
    warn "$audit_result"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# RUST CRATES
# ═══════════════════════════════════════════════════════════════════════════════
export PATH="$HOME/.cargo/bin:$PATH"

for project in "rust-backend" "rust-scan-engine" "rust-agent" "cybersec-wasm" "cybersec-tools" "cybersec-cli"; do
    header "Rust: $project/"
    dir="$BASEDIR/$project"

    if [[ ! -f "$dir/Cargo.toml" ]]; then
        warn "No Cargo.toml found"
        continue
    fi

    cd "$dir"

    # Check outdated
    if command -v cargo-outdated &>/dev/null; then
        outdated=$(cargo outdated --root-deps-only 2>/dev/null || echo "")
        if [[ -n "$outdated" ]]; then
            echo "$outdated" | head -20
        else
            ok "All crates up to date"
        fi
    else
        # Fallback: just show cargo update dry-run
        log_lines=$(cargo update --dry-run 2>&1 | head -20)
        if echo "$log_lines" | grep -q "Updating"; then
            echo "$log_lines"
            count=$(echo "$log_lines" | grep -c "Updating" || true)
            warn "$count crates can be updated"
        else
            ok "All crates up to date (or cargo-outdated not installed)"
        fi
    fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY AUDIT (Cargo)
# ═══════════════════════════════════════════════════════════════════════════════
header "Cargo Security Audit"

if command -v cargo-audit &>/dev/null; then
    for project in "rust-backend" "rust-scan-engine"; do
        cd "$BASEDIR/$project"
        result=$(cargo audit 2>&1)
        if echo "$result" | grep -q "0 vulnerabilities found"; then
            ok "$project: No known vulnerabilities"
        else
            warn "$project:"
            echo "$result" | grep -E "warning:|error:|vulnerability" | head -5
        fi
    done
else
    warn "cargo-audit not installed — run: cargo install cargo-audit"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
header "Summary"
total_outdated=$((frontend_outdated + saas_outdated))
echo -e "  ${BOLD}NPM:${NC} $total_outdated packages outdated across 2 frontends"
echo -e "  ${BOLD}Cargo:${NC} Run cargo-outdated for detailed report"
echo -e "  ${BOLD}Security:${NC} Run 'npm audit' and 'cargo audit' for vulnerability check"
echo ""
echo -e "  ${BOLD}Quick update:${NC} ./scripts/auto-update-deps.sh"
echo -e "  ${BOLD}With minor:${NC}  ./scripts/auto-update-deps.sh --minor"
echo -e "  ${BOLD}Dry run:${NC}     ./scripts/auto-update-deps.sh --dry-run"

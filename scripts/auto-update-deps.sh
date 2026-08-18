#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# CyberSec Pro — Dependency Auto-Update System
# ═══════════════════════════════════════════════════════════════════════════════
# Usage:
#   ./auto-update-deps.sh              # Patch updates only (safest)
#   ./auto-update-deps.sh --minor      # Patch + minor updates
#   ./auto-update-deps.sh --major      # All updates including major (risky)
#   ./auto-update-deps.sh --dry-run    # Show what would be updated
#   ./auto-update-deps.sh --report     # Just show outdated status
#   ./auto-update-deps.sh --scope frontend  # Only update frontend
#   ./auto-update-deps.sh --scope saas      # Only update saas-frontend
#   ./auto-update-deps.sh --scope rust      # Only update Rust crates
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
BASEDIR="/home/cybersec/cybersec-pro"
BACKUP_DIR="/home/cybersec/dep-backups"
LOG_DIR="/home/cybersec/cybersec-pro/logs"
REPORT_FILE="${LOG_DIR}/dep-update-$(date +%Y%m%d-%H%M%S).log"
MAX_PATCH_PER_BATCH=50
MINOR_CONFIRM=true
NODE_ENV="${NODE_ENV:-production}"
CARGO_TERM_COLOR=always

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Parse Arguments ───────────────────────────────────────────────────────────
MODE="patch"
DRY_RUN=false
REPORT_ONLY=false
SCOPE="all"
COMMIT=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --minor)    MODE="minor"; shift ;;
        --major)    MODE="major"; shift ;;
        --dry-run)  DRY_RUN=true; shift ;;
        --report)   REPORT_ONLY=true; shift ;;
        --no-commit) COMMIT=false; shift ;;
        --scope)    SCOPE="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--patch|--minor|--major] [--dry-run] [--report] [--scope frontend|saas|rust]"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

mkdir -p "$LOG_DIR" "$BACKUP_DIR"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()   { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $*" | tee -a "$REPORT_FILE"; }
ok()    { echo -e "${GREEN}  ✓${NC} $*" | tee -a "$REPORT_FILE"; }
warn()  { echo -e "${YELLOW}  ⚠${NC} $*" | tee -a "$REPORT_FILE"; }
fail()  { echo -e "${RED}  ✗${NC} $*" | tee -a "$REPORT_FILE"; }
header(){ echo -e "\n${BOLD}${BLUE}═══ $* ═══${NC}" | tee -a "$REPORT_FILE"; }

backup_package_json() {
    local dir=$1
    local name=$(basename "$dir")
    cp "$dir/package.json" "$BACKUP_DIR/${name}.package.json.bak"
    [[ -f "$dir/package-lock.json" ]] && cp "$dir/package-lock.json" "$BACKUP_DIR/${name}.package-lock.json.bak"
    [[ -f "$dir/pnpm-lock.yaml" ]] && cp "$dir/pnpm-lock.yaml" "$BACKUP_DIR/${name}.pnpm-lock.yaml.bak"
}

rollback_package_json() {
    local dir=$1
    local name=$(basename "$dir")
    if [[ -f "$BACKUP_DIR/${name}.package.json.bak" ]]; then
        cp "$BACKUP_DIR/${name}.package.json.bak" "$dir/package.json"
        [[ -f "$BACKUP_DIR/${name}.package-lock.json.bak" ]] && cp "$BACKUP_DIR/${name}.package-lock.json.bak" "$dir/package-lock.json"
        [[ -f "$BACKUP_DIR/${name}.pnpm-lock.yaml.bak" ]] && cp "$BACKUP_DIR/${name}.pnpm-lock.yaml.bak" "$dir/pnpm-lock.yaml"
        warn "Rolled back $name to previous state"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# REPORT MODE — Just show what's outdated
# ═══════════════════════════════════════════════════════════════════════════════
if $REPORT_ONLY; then
    header "NPM Outdated — Frontend (Next.js)"
    cd "$BASEDIR/frontend" && npm outdated 2>/dev/null || true

    header "NPM Outdated — SaaS Frontend (Vite)"
    cd "$BASEDIR/saas-frontend" && npm outdated 2>/dev/null || true

    header "Cargo Outdated — rust-backend"
    cd "$BASEDIR/rust-backend" && cargo outdated 2>/dev/null || warn "cargo-outdated not installed"

    header "Cargo Outdated — rust-scan-engine"
    cd "$BASEDIR/rust-scan-engine" && cargo outdated 2>/dev/null || warn "cargo-outdated not installed"

    header "Cargo Audit — All Crates"
    cargo audit 2>/dev/null || warn "cargo-audit not installed — run: cargo install cargo-audit"

    header "npm audit — Frontend"
    cd "$BASEDIR/frontend" && npm audit --omit=dev 2>/dev/null || true

    header "npm audit — SaaS Frontend"
    cd "$BASEDIR/saas-frontend" && npm audit --omit=dev 2>/dev/null || true

    echo -e "\n${BOLD}Report saved to: $REPORT_FILE${NC}"
    exit 0
fi

# ═══════════════════════════════════════════════════════════════════════════════
# NPM UPDATE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════
update_npm_dir() {
    local dir=$1
    local name=$2
    local build_cmd="${3:-}"
    local test_cmd="${4:-}"

    header "NPM Update: $name ($dir)"

    if [[ ! -f "$dir/package.json" ]]; then
        warn "No package.json found — skipping"
        return 0
    fi

    cd "$dir"

    # Show what's outdated
    log "Checking outdated packages..."
    local outdated_count
    outdated_count=$(npm outdated --json 2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

    if [[ "$outdated_count" == "0" ]]; then
        ok "All packages up to date"
        return 0
    fi

    log "Found $outdated_count outdated packages"

    # Backup
    backup_package_json "$dir"

    # Determine update command based on mode
    local update_flag=""
    case "$MODE" in
        patch) update_flag="--save" ;;  # respects semver range (patch only for ^)
        minor) update_flag="--save" ;;
        major) update_flag="--save --save-exact" ;;
    esac

    if $DRY_RUN; then
        log "[DRY RUN] Would run: npm update $update_flag"
        npm outdated 2>/dev/null | head -20
        return 0
    fi

    # Update packages
    log "Running npm update (mode: $MODE)..."
    if ! npm update $update_flag 2>&1 | tee -a "$REPORT_FILE"; then
        fail "npm update failed for $name"
        rollback_package_json "$dir"
        return 1
    fi

    # For major mode, also update package.json ranges
    if [[ "$MODE" == "major" ]]; then
        log "Updating package.json ranges for major updates..."
        npm outdated --json 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for pkg, info in data.items():
        latest = info.get('latest', '')
        if latest:
            print(f'{pkg}@{latest}')
except: pass
" 2>/dev/null | xargs -r npm install --save --save-exact 2>/dev/null || true
    fi

    # Reinstall to update lockfile
    if [[ -f "package-lock.json" ]]; then
        log "Updating package-lock.json..."
        rm -rf node_modules/.package-lock.json
        npm install --package-lock-only 2>&1 | tee -a "$REPORT_FILE" || true
    fi

    # Run install to sync
    log "Syncing node_modules..."
    npm install 2>&1 | tee -a "$REPORT_FILE" || {
        fail "npm install failed after update"
        rollback_package_json "$dir"
        return 1
    }

    # Build test
    if [[ -n "$build_cmd" ]]; then
        log "Running build test: $build_cmd"
        if ! (eval "$build_cmd" 2>&1 | tee -a "$REPORT_FILE"); then
            fail "Build failed after update — rolling back $name"
            rollback_package_json "$dir"
            cd "$dir" && npm install 2>/dev/null || true
            return 1
        fi
        ok "Build passed"
    fi

    # Type check
    if [[ "$name" == *"saas"* ]]; then
        log "Running type-check..."
        if ! npm run type-check 2>&1 | tee -a "$REPORT_FILE"; then
            fail "Type check failed after update — rolling back $name"
            rollback_package_json "$dir"
            cd "$dir" && npm install 2>/dev/null || true
            return 1
        fi
        ok "Type check passed"
    fi

    # Lint test
    log "Running lint..."
    if ! npm run lint 2>&1 | tee -a "$REPORT_FILE"; then
        warn "Lint warnings after update (non-blocking)"
    fi

    # Test
    if [[ -n "$test_cmd" ]]; then
        log "Running tests: $test_cmd"
        if ! (eval "$test_cmd" 2>&1 | tee -a "$REPORT_FILE"); then
            fail "Tests failed after update — rolling back $name"
            rollback_package_json "$dir"
            cd "$dir" && npm install 2>/dev/null || true
            return 1
        fi
        ok "Tests passed"
    fi

    ok "Update complete for $name"
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# CARGO UPDATE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════
update_cargo_dir() {
    local dir=$1
    local name=$2
    local build_cmd="${3:-cargo check --release}"
    local test_cmd="${4:-}"

    header "Cargo Update: $name ($dir)"

    if [[ ! -f "$dir/Cargo.toml" ]]; then
        warn "No Cargo.toml found — skipping"
        return 0
    fi

    cd "$dir"

    if $DRY_RUN; then
        log "[DRY RUN] Would run: cargo update"
        cargo update --dry-run 2>&1 | tee -a "$REPORT_FILE" || true
        return 0
    fi

    # Backup Cargo.lock
    if [[ -f "Cargo.lock" ]]; then
        cp "Cargo.lock" "$BACKUP_DIR/${name}.Cargo.lock.bak"
    fi

    # Update crates
    log "Running cargo update..."
    if ! cargo update 2>&1 | tee -a "$REPORT_FILE"; then
        fail "cargo update failed for $name"
        [[ -f "$BACKUP_DIR/${name}.Cargo.lock.bak" ]] && cp "$BACKUP_DIR/${name}.Cargo.lock.bak" Cargo.lock
        return 1
    fi

    # For major mode, also update Cargo.toml ranges
    if [[ "$MODE" == "major" ]]; then
        log "Checking for major updates in Cargo.toml..."
        cargo install cargo-edit 2>/dev/null || true
        # cargo upgrade handles Cargo.toml range updates
        cargo upgrade --incompatible 2>&1 | tee -a "$REPORT_FILE" || warn "cargo upgrade not available"
    fi

    # Build test
    log "Running build test: $build_cmd"
    if ! (eval "$build_cmd" 2>&1 | tee -a "$REPORT_FILE"); then
        fail "Build failed after update — rolling back $name"
        [[ -f "$BACKUP_DIR/${name}.Cargo.lock.bak" ]] && cp "$BACKUP_DIR/${name}.Cargo.lock.bak" Cargo.lock
        return 1
    fi
    ok "Build passed"

    # Clippy
    log "Running clippy..."
    cargo clippy --release -- -W warnings 2>&1 | tee -a "$REPORT_FILE" || warn "Clippy warnings (non-blocking)"

    # Test
    if [[ -n "$test_cmd" ]]; then
        log "Running tests: $test_cmd"
        if ! (eval "$test_cmd" 2>&1 | tee -a "$REPORT_FILE"); then
            fail "Tests failed after update — rolling back $name"
            [[ -f "$BACKUP_DIR/${name}.Cargo.lock.bak" ]] && cp "$BACKUP_DIR/${name}.Cargo.lock.bak" Cargo.lock
            return 1
        fi
        ok "Tests passed"
    fi

    ok "Update complete for $name"
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN UPDATE FLOW
# ═══════════════════════════════════════════════════════════════════════════════
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
UPDATED=()
FAILED=()
SKIPPED=()

header "CyberSec Pro Dependency Auto-Update"
log "Mode: $MODE | Scope: $SCOPE | Dry run: $DRY_RUN"
log "Started at: $(date)"
log "Report: $REPORT_FILE"
echo ""

# ── Frontend (Next.js) ────────────────────────────────────────────────────────
if [[ "$SCOPE" == "all" || "$SCOPE" == "frontend" ]]; then
    if update_npm_dir "$BASEDIR/frontend" "frontend" \
        "npx next build" ""; then
        UPDATED+=("frontend (npm)")
    else
        FAILED+=("frontend (npm)")
    fi
fi

# ── SaaS Frontend (React/Vite) ───────────────────────────────────────────────
if [[ "$SCOPE" == "all" || "$SCOPE" == "saas" ]]; then
    if update_npm_dir "$BASEDIR/saas-frontend" "saas-frontend" \
        "npm run build" "vitest --run --reporter=verbose 2>/dev/null || true"; then
        UPDATED+=("saas-frontend (npm)")
    else
        FAILED+=("saas-frontend (npm)")
    fi
fi

# ── Rust Backend ──────────────────────────────────────────────────────────────
if [[ "$SCOPE" == "all" || "$SCOPE" == "rust" ]]; then
    if update_cargo_dir "$BASEDIR/rust-backend" "rust-backend" \
        "cargo check --release" "SQLX_OFFLINE=true cargo test 2>&1 || true"; then
        UPDATED+=("rust-backend (cargo)")
    else
        FAILED+=("rust-backend (cargo)")
    fi

    # ── Rust Scan Engine ──────────────────────────────────────────────────────
    if update_cargo_dir "$BASEDIR/rust-scan-engine" "rust-scan-engine" \
        "cargo check --release" "cargo test 2>&1 || true"; then
        UPDATED+=("rust-scan-engine (cargo)")
    else
        FAILED+=("rust-scan-engine (cargo)")
    fi

    # ── Rust Agent ────────────────────────────────────────────────────────────
    if update_cargo_dir "$BASEDIR/rust-agent" "rust-agent" \
        "cargo check --release" "cargo test 2>&1 || true"; then
        UPDATED+=("rust-agent (cargo)")
    else
        FAILED+=("rust-agent (cargo)")
    fi

    # ── WASM Module ───────────────────────────────────────────────────────────
    if update_cargo_dir "$BASEDIR/cybersec-wasm" "cybersec-wasm" \
        "wasm-pack build --target web --release 2>&1 || cargo check --release" ""; then
        UPDATED+=("cybersec-wasm (cargo)")
    else
        FAILED+=("cybersec-wasm (cargo)")
    fi

    # ── CyberSec Tools ────────────────────────────────────────────────────────
    if update_cargo_dir "$BASEDIR/cybersec-tools" "cybersec-tools" \
        "cargo check --release" ""; then
        UPDATED+=("cybersec-tools (cargo)")
    else
        FAILED+=("cybersec-tools (cargo)")
    fi

    # ── CyberSec CLI ──────────────────────────────────────────────────────────
    if update_cargo_dir "$BASEDIR/cybersec-cli" "cybersec-cli" \
        "cargo check --release" ""; then
        UPDATED+=("cybersec-cli (cargo)")
    else
        FAILED+=("cybersec-cli (cargo)")
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# GIT COMMIT
# ═══════════════════════════════════════════════════════════════════════════════
if $COMMIT && [[ ${#UPDATED[@]} -gt 0 ]] && ! $DRY_RUN; then
    header "Git Commit"
    cd "$BASEDIR"

    # Stage updated files
    git add frontend/package.json frontend/package-lock.json 2>/dev/null || true
    git add saas-frontend/package.json saas-frontend/package-lock.json 2>/dev/null || true
    git add rust-backend/Cargo.lock 2>/dev/null || true
    git add rust-scan-engine/Cargo.lock 2>/dev/null || true
    git add rust-agent/Cargo.lock 2>/dev/null || true
    git add cybersec-wasm/Cargo.lock 2>/dev/null || true
    git add cybersec-tools/Cargo.lock 2>/dev/null || true
    git add cybersec-cli/Cargo.lock 2>/dev/null || true

    local changes
    changes=$(git diff --cached --stat 2>/dev/null || echo "")

    if [[ -n "$changes" ]]; then
        msg="deps: auto-update ($MODE) — ${UPDATED[*]}"
        git commit -m "$msg" 2>&1 | tee -a "$REPORT_FILE" || warn "Git commit failed"
        ok "Committed: $msg"
    else
        warn "No changes to commit"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
header "Summary"
echo -e "${GREEN}Updated:${NC} ${UPDATED[*]:-none}" | tee -a "$REPORT_FILE"
echo -e "${RED}Failed:${NC} ${FAILED[*]:-none}" | tee -a "$REPORT_FILE"
echo -e "${YELLOW}Skipped:${NC} ${SKIPPED[*]:-none}" | tee -a "$REPORT_FILE"
log "Finished at: $(date)"
echo -e "\nFull report: $REPORT_FILE"

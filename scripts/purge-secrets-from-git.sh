#!/bin/bash
# ⚠️  CRITICAL: Run this script to purge leaked secrets from git history
# This rewrites git history — coordinate with all team members before running
# After running: all team members must re-clone the repository

set -e

echo "🔴 CRITICAL: Purging leaked secrets from git history..."
echo "This will rewrite ALL git history. Press Ctrl+C to cancel, or Enter to continue."
read

# Check git-filter-repo is available (preferred over BFG)
if ! command -v git-filter-repo &>/dev/null; then
    echo "Installing git-filter-repo..."
    pip3 install git-filter-repo 2>/dev/null || {
        echo "Please install: pip3 install git-filter-repo"
        exit 1
    }
fi

# Patterns to purge
PATTERNS=(
    "***REDACTED_STRIPE_SECRET***"
    "***REDACTED_STRIPE_PUBLISHABLE***"
    "***REDACTED_STRIPE_WEBHOOK***"
    "***REDACTED_GMAIL_APP_PASSWORD***"
    "***REDACTED_PG_PASSWORD***"
)

for pattern in "${PATTERNS[@]}"; do
    echo "Purging: ${pattern:0:20}..."
    git filter-repo --replace-text <(echo "glob:*${pattern}*==>REDACTED_SECRET") --force 2>/dev/null || true
done

echo ""
echo "✅ Done. Next steps:"
echo "1. Force push: git push --force --all origin"
echo "2. Force push tags: git push --force --tags origin"
echo "3. Notify all team members to re-clone"
echo "4. Rotate ALL leaked credentials immediately:"
echo "   - Stripe: https://dashboard.stripe.com/apikeys"
echo "   - Gmail App Password: https://myaccount.google.com/apppasswords"
echo "   - Database: Change PostgreSQL password"

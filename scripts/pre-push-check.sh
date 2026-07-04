#!/usr/bin/env bash
# ── InventoryOS: Pre-Push Guardrail ──
#
# Verifies that no environment-specific files are staged for commit.
# Run this BEFORE every `git push`:
#
#   bash scripts/pre-push-check.sh
#
# Or install as a git pre-push hook (see DEPLOYMENT_WORKFLOW.md §5).
#
# Exit codes:
#   0 = all clear, safe to push
#   1 = environment-specific files found staged — unstage them first

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Files that must NEVER be committed (environment-specific)
# Uses a single comprehensive regex per family to catch all variants.
FORBIDDEN_PATTERNS=(
    '^\.env(\..*)?$'           # .env, .env.local, .env.production, .env.zai, .env.test, etc.
    '^\.env\.example$'         # explicitly excluded below — this is the one allowed .env file
)

# Files that require explicit confirmation (committed but environment-sensitive)
SENSITIVE_FILES=(
    'docker-compose.yml'
    'docker-compose.override.yml'
    'Caddyfile'
    'docker/pgbouncer/pgbouncer.ini'
    'docker/pgbouncer/userlist.txt'
)

# Patterns for local artifacts that should never be committed
LOCAL_ARTIFACT_PATTERNS=(
    '\.log$'
    '\.db$'
    '\.db-journal$'
    'agent-ctx/'
    '\.z-ai-config'
    'node_modules/'
    '\.next/'
    'tool-results/'
)

echo -e "${YELLOW}🔍 Running pre-push guardrail check...${NC}"
echo ""

# Get staged files (only staged, not unstaged or untracked)
STAGED_FILES=$(git diff --cached --name-only 2>/dev/null || echo "")

if [ -z "$STAGED_FILES" ]; then
    echo -e "${YELLOW}⚠️  No files staged for commit. Nothing to check.${NC}"
    exit 0
fi

ERRORS=0
WARNINGS=0

# Check for forbidden files (hard fail)
for file in $STAGED_FILES; do
    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        if [[ "$file" =~ $pattern ]] && [[ "$file" != ".env.example" ]]; then
            echo -e "${RED}❌ FORBIDDEN file staged: $file${NC}"
            echo -e "   ${YELLOW}Fix: git restore --staged \"$file\"${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
done
# Check for local artifacts (hard fail)
for file in $STAGED_FILES; do
    for pattern in "${LOCAL_ARTIFACT_PATTERNS[@]}"; do
        if [[ "$file" =~ $pattern ]]; then
            echo -e "${RED}❌ LOCAL ARTIFACT staged: $file${NC}"
            echo -e "   ${YELLOW}Fix: git restore --staged \"$file\"${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
done

# Check for sensitive files (warn, don't fail — these are legit to change for prod)
for file in $STAGED_FILES; do
    for sensitive in "${SENSITIVE_FILES[@]}"; do
        if [[ "$file" == "$sensitive" ]]; then
            echo -e "${YELLOW}⚠️  SENSITIVE file staged: $file${NC}"
            echo -e "   This is a production infrastructure file."
            echo -e "   Only commit if the change benefits WHM production."
            echo -e "   If this was modified for Z.ai convenience, unstage it:"
            echo -e "   ${YELLOW}git restore --staged \"$file\"${NC}"
            echo ""
            WARNINGS=$((WARNINGS + 1))
        fi
    done
done

# Check for .env.example modifications (allowed but flag for review)
for file in $STAGED_FILES; do
    if [[ "$file" == ".env.example" ]]; then
        echo -e "${YELLOW}ℹ️  .env.example is staged — make sure no real secrets are in it.${NC}"
        echo ""
    fi
done

# Summary
echo "─────────────────────────────────────────"
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ $ERRORS forbidden file(s) staged.${NC}"
    echo -e "${RED}   Unstage them before pushing:${NC}"
    echo -e "${RED}   git restore --staged <file>${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS sensitive file(s) staged — review above.${NC}"
    echo -e "${GREEN}✅ No forbidden files. Safe to push if sensitive changes are intentional.${NC}"
    exit 0
else
    echo -e "${GREEN}✅ All clear. No environment-specific files staged.${NC}"
    echo -e "${GREEN}   Safe to push to GitHub.${NC}"
    exit 0
fi

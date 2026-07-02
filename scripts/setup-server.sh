#!/bin/bash
# scripts/setup-server.sh
# ── InventoryOS: One-command server setup + diagnostic ──
#
# Run this on your server after git pull. It:
#   1. Installs dependencies
#   2. Pushes the DB schema (creates all tables)
#   3. Creates/resets the super-admin account
#   4. Builds the app
#   5. Runs the diagnostic check
#
# Usage:
#   bash scripts/setup-server.sh
#
# It will prompt you for the super-admin username + password.
# If you want non-interactive, pass them as args:
#   bash scripts/setup-server.sh admin MyPassword123

set -e

cd "$(dirname "$0")/.." || { echo "Could not find project root"; exit 1; }

echo "══════════════════════════════════════════════════"
echo "  InventoryOS — Server Setup"
echo "══════════════════════════════════════════════════"
echo ""

# ── 1. Check .env exists ──
if [ ! -f .env ]; then
  echo "⚠️  No .env file found."
  if [ -f .env.example ]; then
    echo "   Copying .env.example → .env"
    cp .env.example .env
    echo "   ⚠️  Edit .env with your real DATABASE_URL before continuing!"
    echo "   Press Enter after editing, or Ctrl+C to abort."
    read -r
  else
    echo "❌ No .env and no .env.example. Cannot continue."
    exit 1
  fi
fi

# Verify DATABASE_URL is set
if ! grep -q "DATABASE_URL=" .env || grep -q 'DATABASE_URL=""' .env; then
  echo "❌ DATABASE_URL is not set in .env"
  echo "   Edit .env and set DATABASE_URL to your PostgreSQL connection string."
  exit 1
fi
echo "✅ .env exists with DATABASE_URL"

# ── 2. Install dependencies ──
echo ""
echo "── Installing dependencies ──"
bun install
echo "✅ Dependencies installed"

# ── 3. Push DB schema ──
echo ""
echo "── Pushing database schema ──"
bun run db:push
echo "✅ Database schema synced"

# ── 4. Create super-admin ──
echo ""
echo "── Super-admin setup ──"
SA_USERNAME="${1:-}"
SA_PASSWORD="${2:-}"

if [ -z "$SA_USERNAME" ]; then
  read -r -p "Super-admin username [admin]: " SA_USERNAME
  SA_USERNAME="${SA_USERNAME:-admin}"
fi

if [ -z "$SA_PASSWORD" ]; then
  read -r -s -p "Super-admin password (min 6 chars): " SA_PASSWORD
  echo ""
  if [ ${#SA_PASSWORD} -lt 6 ]; then
    echo "❌ Password too short"
    exit 1
  fi
fi

bunx tsx scripts/create-super-admin.ts "$SA_USERNAME" "$SA_PASSWORD"
echo "✅ Super-admin created"

# ── 5. Build ──
echo ""
echo "── Building app ──"
bun run build
echo "✅ Build complete"

# ── 6. Diagnostic ──
echo ""
echo "── Diagnostic check ──"
echo "Checking if the app is running..."
sleep 2

# Try to hit the setup-status endpoint
PORT="${PORT:-3000}"
STATUS_URL="http://localhost:${PORT}/api/setup-status"

if curl -s --max-time 5 "$STATUS_URL" > /tmp/invos-status.json 2>/dev/null; then
  echo ""
  echo "── Setup Status ──"
  # Pretty-print the summary
  cat /tmp/invos-status.json | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print('Database connected:', d['database']['connected'])
    print('SuperAdmin accounts:', d['database']['superAdminCount'])
    print('Can login:', d['summary']['canLogin'])
    print('Can use Shelf Scanner:', d['summary']['canUseShelfScanner'])
    print('Next action:', d['summary']['nextAction'])
    print()
    print('Steps:')
    for s in d['steps']:
        icon = '✅' if s['status'] == 'ok' else '❌' if s['status'] == 'fail' else '⚠️'
        print(f'  {icon} {s[\"step\"]}: {s[\"detail\"]}')
except Exception as e:
    print('Could not parse status:', e)
    print(sys.stdin.read() if hasattr(sys.stdin, 'read') else '')
" 2>/dev/null || cat /tmp/invos-status.json
else
  echo "⚠️  App not running on port $PORT yet."
  echo "   Start it with: bun run start"
  echo "   Or if using PM2: pm2 restart inventoryos"
  echo "   Then visit: http://localhost:${PORT}/api/setup-status"
fi

echo ""
echo "══════════════════════════════════════════════════"
echo "  Setup complete!"
echo "══════════════════════════════════════════════════"
echo ""
echo "Super-admin login:"
echo "  Username: $SA_USERNAME"
echo "  Password: (the one you just entered)"
echo "  URL: http://localhost:${PORT}/admin"
echo ""
echo "Next: restart your app (pm2 restart / systemctl restart / docker restart)"

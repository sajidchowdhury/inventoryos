# ── InventoryOS: How to Link with GitHub ──

## Why This Matters

Without a GitHub remote, your code lives only on this server's disk. If the
server is reset, rebooted, or the disk fails, ALL work is lost. GitHub provides:
- Version history (every commit is a restore point)
- Off-site backup (code lives in 2+ places)
- Collaboration (multiple developers can work simultaneously)
- CI/CD (automated testing and deployment)

## Step 1: Create a GitHub Repository

1. Go to https://github.com/new
2. Repository name: `inventoryos`
3. Description: `Pharmacy inventory management system for Bangladeshi small businesses`
4. Set to **Private** (this is a commercial project)
5. Do NOT initialize with README, .gitignore, or license (we already have these)
6. Click **Create repository**

## Step 2: Link the Local Repo to GitHub

Run these commands on the server (replace `YOUR_USERNAME`):

```bash
cd /home/z/my-project

# Add the GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/inventoryos.git

# Verify the remote was added
git remote -v
# Should show:
# origin  https://github.com/YOUR_USERNAME/inventoryos.git (fetch)
# origin  https://github.com/YOUR_USERNAME/inventoryos.git (push)

# Push the current code to GitHub
git push -u origin main
```

## Step 3: Authenticate with GitHub

If `git push` asks for a password, GitHub no longer accepts account passwords
for git operations. Use one of these methods:

### Option A: Personal Access Token (PAT) — easiest

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Note: `InventoryOS deploy`
4. Expiration: 90 days
5. Scopes: check `repo` (full repository access)
6. Click **Generate token**
7. Copy the token (you won't see it again)
8. When `git push` asks for password, paste the token

To save the token so you don't enter it every time:

```bash
git config --global credential.helper store
# Next push will save the token to ~/.git-credentials
git push -u origin main
```

### Option B: SSH key — more secure, recommended for long-term

```bash
# Generate an SSH key
ssh-keygen -t ed25519 -C "inventoryos-server" -f ~/.ssh/id_ed25519_inventoryos
# Press Enter for empty passphrase (or set one for extra security)

# Copy the public key
cat ~/.ssh/id_ed25519_inventoryos.pub
# Copy the output

# Add to GitHub: Settings → SSH and GPG keys → New SSH key
# Title: InventoryOS Server
# Key: paste the output from above

# Tell git to use this key for GitHub
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_inventoryos
  IdentitiesOnly yes
EOF

# Switch the remote from HTTPS to SSH
git remote set-url origin git@github.com:YOUR_USERNAME/inventoryos.git

# Push
git push -u origin main
```

## Step 4: Daily Workflow (NEVER lose work again)

After making changes, ALWAYS commit and push:

```bash
cd /home/z/my-project

# See what changed
git status

# Stage all changes
git add -A

# Commit with a descriptive message
git commit -m "feat: add Redis cache support for multi-instance scaling"

# Push to GitHub
git push
```

### Quick alias (optional)

Add to `~/.bashrc`:

```bash
alias gpush='git add -A && git commit -m "auto-save $(date +%Y-%m-%d_%H:%M)" && git push'
```

Then just run `gpush` to save everything with one command.

## Step 5: Restore from GitHub (if server is reset again)

```bash
cd /home/z/my-project

# Clone fresh from GitHub
git clone https://github.com/YOUR_USERNAME/inventoryos.git .

# Install dependencies
npm install

# Copy .env from a secure backup (NEVER commit .env)
# Create .env with your production values
nano .env

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Build
npm run build

# Start
npm run start
```

## Preventing .env from Being Committed

The `.gitignore` file already excludes `.env` and `.env.production`. Verify:

```bash
git status .env
# Should say: "nothing to commit, working tree clean" (file is ignored)

# If .env was accidentally committed before, remove it from tracking:
git rm --cached .env
git rm --cached .env.production
git commit -m "fix: remove .env from git tracking"
git push
```

## Branch Strategy (for teams)

```bash
# Create a feature branch
git checkout -b feature/redis-cache

# Make changes, commit, push
git add -A
git commit -m "feat: add Redis cache support"
git push -u origin feature/redis-cache

# Create a Pull Request on GitHub
# Review, merge, then switch back to main
git checkout main
git pull origin main
```

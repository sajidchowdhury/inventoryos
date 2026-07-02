# ── InventoryOS Multi-Stage Dockerfile ──
# Stage 1: deps   — install node_modules with npm ci (cached layer)
# Stage 2: builder — generate Prisma client, build Next.js (standalone output)
# Stage 3: runner — minimal runtime image with standalone server + static + public
#
# Built to be run via `docker compose build` (see docker-compose.yml).
# The runner image is ~150-250MB and has no dev dependencies, source maps, or .next/cache.

# ────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

# Prisma engines need libc6-compat on Alpine musl.
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy lockfile + package manifest first to maximise cache hits.
COPY package.json package-lock.json* ./
# If you maintain a bun.lock instead, copy that too — but npm ci requires package-lock.json.
# Generate one on the host with `npm install` before building if it is missing.

RUN npm ci

# ────────────────────────────────────────────────────────────────────────────
# Stage 2 — builder
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Bring installed node_modules from deps stage.
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the source (prisma schema, src, public, configs).
COPY . .

# Disable Next.js telemetry during build.
ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma client (must run before next build so @prisma/client resolves).
RUN npx prisma generate

# Build the standalone Next.js bundle. The `next build` step also copies
# .next/static and public/ into .next/standalone via the post-build step in
# package.json (see `npm run build`).
RUN npm run build

# ────────────────────────────────────────────────────────────────────────────
# Stage 3 — runner
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# wget is required by the container healthcheck (curl is not in alpine by default).
# dumb-init gives us a proper PID 1 / signal handler.
RUN apk add --no-cache libc6-compat wget dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user for defence-in-depth.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy the standalone server produced by `next build` (output: "standalone").
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy the static assets (JS/CSS chunks) and public/ folder separately —
# Next.js does NOT bundle these into the standalone server by default.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# dumb-init reaps zombies and forwards signals (SIGTERM) to node.
CMD ["dumb-init", "node", "server.js"]

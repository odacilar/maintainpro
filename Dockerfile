# =============================================================================
# MaintainPro — Multi-stage Dockerfile for AWS App Runner (MVP)
# =============================================================================
# IMPORTANT: next.config.mjs MUST contain `output: 'standalone'` for the
# standalone copy in stage 3 to exist. This file will build but the runner
# stage will fail at startup if that option is missing.
# =============================================================================

# ─── Stage 1: deps ────────────────────────────────────────────────────────────
# Install ALL dependencies (dev included) so that `prisma generate` and
# `next build` have access to their compile-time tools.
FROM node:20-alpine AS deps

# libc compatibility needed by some native modules on Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy lockfile + manifests first for better layer caching
COPY package.json package-lock.json ./

# Install all deps (dev + prod) — prisma generate and next build need them
RUN npm ci

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Bring in installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source
COPY . .

# Generate Prisma client (writes into node_modules/.prisma and @prisma/client)
RUN npx prisma generate

# Build Next.js in standalone mode
# Ensure next.config.mjs has: output: 'standalone'
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_APP_URL=https://promaintenance.focusoda.com
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create a non-root user for security (App Runner runs as root by default,
# but locking down the user reduces blast radius if the container is exploited)
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone Next.js server bundle
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public folder (favicons, PWA manifest, icons, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma schema + migrations so the app can run `prisma migrate deploy`
# on startup (or via an init container / App Runner custom command).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy generated Prisma client for runtime query engine
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma        ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs

EXPOSE 3000

# server.js is emitted by Next.js standalone build into .next/standalone/
CMD ["node", "server.js"]

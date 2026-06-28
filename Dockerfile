# syntax=docker/dockerfile:1

# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/

RUN pnpm build

# ─── Stage 2: Pruner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS pruner

RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:22-slim AS runner

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
  git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai

RUN groupadd -r appgroup && useradd -r -m -d /home/appuser -g appgroup appuser

WORKDIR /app

COPY --from=pruner --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --chown=appuser:appgroup package.json ./

RUN mkdir -p /workspace && chown appuser:appgroup /workspace

USER appuser

ENV NODE_ENV=production
ENV WORKSPACE_DIR=/workspace

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
# ============================================================================
# Stage 0: Official Bun Runtime & Deterministic Lockfile Installer
# ============================================================================
FROM oven/bun:1.4-alpine AS bun-bin

# ============================================================================
# Stage 1: Build Frontend (Vite SPA) & Backend (esbuild Bundle)
# ============================================================================
FROM node:22-alpine AS builder

COPY --from=bun-bin /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy package manifests and install deterministic dependencies from bun.lock
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy full application source and build client (dist/) + server (dist-server/server.cjs)
COPY . .
RUN npm run build

# ============================================================================
# Stage 2: Lightweight Production Runtime Image (Bun + Node 22 Alpine)
# ============================================================================
FROM node:22-alpine AS runner

COPY --from=bun-bin /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/ruanglabmu.db

# Install deterministic production dependencies from bun.lock
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production \
  && rm -rf /root/.bun/install/cache

# Copy compiled frontend assets and bundled server from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# Ensure writable data directory for SQLite & atomic state persistence
RUN mkdir -p /app/data && chown -R node:node /app

VOLUME ["/app/data"]

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1

CMD ["node", "dist-server/server.cjs"]

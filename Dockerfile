# ============================================================================
# Stage 1: Build Frontend (Vite SPA) & Backend (esbuild Node 20 Bundle)
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests and install deterministic dependencies
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy full application source and build client (dist/) + server (dist-server/server.cjs)
COPY . .
RUN npm run build

# ============================================================================
# Stage 2: Lightweight Production Runtime Image (Alpine Linux)
# ============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install only production runtime dependencies required by externalized server packages (express, ws)
COPY package.json ./
RUN node -e "const p=require('./package.json'); require('fs').writeFileSync('package.json', JSON.stringify({name:p.name,version:p.version,private:true,dependencies:{express:p.dependencies.express,ws:p.dependencies.ws}}))" \
  && npm install --omit=dev --no-package-lock \
  && npm cache clean --force

# Copy compiled frontend assets and bundled server from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# Ensure writable data directory for atomic state persistence
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1

CMD ["node", "dist-server/server.cjs"]

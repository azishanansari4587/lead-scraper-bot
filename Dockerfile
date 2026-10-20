# ==============================================================
# Knotiq Rugs Lead Scraper Bot - Production Multi-Stage Dockerfile
# ==============================================================

# --------------------------------------------------------------
# Stage 1: Build React + Vite Dashboard
# --------------------------------------------------------------
FROM node:20-bookworm-slim AS dashboard-builder

WORKDIR /build/dashboard

# Copy dashboard dependencies
COPY dashboard/package*.json ./
RUN npm ci

# Copy dashboard source and build static bundle
COPY dashboard/ ./
RUN npm run build

# --------------------------------------------------------------
# Stage 2: Production Server Runtime
# --------------------------------------------------------------
FROM node:20-bookworm-slim AS production

# Install system dependencies (curl for healthcheck, dumb-init for process reaping, build tools for native addons)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    dumb-init \
    python3 \
    make \
    g++ \
    gcc \
    libcap2-bin \
    && setcap 'cap_net_bind_service=+ep' /usr/local/bin/node \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=80
ENV DB_DIALECT=sqlite
ENV DB_STORAGE=/app/data/dev.sqlite

# Copy root backend dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code
COPY src/ ./src
COPY migrations/ ./migrations
COPY .env.example ./

# Copy built dashboard static bundle from Stage 1
COPY --from=dashboard-builder /build/dashboard/dist ./dashboard/dist

# Prepare data and exports directory with non-root ownership
RUN mkdir -p /app/data/exports /app/data/backups /app/data/debug \
    && chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose HTTP API & Dashboard Port (Port 80 for Vercel/Production, 5000 for local)
EXPOSE 80 5000

# Healthcheck targeting public /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-80}/health || curl -f http://localhost:5000/health || exit 1

# Process supervisor
ENTRYPOINT ["dumb-init", "--"]

# Launch API server (serves Express API + Dashboard SPA)
CMD ["node", "src/api/server.js"]

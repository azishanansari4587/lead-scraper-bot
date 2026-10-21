FROM mcr.microsoft.com/playwright:v1.50.1-jammy

WORKDIR /app

# Environment defaults
ENV NODE_ENV=production
ENV PORT=5000
ENV DB_PATH=/data/app.db

# Copy package descriptors
COPY package*.json ./
COPY dashboard/package*.json ./dashboard/

# Install root dependencies (production) and dashboard dependencies with npm ci
RUN npm ci --omit=dev && \
    (cd dashboard && npm ci)

# Copy application sources
COPY src/ ./src
COPY migrations/ ./migrations
COPY dashboard/ ./dashboard
COPY .env.example ./

# Build React + Vite Dashboard
RUN (cd dashboard && npm run build)

# Create persistent volume directory and assign ownership to non-root playwright user
RUN mkdir -p /data /app/data && \
    chown -R pwuser:pwuser /data /app

# Declare persistent volume for SQLite database storage
VOLUME ["/data"]

# Run as non-root user
USER pwuser

# Expose server port
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT:-5000}/health || exit 1

# Start the long-lived server process
CMD ["npm", "start"]

# ================================
# Novaterm Docker Image
# Multi-stage build for production
# ================================

# Stage 1: Dependencies
FROM node:20-slim AS deps
WORKDIR /app

# Install dependencies needed for native modules (ssh2) and Prisma
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# ================================
# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ================================
# Stage 3: Production Runner
FROM node:20-slim AS runner
WORKDIR /app

# Install runtime dependencies (OpenSSL for Prisma, wget for healthcheck)
RUN apt-get update && apt-get install -y \
    openssl \
    wget \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create entrypoint script for database initialization
RUN echo '#!/bin/sh\n\
set -e\n\
echo "[Entrypoint] Waiting for database to be ready..."\n\
max_attempts=30\n\
attempt=0\n\
while [ $attempt -lt $max_attempts ]; do\n\
  if npm run db:push > /dev/null 2>&1; then\n\
    echo "[Entrypoint] Database is ready!"\n\
    break\n\
  fi\n\
  attempt=$((attempt + 1))\n\
  echo "[Entrypoint] Database is unavailable - attempt $attempt/$max_attempts - sleeping"\n\
  sleep 2\n\
done\n\
if [ $attempt -eq $max_attempts ]; then\n\
  echo "[Entrypoint] Warning: Database may not be ready, but continuing..."\n\
fi\n\
echo "[Entrypoint] Pushing database schema..."\n\
npm run db:push || echo "[Entrypoint] Schema push failed, continuing..."\n\
echo "[Entrypoint] Seeding database..."\n\
npm run db:seed || echo "[Entrypoint] Seeding failed, continuing..."\n\
echo "[Entrypoint] Starting server..."\n\
exec "$@"' > /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Use entrypoint to initialize database before starting server
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server/index.js"]


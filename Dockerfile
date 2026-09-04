# ==============================================================================
# Antigravity Web (agy-web) Production Dockerfile
# ==============================================================================

FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native bindings
RUN apt-get update && apt-get install -y python3 make g++ git && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install all workspace dependencies
RUN npm install

# Copy sources
COPY shared ./shared
COPY client ./client
COPY server ./server

# Build server and client
RUN npm run build

# ==============================================================================
# Production Runtime Stage
# ==============================================================================
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80
ENV HOME=/home/adam
ENV PATH=/home/adam/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV AGY_BIN=/home/adam/.local/bin/agy
ENV QEMU_LD_PREFIX=/usr/aarch64-linux-gnu
ENV WORKSPACE_ROOT=/home/adam/projects/my-domain

# Install runtime dependencies
RUN apt-get update && apt-get install -y python3 make g++ git bash curl && rm -rf /var/lib/apt/lists/* \
  && git config --global --add safe.directory "*"

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install production dependencies only
RUN npm install --omit=dev

# Copy build artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/shared ./shared

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

CMD ["npm", "start"]

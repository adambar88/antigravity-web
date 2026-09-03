# ==============================================================================
# Antigravity Web (agy-web) Production Dockerfile
# ==============================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++

# Copy root workspace and package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies for all workspaces
RUN npm ci

# Copy source files
COPY shared ./shared
COPY client ./client
COPY server ./server

# Build shared, server, and client
RUN npm run build

# ==============================================================================
# Production Image
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ git bash

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/shared ./shared

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["npm", "start"]

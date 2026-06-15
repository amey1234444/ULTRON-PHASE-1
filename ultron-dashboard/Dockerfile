# ── ULTRON Dashboard ── multi-stage build: Node build → Nginx static serve
FROM node:22-slim AS builder

WORKDIR /workspace

# Copy workspace-level package files
COPY package.json ./
COPY packages/hmi-core/package.json packages/hmi-core/
COPY packages/hmi-ui/package.json packages/hmi-ui/
COPY ultron-dashboard/package.json ultron-dashboard/

# Install dependencies (all workspaces)
RUN npm install --ignore-scripts

# Copy source code
COPY packages/ packages/
COPY ultron-dashboard/ ultron-dashboard/

# Build dashboard
RUN npm run build -w ultron-dashboard

# ── Production stage: Nginx serves the static SPA ──
FROM nginx:1.27-alpine

# Copy built assets
COPY --from=builder /workspace/ultron-dashboard/dist /usr/share/nginx/html

# Copy nginx config
COPY ultron-dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost:80/ || exit 1

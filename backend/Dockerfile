# ── Stage 1: Install dependencies ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# ── Stage 2: Production image ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -S movesmart && adduser -S movesmart -G movesmart

# Copy production deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src

# Create writable dirs
RUN mkdir -p uploads logs && chown -R movesmart:movesmart /app

USER movesmart

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]

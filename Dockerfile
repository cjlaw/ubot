FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends libatomic1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node package*.json tsconfig.json ./
RUN npm ci
COPY --chown=node:node . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends libatomic1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node --from=builder /app/dist ./dist
USER node
CMD ["node", "dist/bot.js"]

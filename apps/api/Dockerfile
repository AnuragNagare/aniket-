# Multi-stage Dockerfile for @worktrail/api and worker
# Build context: repository root
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

FROM base AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --filter @worktrail/api...

COPY packages/types ./packages/types
COPY apps/api ./apps/api

RUN pnpm --filter @worktrail/types build
RUN pnpm --filter @worktrail/api prisma generate
RUN pnpm --filter @worktrail/api build
RUN pnpm deploy --filter @worktrail/api --prod /prod/app

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /prod/app /app
COPY --from=builder /app/apps/api/dist /app/dist
COPY --from=builder /app/apps/api/prisma /app/prisma

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium \
    && chown -R node:node /ms-playwright /app

USER node
EXPOSE 4000

CMD ["node", "dist/main.js"]

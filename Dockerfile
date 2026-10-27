# syntax=docker/dockerfile:1
# Один Dockerfile на монорепо, цели: migrate, web, worker.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable pnpm
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Payload читает конфиг при сборке; к базе сборка не подключается.
RUN PAYLOAD_SECRET=build-only DATABASE_URL=postgres://build@localhost/build pnpm -F @mama/web build \
 && pnpm -F @mama/worker build \
 && pnpm deploy --legacy --filter @mama/worker --prod /out/worker

# Миграции по порядку: сначала Payload, потом drizzle-kit (схема app) + список доступа из env.
FROM build AS migrate
CMD ["sh", "-c", "pnpm -F @mama/web payload migrate && pnpm -F @mama/shared db:migrate"]

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM node:24-bookworm-slim AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /out/worker ./
USER node
CMD ["node", "--enable-source-maps", "dist/index.js"]

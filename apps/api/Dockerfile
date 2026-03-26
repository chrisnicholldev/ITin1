FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Build shared package
FROM deps AS build-shared
COPY packages/shared ./packages/shared
RUN pnpm --filter @itdesk/shared build

# Build API
FROM build-shared AS build-api
COPY apps/api ./apps/api
RUN pnpm --filter @itdesk/api build

# Production image
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build-shared /app/packages/shared/dist ./packages/shared/dist
COPY --from=build-api /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

RUN mkdir -p uploads

EXPOSE 3001

CMD ["node", "dist/server.js"]

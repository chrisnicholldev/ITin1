FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM deps AS build-shared
COPY packages/shared ./packages/shared
RUN pnpm --filter @itdesk/shared build

FROM build-shared AS build-web
COPY apps/web ./apps/web
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @itdesk/web build

FROM nginx:alpine AS runner
COPY --from=build-web /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

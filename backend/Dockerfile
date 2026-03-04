## ---- base: install deps + build shared types ----
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
RUN npm install
COPY packages/shared ./packages/shared
COPY backend ./backend
RUN npm run -w @pulse/shared build

## ---- dev: source is baked in, tsx watch for hot reload ----
FROM base AS dev
CMD ["sh", "-c", "cd backend && npx drizzle-kit push && cd /app && npm run -w backend dev"]

## ---- build: compile TypeScript ----
FROM base AS build
RUN npm run -w backend build

## ---- prod: only compiled JS + drizzle schema for migrations ----
FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/backend/package.json ./backend/
RUN npm install --omit=dev
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/backend/dist ./backend/dist
# Include schema source + drizzle config so drizzle-kit push works at startup
COPY --from=build /app/backend/src/db/schema ./backend/src/db/schema
COPY --from=build /app/backend/drizzle.config.ts ./backend/drizzle.config.ts
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/backend/tsconfig.json ./backend/tsconfig.json
# Install drizzle-kit + tsx for schema push at startup (small addition)
RUN npm install -w backend drizzle-kit tsx
EXPOSE 3000
CMD ["sh", "-c", "cd backend && npx drizzle-kit push && cd /app && node backend/dist/index.js"]

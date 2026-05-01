# ---------- base: install deps ----------
FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

RUN npm ci


# ---------- build: compile TypeScript ----------
FROM base AS build

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY backend ./backend

# Build shared first so dist/index.d.ts exists when backend resolves @pulse/shared
RUN npm run -w @pulse/shared build
RUN npm run -w backend build


# ---------- prod: minimal runtime image ----------
FROM node:22-alpine AS prod
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/packages/shared/package.json ./packages/shared/

RUN npm ci --omit=dev

# Compiled JS output
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/backend/dist ./backend/dist

# Schema migration support — drizzle-kit push runs at startup via tsx
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/backend/tsconfig.json ./backend/tsconfig.json
COPY --from=build /app/backend/drizzle.config.ts ./backend/drizzle.config.ts
COPY --from=build /app/backend/src/db/schema ./backend/src/db/schema
RUN npm install -w backend drizzle-kit tsx

EXPOSE 3000
CMD ["sh", "-c", "cd backend && npx drizzle-kit push && cd /app && node backend/dist/index.js"]

# ---------- base: install deps ----------
FROM node:22-alpine AS base
WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json* ./

# Copy workspace manifests (for npm install caching)
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

# Install all workspace deps
RUN npm ci


# ---------- build: compile all TS using project refs ----------
FROM base AS build

# Copy full source AFTER install (better caching)
COPY tsconfig.base.json ./
COPY packages ./packages
COPY backend ./backend

RUN npx tsc -b backend/tsconfig.build.json


# ---------- prod: minimal runtime image ----------
FROM node:22-alpine AS prod
WORKDIR /app

# Copy only what runtime needs
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/packages/shared/package.json ./packages/shared/

# Install only production deps
RUN npm ci --omit=dev

# Copy compiled output
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/backend/dist ./backend/dist

# (Optional) If you need runtime configs like drizzle
COPY --from=build /app/backend/drizzle.config.ts ./backend/drizzle.config.ts
COPY --from=build /app/backend/src/db/schema ./backend/src/db/schema

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
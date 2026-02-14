FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
RUN npm install
COPY packages/shared ./packages/shared
COPY backend ./backend
RUN npm run -w @pulse/shared build

FROM base AS dev
CMD ["npm", "run", "-w", "backend", "dev"]

FROM base AS build
RUN npm run -w backend build

FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/backend/package.json ./backend/
RUN npm install --omit=dev
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/backend/dist ./backend/dist
EXPOSE 3001
CMD ["node", "backend/dist/index.js"]

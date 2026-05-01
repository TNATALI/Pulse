# ---------- base: install deps ----------
FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/

RUN npm ci


# ---------- dev: vite dev server with HMR ----------
FROM base AS dev

COPY packages/shared ./packages/shared
COPY frontend ./frontend

RUN npm run -w @pulse/shared build

EXPOSE 5173
CMD ["npm", "run", "-w", "frontend", "dev"]


# ---------- build: compile frontend assets ----------
FROM base AS build

COPY packages/shared ./packages/shared
COPY frontend ./frontend

RUN npm run -w @pulse/shared build
RUN npm run -w frontend build


# ---------- prod: nginx serving static assets ----------
FROM nginx:alpine AS prod
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

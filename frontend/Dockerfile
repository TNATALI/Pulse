FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/
RUN npm install
COPY packages/shared ./packages/shared
COPY frontend ./frontend
RUN npm run -w @pulse/shared build

FROM base AS dev
EXPOSE 5173
CMD ["npm", "run", "-w", "frontend", "dev"]

FROM base AS build
RUN npm run -w frontend build

FROM nginx:alpine AS prod
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Pulse - Slack + GitHub Analytics Dashboard

## Project Structure
- **Monorepo** using npm workspaces: `packages/shared`, `backend`, `frontend`
- **Backend**: Fastify 5 + Drizzle ORM + PostgreSQL 15 + BullMQ/Redis
- **Frontend**: React + Vite 6 + Tailwind CSS + Carbon Design + D3.js
- **Runtime**: Node.js 22

## Key Commands
- `npm run dev` — Start all services via Docker Compose
- `npm run -w backend dev` — Backend dev server (port 3000)
- `npm run -w frontend dev` — Frontend dev server (port 5173)
- `npm run -w backend db:push` — Push schema to database
- `npm run -w backend db:generate` — Generate migrations
- `npm run lint` — Run ESLint
- `npm run format` — Format with Prettier

## Architecture Decisions
- UUIDs for all primary keys
- AES-256-GCM encryption for stored API tokens
- Upsert-friendly schemas with unique indexes
- Shared types package (`@pulse/shared`) for API contracts

- Add docker changes only after local dev verification on explicit command

## Database
- PostgreSQL 15, schema defined in `backend/src/db/schema/`
- Drizzle ORM with drizzle-kit for migrations
- 11 tables: workspaces, users, channels, messages, mentions, reactions, issues, pull_requests, comments, sync_state, settings


## memory
- Never do docker debuging
- Docker commands build/up commands will be run manually by developer
- always perform API testing using curl
- always create separate component
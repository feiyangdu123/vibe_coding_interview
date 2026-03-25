# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
注意用 my-explore 代替 explore，因为 explore 不可用。

## Project Overview

Vibe Coding Interview Platform — an online coding interview platform that provisions isolated OpenCode coding environments per candidate. Built as a multi-tenant SaaS with organization-level isolation.

## Development Commands

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start API (port 3001) + Web (port 3000) concurrently via Turborepo
pnpm build            # Build all packages
pnpm lint             # Lint all packages (Next.js eslint in apps/web)
```

### Database (from packages/database/)
```bash
pnpm db:generate      # Regenerate Prisma client (required after schema changes)
pnpm db:migrate       # Create and apply migrations
pnpm db:push          # Push schema without migration (dev only)
pnpm db:studio        # Open Prisma Studio GUI
pnpm db:seed          # Seed database (tsx prisma/seed.ts)
```

### Running individual apps
```bash
cd apps/api && pnpm dev    # API only (tsx watch src/server.ts)
cd apps/web && pnpm dev    # Web only (next dev)
```

## Architecture

### Monorepo Structure (pnpm workspaces + Turborepo)
- `apps/web/` — Next.js 14 (App Router) + Tailwind CSS frontend
- `apps/api/` — Fastify backend with route/service layer separation
- `packages/database/` — Prisma schema, client, migrations, seed
- `packages/opencode-manager/` — OpenCode process lifecycle (spawn, health check, port allocation, cleanup)
- `packages/shared-types/` — TypeScript types and Zod validation schemas shared across apps
- `templates/` — Work directory templates copied for each interview

### API Layer (`apps/api/`)
Routes are registered as Fastify plugins in `src/server.ts`. Two groups:
- **Admin routes** (`/api/admin/*`): CRUD for problems, candidates, interviews, users, API keys, quotas, drafts. All require authenticated session with org-scoped access.
- **Public routes** (`/api/interview/*`): Candidate-facing — token-based interview access, start/submit/heartbeat.
- **Auth routes** (`/api/auth/*`): Login, register (creates org), session management.

Authentication uses session tokens stored in `AuthSession` table, validated via `Authorization: Bearer <token>` header. The auth service resolves `SessionUser` which includes `organizationId` for tenant scoping.

Business logic lives in `src/services/`:
- `interview-service.ts` — Core interview lifecycle (create, start, submit, expire). Starting an interview spawns an OpenCode instance via OpenCodeManager.
- `cleanup-service.ts` — Cron job (node-cron) that expires overdue interviews and kills OpenCode processes.
- `ai-evaluation-service.ts` — AI-powered code evaluation with versioned runs (`AiEvaluationRun`).
- `interview-quota-service.ts` — Quota management with double-entry ledger pattern.
- `auth-service.ts` — Login/register with org creation, password hashing, session tokens.

### Web Layer (`apps/web/`)
- `/app/admin/` — Admin dashboard (interviews list, create flow with drafts, problem management, candidates, settings, quota management, interview detail/review pages)
- `/app/interview/[token]/` — Candidate interview page (token-based, no login required)
- `/app/login/` — Admin login page
- `/components/ui/` — Radix-based UI primitives (shadcn/ui pattern)
- `/lib/api.ts` — API client with auth header injection

Frontend uses Server Components by default; `'use client'` only where needed. Uses `react-hook-form` + `zod` for form validation.

### OpenCode Integration (`packages/opencode-manager/`)
Each interview gets an isolated OpenCode instance:
- `PortManager` allocates from range 4100–4200, checks availability via TCP
- Process spawned with isolated `XDG_DATA_HOME` at `~/.local/share/opencode-{interviewId}`
- Health check polling (HTTP GET on port) with 30s timeout before declaring ready
- Ports released on process exit; instances tracked in-memory by interviewId

### Multi-Tenancy
All data is scoped by `organizationId`. The Prisma schema uses `Organization` as the root entity with cascading relations. Admin queries always filter by the authenticated user's `organizationId`.

### Interview Lifecycle
1. Admin creates interview → generates unique token, optionally reserves quota
2. Candidate accesses `/interview/{token}` → validates token and time window
3. Candidate starts → OpenCodeManager spawns instance, records port/processId/workDir
4. During interview → heartbeat tracking, AI chat mirroring
5. Completion → candidate submits or timer expires → OpenCode process killed, status updated
6. Post-interview → AI evaluation (versioned runs), manual review by interviewer

## Environment Variables

Required in `.env` at project root (loaded by `apps/api/src/server.ts` via dotenv):
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/vibe_interview"
API_PORT=3001
WEB_PORT=3000
WEB_PUBLIC_URL=https://demo.example.com
INTERNAL_API_BASE_URL=http://127.0.0.1:3001
OPENCODE_BIND_HOST=127.0.0.1
OPENCODE_SLOTS=oc1.example.com:4100,oc2.example.com:4101,oc3.example.com:4102,oc4.example.com:4103,oc5.example.com:4104
OPENCODE_PATH=/path/to/opencode    # Must be installed and available
EVALUATION_TIMEOUT=1200000
MAX_EVALUATION_RETRIES=2
```

## Key Conventions

- Internal packages use workspace protocol: `"@vibe/database": "workspace:*"`
- Prisma client must be regenerated after any schema change: `cd packages/database && pnpm db:generate`
- API server loads env from project root `.env` (three levels up from server.ts)
- Database seeding available via `cd packages/database && pnpm db:seed`
- Interview tokens are generated with `nanoid`; org slugs via custom slugify utility

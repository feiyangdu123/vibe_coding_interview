# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vibe Coding Interview Platform - 在线编程面试平台，为每个候选人提供隔离的 OpenCode 编程环境。

This is a monorepo using pnpm workspaces and Turborepo with:
- Frontend: Next.js 14 (App Router) + Tailwind CSS
- Backend: Fastify API server
- Database: PostgreSQL + Prisma ORM
- OpenCode Integration: Isolated coding environments per interview

## Development Commands

### Initial Setup
```bash
# Install dependencies
pnpm install

# Setup database (Docker)
docker run -d --name vibe-postgres -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=vibe_interview postgres:16

# Run migrations
cd packages/database
pnpm db:migrate

# Or use Prisma Studio to view/edit data
pnpm db:studio
```

### Development
```bash
# Start all services (API + Web)
pnpm dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Clean build artifacts
pnpm clean
```

### Database Operations
```bash
cd packages/database

# Generate Prisma client after schema changes
pnpm db:generate

# Create and apply migration
pnpm db:migrate

# Push schema without migration (dev only)
pnpm db:push

# Open Prisma Studio
pnpm db:studio
```

## Architecture

### Monorepo Structure
- `apps/web/` - Next.js frontend (port 3000)
  - `/app/admin/` - Admin dashboard for managing problems, candidates, interviews
  - `/app/interview/[token]/` - Candidate interview page
  - `/components/` - Shared React components
- `apps/api/` - Fastify backend (port 3001)
  - `/routes/admin/` - Admin CRUD APIs
  - `/routes/interview.ts` - Candidate interview APIs
  - `/services/` - Business logic layer
- `packages/database/` - Prisma schema and client
- `packages/opencode-manager/` - OpenCode instance lifecycle management
- `packages/shared-types/` - TypeScript types shared across apps

### Key Concepts

**OpenCode Integration**: Each interview gets an isolated OpenCode instance:
- Port range: 4100-4200 (managed by PortManager)
- Isolated data directory: `~/.local/share/opencode-{interviewId}`
- Process lifecycle tied to interview status
- Automatic cleanup on interview completion

**Interview Workflow**:
1. Admin creates interview → generates unique token
2. Candidate accesses `/interview/{token}`
3. Candidate starts interview → OpenCodeManager spawns instance
4. Interview auto-expires after duration → cleanup service stops instance

**Database Schema**:
- `Problem`: Interview questions with workDirTemplate, duration, scoring criteria
- `Candidate`: Candidate information
- `Interview`: Links candidate + problem, tracks status, port, processId, timing

### Important Implementation Details

**Port Management**: `packages/opencode-manager/src/index.ts`
- PortManager allocates ports 4100-4200
- Ports are released when process exits
- Prevents port conflicts across concurrent interviews

**Interview Service**: `apps/api/src/services/interview-service.ts`
- `startInterview()` spawns OpenCode instance and updates DB
- Stores port, processId, workDir in Interview record
- Sets startTime and calculates endTime based on duration

**Cleanup Service**: `apps/api/src/services/cleanup-service.ts`
- Cron job checks for expired interviews
- Stops OpenCode processes and updates status to 'completed'

## Environment Variables

Required in `.env` at project root:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/vibe_interview"
API_PORT=3001
WEB_PORT=3000
OPENCODE_PORT_MIN=4100
OPENCODE_PORT_MAX=4200
```

**Important**: The API server loads environment variables from the project root `.env` file using dotenv. The loading happens in `apps/api/src/server.ts` at startup.

## Prerequisites

- OpenCode must be installed and available in PATH
- Test with: `opencode serve --port 4100`
- PostgreSQL running on port 5432

## Development Notes

- Use workspace protocol for internal dependencies: `"@vibe/database": "workspace:*"`
- Prisma client must be regenerated after schema changes: `pnpm db:generate`
- API and Web run concurrently via Turborepo's persistent dev task
- Frontend uses Server Components by default; add 'use client' only when needed

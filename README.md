# Vibe Coding Interview

This repository contains the initial monorepo scaffold for the browser-based coding interview platform described in the PRD.

## What is included

- `apps/portal-web`: Next.js portal for candidates, interviewers, and admins
- `apps/control-plane`: Fastify API for session state, local workspace orchestration, and future proxying
- `packages/db`: Prisma schema starter
- `packages/workspace-core`: local temp workspace and `opencode web` process manager
- `packages/shared-types`: shared domain types
- `packages/config`: environment parsing helpers
- `infra/docker`: local PostgreSQL and Redis compose file

## Current scope

- `MVP v0` uses a local temp directory per session instead of a real sandbox.
- Each session is intended to get its own workspace under `WORKSPACE_ROOT`.
- `opencode web` should be started as a child process bound to `127.0.0.1`.
- If `opencode` is not installed, the control plane falls back to a local mock runtime page so the launch flow can still be tested.
- The reverse proxy route is implemented for local testing and injects Basic Auth before forwarding to the session runtime.

## Quick start

1. Copy `.env.example` to `.env`.
2. Run `pnpm install`.
3. Start local infra with `docker compose -f infra/docker/docker-compose.yml up -d`.
4. Run `pnpm dev:control-plane` and `pnpm dev:portal` in separate terminals.

## Notes

- Dependencies are not installed by this scaffold.
- The control plane currently uses in-memory session state as a bootstrap step.
- Prisma migrations and the real proxy path are still TODOs.

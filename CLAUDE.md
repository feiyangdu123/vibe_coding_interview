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
Each interview gets an isolated OpenCode instance.核心流程：

**端口分配** (`PortManager`, opencode-manager/src/index.ts:30-69):
- 从 4100-4200 范围内分配，通过 TCP bind 探测端口可用性
- `usedPorts` Set 跟踪已用端口，进程退出时自动释放
- API 启动时从数据库恢复活跃端口（interview-service.ts:60-85）

**进程启动** (`startInstance`, opencode-manager/src/index.ts:86-200):
1. 分配端口 → 创建数据目录 `~/.local/share/opencode-{interviewId}`
2. 若组织配置了 API Key，写入 `{dataDir}/opencode/auth.json`（认证）和 `{workDir}/opencode.json`（provider/model 配置）
3. `spawn(opencodePath, ['serve', '--port', port, '--hostname', '0.0.0.0'], { env: { XDG_DATA_HOME: dataDir }, cwd: workDir })`
4. 健康检查：每 500ms 轮询 `http://127.0.0.1:{port}/`，30s 超时
5. 成功后记录 port/processId/dataDir 到数据库，标记 `openCodeStatus: 'ready'`

**工作目录准备** (`prepareInterviewWorkspace`, interview-service.ts:205-227):
1. 根据 `problem.workDirTemplate`（如 `templates/default`）解析模板路径
2. 递归复制到 `~/.local/share/vibe-interviews/{token}`，跳过 node_modules/.git/.next 等
3. 在工作目录执行 `git init && git add -A && git commit` 使 OpenCode 识别为项目
4. 题目描述/要求**不写入**工作目录，仅存储在数据库中通过 Web UI 展示给候选人

**预热机制**: 面试创建后立即 fire-and-forget 启动 OpenCode（不等待候选人加入）。候选人开始面试时：优先复用预热实例 → 等待中的实例轮询就绪 → 兜底同步启动。

**健康监控** (`cleanup-service.ts`): 每分钟 cron 检查所有活跃实例健康状态，进程崩溃则标记面试为系统错误并释放配额。

**进程停止**: 面试提交/超时/面试官终止时调用 `stopInstance()` → kill 进程 → 释放端口。工作目录在面试结束后**保留不删除**。

### AI 评估系统 (`ai-evaluation-service.ts`)

**核心机制：通过 OpenCode CLI 而非直接 API 调用**。评估时 spawn 一个新的 OpenCode 进程：
```
spawn(opencodePath, ['run', '--session', sessionId, '--fork', '--dir', workDir, prompt])
```
使用 `--fork` 从候选人的会话分叉，让评估 AI 看到完整的面试对话上下文。使用组织配置的模型。

**评估触发**:
- 自动：面试完成时（提交/超时/面试官终止）fire-and-forget 调用 `evaluateInterview()`
- 手动：POST `/api/admin/interviews/:id/evaluate` 触发重新评估

**快照隔离与数据库读取** (`opencode-runtime-service.ts`, `chat-history-service.ts`):
评估全程操作的是**快照副本**，不触碰原始面试数据。流程：
1. `createEvaluationSnapshot()` 将原始 `interview.dataDir` 和 `interview.workDir` 复制到 `~/.local/share/vibe-opencode-runtime/{interviewId}/eval/{runId}/` 下的 `data/` 和 `worktree/`
2. 重写快照 SQLite 数据库（`data/opencode/opencode.db`）中的路径引用（project.worktree、session.directory、workspace.directory）指向快照 workDir
3. `getChatHistoryFromDataDir(snapshot.dataDir)` 以只读模式打开**快照的** `data/opencode/opencode.db`，查找最近活跃 session，读取所有消息和 parts（过滤 text/reasoning 类型）
4. `opencode run --fork` 的 `XDG_DATA_HOME` 设为快照 dataDir，`cwd` 和 `--dir` 设为快照 workDir，因此 OpenCode 读取的也是快照 DB
5. 评估完成（无论成功失败）后 `removeEvaluationSnapshot()` 删除整个快照目录

**评估 Prompt 包含**: 题目标题、题目要求、评分标准(scoringRubric)、面试时长、结束原因、项目路径、候选人与 AI 的聊天记录（从快照 SQLite 读取格式化为 `[index] 候选人/AI: <text>`）。

**结果解析**: 从 OpenCode 文本输出中用正则提取：总分(0-10)、五个维度(各 0-2 分：需求拆分、技术方案选择、研究优先方法论、沟通清晰度、迭代改进)、整体评价。

**版本化运行**: 每次评估创建 `AiEvaluationRun` 记录（自增 version），支持多次重新评估。失败时自动重试（最多 2 次），超过则标记失败。评估完成后设置 `manualReviewStatus: 'pending'` 提示人工复核。

### Multi-Tenancy
All data is scoped by `organizationId`. The Prisma schema uses `Organization` as the root entity with cascading relations. Admin queries always filter by the authenticated user's `organizationId`.

### Interview Lifecycle
1. Admin creates interview → generates unique token, prepares workspace (copy template + git init), fire-and-forget 预热 OpenCode
2. Candidate accesses `/interview/{token}` → validates token and time window
3. Candidate starts → 复用预热实例或兜底同步启动 OpenCode，记录 port/processId/workDir
4. During interview → heartbeat tracking, cron 健康监控，进程崩溃自动处理
5. Completion → candidate submits or timer expires → OpenCode process killed, status updated
6. Post-interview → 创建快照 → OpenCode `run --fork` 执行 AI 评估（版本化）→ manual review

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

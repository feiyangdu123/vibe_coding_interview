# Phase 1: 内置登录、Organization 隔离与基础模型升级 Implementation Plan

> **For Codex:** 先完成本阶段，再开始 Phase 2。不要跳过数据库和权限骨架直接做页面。

**Goal:** 建立平台内置账号密码登录、`Organization` 多企业隔离、角色权限和升级后的面试主状态机，为后续页面和流程提供稳定基础。

**Architecture:** API 侧新增组织、用户、会话和鉴权中间层，Web 侧新增登录页、受保护的后台入口和带凭证的 API 调用方式。现有 `Problem` / `Interview` 结构保留主表名，但扩展为能承载多组织、多角色和新状态机的业务对象。

**Tech Stack:** Next.js 14 App Router, Fastify, Prisma, PostgreSQL, React Hook Form, Zod

---

## Locked Decisions

- 使用平台内置账号密码登录。
- 引入 `Organization` 做真实多企业隔离。
- 面试官可以提交最终复核结论。
- 候选人不进入账号体系，仍通过 token 访问。

## Deliverables

- 后台登录页可用。
- API 具备登录、登出、当前用户查询能力。
- 所有后台数据按 `organizationId` 和角色过滤。
- 面试、题目模板具备后续 Phase 所需的扩展字段。
- 本地开发可通过 seed 脚本创建初始企业管理员。

## Task 1: 扩展 Prisma 数据模型

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260315120000_phase1_auth_org/migration.sql`
- Modify: `packages/database/src/index.ts`
- Modify: `packages/shared-types/src/index.ts`
- Create: `packages/shared-types/src/auth.ts`

**Work:**
1. 新增 `Organization`、`User`、`AuthSession` 模型。
2. 为 `Problem` 增加 `organizationId`、`createdById`、`visibility`、`problemType`、`roleTrack`、`difficulty`、`language`、`tags`、`evaluationInstructionsText`、`acceptanceCriteria`。
3. 为 `Interview` 增加 `organizationId`、`interviewerId`、`status` 新枚举值、`endReason`、候选人快照、题目快照、评估标准快照、人工复核字段占位。
4. 用 Prisma 枚举而不是裸字符串表达 `UserRole`、`ProblemVisibility`、`InterviewStatus`。
5. 保留现有 AI 字段，但为后续历史版本扩展预留唯一键和关联位。

**Validation:**
- Run: `cd packages/database && pnpm db:generate`
- Run: `cd packages/database && pnpm db:migrate`
- Expect: Prisma client 生成成功，数据库迁移可执行。

## Task 2: 新增鉴权服务与 API 保护层

**Files:**
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/services/auth-service.ts`
- Create: `apps/api/src/utils/auth.ts`
- Modify: `apps/api/src/routes/admin/candidates.ts`
- Modify: `apps/api/src/routes/admin/problems.ts`
- Modify: `apps/api/src/routes/admin/interviews.ts`
- Modify: `apps/api/src/routes/admin/processes.ts`

**Work:**
1. 实现登录、登出、当前用户接口。
2. 采用服务端 session 方案，session token 落到 `AuthSession`，浏览器保存 HTTP-only cookie。
3. 为后台路由增加统一鉴权和 `organizationId` 注入逻辑。
4. 企业管理员查看本组织全部数据，面试官只查看自己创建或自己负责的面试与可见题目。
5. CORS 开启 `credentials`，为前端登录态透传做准备。

**Validation:**
- Run: `pnpm --filter @vibe/api build`
- Manual: `POST /api/auth/login` 返回 cookie，`GET /api/auth/me` 返回用户和组织信息。
- Manual: 未登录访问 `/api/admin/interviews` 返回 401。

## Task 3: 建立 Web 登录入口和后台守卫

**Files:**
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/components/auth/login-form.tsx`
- Create: `apps/web/lib/api.ts`
- Create: `apps/web/middleware.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/admin/layout.tsx`

**Work:**
1. 新建登录页，支持账号密码提交和错误反馈。
2. 抽出统一 `apiFetch`，默认带 `credentials: 'include'`。
3. 用 middleware 或 layout 守卫 `/admin` 路由，未登录时跳转 `/login`。
4. 首页改为根据登录态跳转 `/admin` 或 `/login`。
5. 后台布局增加当前用户组织名和登出入口。

**Validation:**
- Run: `pnpm --filter @vibe/web build`
- Manual: 未登录访问 `/admin` 被重定向到 `/login`。
- Manual: 登录成功后进入 `/admin`。

## Task 4: 为本地开发提供初始组织和管理员种子

**Files:**
- Create: `packages/database/scripts/seed-phase1-auth.ts`
- Modify: `packages/database/scripts/README.md`

**Work:**
1. 提供脚本创建一个 `Organization`、一个企业管理员、一个面试官。
2. 密码先使用 bcrypt 哈希；不要在数据库中存明文。
3. README 写明本地默认账号、重置方式和执行命令。

**Validation:**
- Run: `pnpm tsx packages/database/scripts/seed-phase1-auth.ts`
- Expect: 能看到组织、管理员和面试官写入数据库。

## Task 5: 统一共享类型并清理旧三态依赖

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-types/src/validation.ts`
- Modify: `apps/web/app/admin/interviews/page.tsx`
- Modify: `apps/web/app/interview/[token]/page.tsx`
- Modify: `apps/api/src/services/cleanup-service.ts`

**Work:**
1. 把旧的 `pending / in_progress / completed` 升级为新状态机。
2. 同步更新前后端状态显示逻辑和路由守卫。
3. 先不实现完整新页面，但要保证旧页面在编译期不依赖废弃类型。

**Validation:**
- Run: `pnpm build`
- Expect: Web、API、shared-types、database 全部构建通过。

## Acceptance Criteria

- 使用种子账号可登录后台。
- 多个组织间的数据默认不可见。
- 企业管理员可看本组织全部数据，面试官仅看授权范围。
- 旧页面已切换到新共享类型，后续 Phase 不需要再返工基础状态机。


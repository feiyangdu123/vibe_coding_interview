# Phase 2: 题目模板与单场面试创建 Implementation Plan

> **For Codex:** 本阶段建立后台准备链路。不要提前实现批量导入、智能推荐和导出。

**Goal:** 把现有题目管理升级为题目模板体系，并完成“选择题目模板 -> 指定面试官 -> 创建单场面试 -> 生成候选人链接”的 MVP 创建流程。

**Architecture:** 沿用现有 `problems` 路由与页面骨架，但语义升级为题目模板。面试创建流程从列表页弹窗迁移为独立新建页，创建时生成题目快照和评估标准快照，保证后续 AI 评估与复核的稳定性。

**Tech Stack:** Next.js 14, Fastify, Prisma, React Hook Form, Zod

---

## Dependencies

- Phase 1 已完成登录、Organization 隔离、角色过滤和新状态机。

## Deliverables

- 题目库页支持系统题、企业共享题、私有题。
- 题目模板支持文本评估说明 + 验收点列表。
- 新建面试页支持单场创建、指定面试官、生成候选人链接。
- 创建面试时固化题目与评估标准快照。

## Task 1: 扩展题目模板接口和共享类型

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-types/src/validation.ts`
- Modify: `apps/api/src/routes/admin/problems.ts`

**Work:**
1. 为题目模板 DTO 增加 `visibility`、`problemType`、`roleTrack`、`difficulty`、`language`、`tags`、`evaluationInstructionsText`、`acceptanceCriteria`。
2. 后台接口默认按 `organizationId`、角色和可见范围过滤。
3. 系统内置题仅平台可写，企业用户只读；企业共享和私有题允许企业内维护。

**Validation:**
- Run: `pnpm --filter @vibe/api build`
- Manual: 企业用户拉取题目列表时只能看到本组织题目和系统题。

## Task 2: 升级题目库页为模板工作台

**Files:**
- Modify: `apps/web/app/admin/problems/page.tsx`
- Create: `apps/web/components/problem/problem-preview-dialog.tsx`
- Create: `apps/web/components/problem/problem-form.tsx`

**Work:**
1. 在题目库页增加可见范围 tabs 或筛选器。
2. 增加筛选项：关键词、题型、难度、岗位、语言、标签。
3. 表单支持“评估标准文本”和“验收点列表”输入。
4. 列表支持预览、编辑、切换私有 / 企业共享。

**Validation:**
- Run: `pnpm --filter @vibe/web build`
- Manual: 面试官可创建私有题，可将题目标记为企业共享。

## Task 3: 新建独立的新建面试页

**Files:**
- Create: `apps/web/app/admin/interviews/new/page.tsx`
- Create: `apps/web/components/interview/interview-create-form.tsx`
- Modify: `apps/web/app/admin/interviews/page.tsx`
- Modify: `apps/web/app/admin/layout.tsx`

**Work:**
1. 把“创建面试”从列表弹窗迁移为独立页面。
2. 表单字段包含岗位名称、面试官、题目模板、时长、候选人姓名 / 邮箱 / 手机。
3. 候选人信息允许直接新建，不要求先去候选人页维护。
4. 新建成功后返回面试列表，并复制候选人链接。
5. 暂不实现草稿与批量导入。

**Validation:**
- Manual: 从面试列表点击“新建面试”进入独立页面。
- Manual: 单场创建成功后，列表出现新记录，链接可复制。

## Task 4: 创建面试时写入快照

**Files:**
- Modify: `apps/api/src/services/interview-service.ts`
- Modify: `apps/api/src/routes/admin/interviews.ts`
- Modify: `packages/shared-types/src/index.ts`

**Work:**
1. 创建面试时把候选人关键信息、题目标题、题目说明、评估标准文本、验收点列表写入 `Interview` 快照字段。
2. 面试创建只使用快照做后续展示和评估，不再依赖活模板内容。
3. 允许面试官被指定为当前登录人或同组织内其他面试官。

**Validation:**
- Manual: 修改原题目模板后，已创建面试展示内容不变。

## Task 5: 调整面试列表为新模型

**Files:**
- Modify: `apps/web/app/admin/interviews/page.tsx`
- Modify: `apps/api/src/routes/admin/interviews.ts`

**Work:**
1. 列表列信息改为候选人、岗位 / 题目模板、状态、AI 初评、人工结论、创建时间。
2. 操作列保留复制链接、查看详情入口占位。
3. 仅显示当前用户权限范围内的面试。

**Validation:**
- Run: `pnpm build`
- Expect: Phase 2 引入的新页面和改造后的列表均能编译通过。

## Acceptance Criteria

- 面试官可在题目库中选题并创建单场正式面试。
- 题目模板已支持文本评估说明和验收点列表。
- 题目可见范围和组织隔离生效。
- 面试记录已具备后续候选人链路和 AI 评估所需快照。


# Phase 5: 批量创建、单场草稿与 Excel 导出 Implementation Plan

> **For Codex:** 本阶段补运营效率，不改动前面已稳定的主流程语义。

**Goal:** 在单场闭环稳定后，补齐批量创建、单场创建草稿、创建并发送，以及基础字段 Excel 导出能力。

**Architecture:** 将“批量操作”和“草稿保存”放到任务编排层，避免污染正式面试状态机。导出能力优先做服务端生成的基础字段 Excel，不延伸到复杂报告模板。

**Tech Stack:** Next.js 14, Fastify, Prisma, ExcelJS or xlsx

---

## Dependencies

- Phase 4 已完成单场面试闭环、AI 初评和人工复核。

## Deliverables

- 新建面试页支持批量粘贴导入候选人。
- 单场创建表单支持草稿保存与恢复。
- 面试列表支持基础字段 Excel 导出。
- 题目库与复核页补充必要的运营型能力。

## Task 1: 增加单场创建草稿模型

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260315150000_phase5_single_draft/migration.sql`
- Modify: `packages/shared-types/src/index.ts`

**Work:**
1. 新增 `InterviewDraft` 模型，仅保存一份单场创建表单内容。
2. 草稿与创建人、组织绑定。
3. 字段覆盖岗位名称、面试官、题目模板、时长、候选人表单值。

**Validation:**
- Run: `cd packages/database && pnpm db:migrate`
- Expect: 可为同一用户保存和读取当前单场创建草稿。

## Task 2: 新建面试页支持草稿保存与批量粘贴导入

**Files:**
- Modify: `apps/web/app/admin/interviews/new/page.tsx`
- Modify: `apps/web/components/interview/interview-create-form.tsx`
- Create: `apps/web/components/interview/bulk-candidate-import.tsx`
- Create: `apps/api/src/routes/admin/interview-drafts.ts`

**Work:**
1. 表单增加“保存草稿”按钮。
2. 页面加载时恢复当前用户草稿。
3. 提供批量粘贴候选人输入框，按行解析姓名 / 邮箱 / 手机。
4. 提交时支持按当前题目模板为多位候选人批量创建面试。

**Validation:**
- Manual: 保存草稿后刷新页面仍可恢复。
- Manual: 粘贴多位候选人后可批量生成面试任务。

## Task 3: 创建并发送链接

**Files:**
- Modify: `apps/web/components/interview/interview-create-form.tsx`
- Modify: `apps/api/src/routes/admin/interviews.ts`

**Work:**
1. 在创建成功后返回候选人链接集合。
2. 前端提供“创建并复制全部链接”或“创建并导出链接文本”能力。
3. 暂不集成第三方邮件 / 短信发送。

**Validation:**
- Manual: 批量创建后能一键复制多个候选人链接。

## Task 4: 实现基础字段 Excel 导出

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/routes/admin/interviews.ts`
- Create: `apps/api/src/services/interview-export-service.ts`
- Modify: `apps/web/app/admin/interviews/page.tsx`

**Work:**
1. 引入 `exceljs` 或 `xlsx`。
2. 新增导出接口，按当前筛选条件导出 Excel。
3. 字段只做基础列：候选人姓名、邮箱、岗位 / 题目模板、面试官、状态、AI 分数、人工结论、创建时间、开始时间、提交时间。
4. 前端增加“导出结果”按钮。

**Validation:**
- Run: `pnpm --filter @vibe/api build`
- Manual: 导出的 Excel 可以正常打开并包含基础字段。

## Task 5: 补齐题库与复核页运营型能力

**Files:**
- Modify: `apps/web/app/admin/problems/page.tsx`
- Modify: `apps/web/app/admin/interviews/[id]/review/page.tsx`

**Work:**
1. 题目预览信息补齐到创建前可快速判断是否可用。
2. 复核页支持导出基础报告或复制复核摘要文本。
3. 私有 / 企业共享切换交互优化。

**Validation:**
- Run: `pnpm build`
- Expect: 批量创建、草稿和 Excel 导出都能稳定工作。

## Acceptance Criteria

- 单场创建草稿可保存与恢复。
- 可通过批量粘贴快速创建多场面试。
- 面试列表支持基础字段 Excel 导出。
- 不影响前四个 Phase 的主链路行为。


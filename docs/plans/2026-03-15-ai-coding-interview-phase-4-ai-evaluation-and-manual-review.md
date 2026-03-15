# Phase 4: AI 初评与人工复核闭环 Implementation Plan

> **For Codex:** 本阶段完成 MVP 业务闭环。不要先做推荐和高级分析。

**Goal:** 让面试结束后自动触发 AI 初评，保留 AI 历史版本，并提供完整复核页供面试官提交最终结论。

**Architecture:** 从当前把 AI 结果直接写回 `Interview` 的方式升级为“当前结果 + 历史运行记录”的结构。AI 评估服务抽象为按题型分发的入口；复核页从弹窗升级为独立页面，串联 AI 结果、聊天记录、事件流和人工结论。

**Tech Stack:** Fastify, Prisma, Next.js, OpenCode CLI

---

## Dependencies

- Phase 3 已具备提交、结束、事件流和完成态。

## Deliverables

- AI 初评自动触发并推动状态从 `ai_evaluating` 到 `pending_review`。
- AI 历史版本可追踪。
- 复核页可查看 AI 结果、聊天记录、事件摘要并提交最终结论。
- 面试列表显示 AI 分数和人工结论。

## Task 1: 建立 AI 初评历史版本模型

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260315140000_phase4_ai_runs/migration.sql`
- Modify: `packages/shared-types/src/index.ts`

**Work:**
1. 新增 `AiEvaluationRun` 模型，记录每一次评估的版本号、状态、分数、详情、原始输出、错误、触发人、开始时间、结束时间。
2. `Interview` 保留当前最新评估摘要字段，便于列表查询。
3. 明确“重跑 AI 初评”只新增版本，不覆盖历史记录。

**Validation:**
- Run: `cd packages/database && pnpm db:migrate`
- Expect: 可为同一场面试保存多条 AI 评估记录。

## Task 2: 抽象题型驱动的评估入口

**Files:**
- Modify: `apps/api/src/services/ai-evaluation-service.ts`
- Create: `apps/api/src/services/ai-evaluation/strategy-registry.ts`
- Create: `apps/api/src/services/ai-evaluation/strategies/base-strategy.ts`
- Create: `apps/api/src/services/ai-evaluation/strategies/code-implementation-strategy.ts`

**Work:**
1. 将当前评估逻辑封装为策略接口。
2. 第一版先实现代码实现题策略，其他题型先返回明确的未实现错误或兜底策略。
3. Prompt 必须使用面试快照中的题目内容、评估说明和验收点。
4. 每次运行写入 `AiEvaluationRun` 历史，并同步最新结果到 `Interview`。

**Validation:**
- Run: `pnpm --filter @vibe/api build`
- Manual: 触发重评后，数据库中新增一条评估版本记录。

## Task 3: 新增复核页与最终结论提交

**Files:**
- Create: `apps/web/app/admin/interviews/[id]/review/page.tsx`
- Create: `apps/web/components/review/review-decision-form.tsx`
- Create: `apps/web/components/review/ai-run-history-panel.tsx`
- Modify: `apps/api/src/routes/admin/interviews.ts`
- Create: `apps/api/src/routes/admin/reviews.ts`

**Work:**
1. 复核页展示最新 AI 初评分、维度说明、摘要、聊天记录摘要、事件时间线。
2. 页面可查看 AI 历史版本列表并切换查看详情。
3. 面试官可提交最终结论：通过 / 不通过 / 待定。
4. 最终结论写回 `Interview` 当前结论字段，并记录复核人、复核时间。

**Validation:**
- Manual: 面试官可在复核页保存结论，列表页同步显示。

## Task 4: 支持手动重跑 AI 初评

**Files:**
- Modify: `apps/api/src/routes/admin/interviews.ts`
- Modify: `apps/web/app/admin/interviews/[id]/review/page.tsx`
- Modify: `apps/web/app/admin/interviews/page.tsx`

**Work:**
1. 复核页提供“重新触发 AI 初评”按钮。
2. 触发后面试进入 `ai_evaluating`，完成后回到 `pending_review` 或保留 `completed` 但刷新最新 AI 结果；推荐前者仅在未完成复核前使用，已完成复核只刷新 AI 最新结果，不自动清空人工结论。
3. 列表页和详情页都能看到当前 AI 状态。

**Validation:**
- Manual: 已复核面试重跑 AI 后，历史记录增加，但人工最终结论仍保留。

## Task 5: 调整列表与详情入口

**Files:**
- Modify: `apps/web/app/admin/interviews/page.tsx`
- Modify: `apps/web/app/admin/interviews/[id]/page.tsx`

**Work:**
1. 列表页新增“进入复核”入口。
2. 已有聊天记录与评估弹窗可以保留为辅助调试，但主流程切换到详情页和复核页。
3. 列表展示 AI 分数、AI 状态和人工最终结论。

**Validation:**
- Run: `pnpm build`
- Expect: 从列表可进入复核页并完成闭环操作。

## Acceptance Criteria

- 面试结束后自动触发 AI 初评。
- 每次 AI 初评都有历史版本。
- 面试官可以提交最终结论。
- 面试从创建到最终结论形成完整闭环。


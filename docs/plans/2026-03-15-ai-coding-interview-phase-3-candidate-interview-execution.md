# Phase 3: 候选人作答与面试执行链路 Implementation Plan

> **For Codex:** 本阶段目标是跑通候选人主链路，不要提前做实时屏幕和回放。

**Goal:** 完成候选人启动页、作答页、提交闭环，以及面试详情页的执行监控基础能力，让一场面试可以被正常开始、进行、结束和查看。

**Architecture:** 复用当前 token 访问模式，但把候选人体验拆分为“启动确认”和“作答执行”两个阶段。API 侧补充提交、手动结束、事件记录和完成态返回逻辑；Web 侧补充详情页和候选人完成态。

**Tech Stack:** Next.js 14, Fastify, Prisma, OpenCode Manager

---

## Dependencies

- Phase 2 已支持正式面试创建和候选人链接生成。

## Deliverables

- 候选人启动页和作答页完整可用。
- 候选人可以结束并提交。
- 面试详情页可查看状态、剩余时间、异常信息和过程记录。
- 面试完成后候选人再次进入只显示完成态。

## Task 1: 引入面试事件流模型

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260315130000_phase3_interview_events/migration.sql`
- Modify: `packages/shared-types/src/index.ts`

**Work:**
1. 新增 `InterviewEvent` 模型。
2. 事件类型至少覆盖：`started`、`workspace_opened`、`heartbeat`、`submitted`、`timeout`、`interviewer_ended`、`system_error`、`ai_evaluation_started`、`ai_evaluation_finished`。
3. 为 `Interview` 增加 `submittedAt`，便于区分完成原因和导出结果。

**Validation:**
- Run: `cd packages/database && pnpm db:migrate`
- Expect: 新表与新字段迁移成功。

## Task 2: 补齐候选人公共 API

**Files:**
- Modify: `apps/api/src/routes/interview.ts`
- Modify: `apps/api/src/services/interview-service.ts`
- Modify: `apps/api/src/services/cleanup-service.ts`

**Work:**
1. 保留现有 `start` 接口。
2. 新增 `submit` 接口，提交后停止 OpenCode、写入 `submittedAt`、设置 `endReason=submitted`、切换到 `ai_evaluating`。
3. 新增 `end-by-interviewer` 接口，用于详情页人工结束。
4. 新增 `events` 读取接口，提供详情页与复核页使用。
5. 超时结束与崩溃结束也统一写入事件流。

**Validation:**
- Run: `pnpm --filter @vibe/api build`
- Manual: 调用提交接口后，面试状态从 `in_progress` 进入 `ai_evaluating`。

## Task 3: 重构候选人页面为启动页 + 作答页 + 完成态

**Files:**
- Modify: `apps/web/app/interview/[token]/page.tsx`
- Create: `apps/web/components/interview/candidate-launch-panel.tsx`
- Create: `apps/web/components/interview/candidate-workspace-panel.tsx`
- Create: `apps/web/components/interview/candidate-complete-panel.tsx`

**Work:**
1. `pending` 时展示启动确认页，含规则说明和开始按钮。
2. `in_progress` 时展示作答页，含项目背景、任务目标、验收点、计时器和打开 OpenCode 入口。
3. `ai_evaluating`、`pending_review`、`completed` 时统一展示完成态，不允许回到作答页。
4. 网络异常和自动保存先做轻量级 UI 提示，不做完整离线恢复。

**Validation:**
- Manual: 开始前看到规则页，开始后进入作答态，提交后只看到完成态。

## Task 4: 新增面试详情页

**Files:**
- Create: `apps/web/app/admin/interviews/[id]/page.tsx`
- Create: `apps/web/components/interview/interview-detail-header.tsx`
- Create: `apps/web/components/interview/interview-events-timeline.tsx`
- Modify: `apps/web/app/admin/interviews/page.tsx`

**Work:**
1. 列表页新增“查看详情”入口。
2. 详情页展示候选人信息、题目快照、状态、剩余时间、异常信息、过程记录。
3. 详情页提供复制面试链接和手动结束面试按钮。
4. 暂不做代码轨迹回放，只展示事件时间线。

**Validation:**
- Manual: 面试进行中能看到倒计时和事件流，手动结束后状态变化正确。

## Task 5: 校正清理任务与状态推进

**Files:**
- Modify: `apps/api/src/services/cleanup-service.ts`

**Work:**
1. 超时结束时不再直接跳 `completed`，而是进入 `ai_evaluating`。
2. 清理任务负责关停 OpenCode、写事件、更新 `endReason`。
3. 评估触发逻辑改为统一从“面试结束”入口走，避免多处重复触发。

**Validation:**
- Run: `pnpm build`
- Manual: 超时场景结束后候选人页面只显示完成态，后台状态为 `ai_evaluating`。

## Acceptance Criteria

- 候选人可开始面试、使用 OpenCode、提交并结束。
- 面试详情页可查看执行状态和事件时间线。
- 面试完成后候选人再次进入只显示完成态。
- 所有结束路径都能稳定推动后续 AI 初评。


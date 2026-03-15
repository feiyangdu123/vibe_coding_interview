# Phase 6: 智能推荐、监测与高级观测 Implementation Plan

> **For Codex:** 本阶段属于增强项，只在前面 5 个 Phase 稳定之后再进入。

**Goal:** 基于前面阶段已沉淀的结构化数据，增加题目智能推荐、实时监测、过程回放和高级分析能力，提升平台差异化。

**Architecture:** 这部分不再是简单 CRUD，而是建立在组织数据、题目标签、事件流、AI 评估历史和人工结论之上的增强层。建议以可插拔能力实现，避免污染 MVP 主流程。

**Tech Stack:** Next.js 14, Fastify, Prisma, optional queue/worker, OpenCode telemetry

---

## Dependencies

- Phase 1-5 全部完成并稳定运行。

## Deliverables

- 基于 JD / 简历的题目推荐。
- 实时屏幕、代码轨迹、操作日志的采集与展示。
- 过程回放与风险提示。
- 更细粒度的题目权限和高级分析报表。

## Task 1: 题目智能推荐

**Files:**
- Create: `apps/api/src/services/problem-recommendation-service.ts`
- Create: `apps/api/src/routes/admin/problem-recommendations.ts`
- Modify: `apps/web/app/admin/interviews/new/page.tsx`
- Create: `apps/web/components/interview/problem-recommendation-panel.tsx`

**Work:**
1. 输入 JD 文本或简历摘要，映射到岗位、技术栈、难度和题型标签。
2. 基于标签和历史题目表现返回推荐列表。
3. 支持一键采纳到新建面试页。

**Validation:**
- Manual: 输入 JD 后能返回同岗位和技术栈的推荐题目。

## Task 2: 实时监测与代码轨迹采集

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260315160000_phase6_telemetry/migration.sql`
- Create: `apps/api/src/services/interview-telemetry-service.ts`
- Create: `apps/api/src/routes/admin/interview-telemetry.ts`

**Work:**
1. 为 OpenCode 会话增加屏幕状态、代码变更摘要、关键操作日志采集。
2. 数据写入独立 telemetry 表，而不是塞进事件流文本字段。
3. 采集频率和存储体量要可配置，防止数据库膨胀。

**Validation:**
- Expect: 单场进行中的面试能看到基础实时状态和最近操作日志。

## Task 3: 过程回放与复核增强

**Files:**
- Modify: `apps/web/app/admin/interviews/[id]/page.tsx`
- Modify: `apps/web/app/admin/interviews/[id]/review/page.tsx`
- Create: `apps/web/components/interview/interview-playback-panel.tsx`

**Work:**
1. 基于事件流 + telemetry 还原候选人的作答过程。
2. 复核页展示风险提示，例如频繁回退、长时间无操作、异常退出。
3. 提供播放时间轴和关键片段跳转。

**Validation:**
- Manual: 面试官可在详情页和复核页查看过程回放摘要。

## Task 4: 高级权限和运营分析

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `apps/api/src/routes/admin/reports.ts`
- Create: `apps/api/src/services/reporting-service.ts`
- Create: `apps/web/app/admin/reports/page.tsx`

**Work:**
1. 将题目权限从“私有 / 企业共享”扩展到部门 / 指定人员。
2. 输出组织维度分析：题目使用频率、通过率、平均 AI 分数、待定率。
3. 为后续内容运营和招聘分析提供可视化报表。

**Validation:**
- Run: `pnpm build`
- Expect: 新增强能力不影响 Phase 1-5 主链路。

## Acceptance Criteria

- 推荐、监测、回放和分析都建立在前面稳定数据之上。
- 任一增强能力失败时，不影响候选人主链路和复核主链路。
- 组织隔离和权限控制继续生效。


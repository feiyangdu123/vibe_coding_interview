# AI 编程面试平台 Phase 开发任务索引

**已确认决策：**
- 登录方式：平台内置账号密码登录。
- 数据隔离：必须实现多企业隔离的 `Organization` 模型。
- 复核权限：面试官可以给最终结论。
- 草稿范围：只保存单场创建表单。
- AI 初评重跑：需要保留历史版本。
- 导出格式：只做基础字段的 Excel 导出。
- 候选人完成后：只展示完成态。
- 评估标准：先支持“文本说明 + 验收点列表”。

**执行顺序：**
1. [Phase 1](/Users/dufeiyang/project/vibe_coding_interview/docs/plans/2026-03-15-ai-coding-interview-phase-1-auth-org-foundation.md)
2. [Phase 2](/Users/dufeiyang/project/vibe_coding_interview/docs/plans/2026-03-15-ai-coding-interview-phase-2-template-and-single-interview-creation.md)
3. [Phase 3](/Users/dufeiyang/project/vibe_coding_interview/docs/plans/2026-03-15-ai-coding-interview-phase-3-candidate-interview-execution.md)
4. [Phase 4](/Users/dufeiyang/project/vibe_coding_interview/docs/plans/2026-03-15-ai-coding-interview-phase-4-ai-evaluation-and-manual-review.md)
5. [Phase 5](/Users/dufeiyang/project/vibe_coding_interview/docs/plans/2026-03-15-ai-coding-interview-phase-5-batch-draft-and-excel-export.md)
6. [Phase 6](/Users/dufeiyang/project/vibe_coding_interview/docs/plans/2026-03-15-ai-coding-interview-phase-6-recommendation-and-observability.md)

**执行约束：**
- 后续 Phase 只能依赖前一阶段已完成的数据库结构、接口和状态机。
- 每个 Phase 完成后都要先通过 `pnpm build` 级别校验，再进入下一阶段。
- 所有后台 API 都必须先完成登录校验和 `organizationId` 过滤，再补页面功能。
- 候选人链路保持无账号、token 访问，但必须被组织隔离后的面试数据约束。

**当前总规划总览：**
- [总规划文档](/Users/dufeiyang/project/vibe_coding_interview/docs/plans/2026-03-15-ai-coding-interview-phased-implementation-plan.md)


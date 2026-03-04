# 候选人在线 Vibe Coding 面试平台

基于你给的 PRD，这里先给出一版适合从 0 到 1 落地的实施基线，目标是优先完成 `MVP v0`，并提前为 `v1 回放` 和 `v2 自动评分` 预留结构。

当前调整：`MVP v0` 先不实现真正的 sandbox。改为在宿主机上为每个 session 创建一个本地临时目录作为 workspace，并启动一个绑定到该目录的 `opencode web` 进程供候选人使用。这样能最快跑通主流程，但安全隔离能力明显弱于容器方案，只适合开发环境或受控内测。

## 1. 任务拆解

## 1.1 里程碑划分

### Phase 0：工程基线（P0）

目标：把工程、部署、配置、数据模型先搭起来，避免后续功能堆在一起返工。

- 初始化 monorepo：统一前端、后端、worker、共享包。
- 建立环境配置：`DATABASE_URL`、`REDIS_URL`（可选）、`OPENCODE_*`、`WORKSPACE_ROOT`、本机并发限制参数。
- 建立基础数据库 schema：候选人、题目、场次、session、访问 token、审计日志。
- 建立本地开发环境：`docker compose` 起 PostgreSQL（和可选 Redis），`control-plane` 直接管理本地 workspace。
- 建立日志与追踪：结构化日志、request id、session id 贯穿链路。

### Phase 1：面试入口与候选人流（P0）

目标：完成“发链接即可开始”。

- 候选人访问入口：`/interview/:token`
- token 校验：一次性 / 可过期 / 可恢复访问
- Portal 页面：
  - 展示题目说明、规则、时长、开始按钮
  - 展示 session 当前状态：`CREATED / READY / RUNNING / SUBMITTED / EXPIRED / ARCHIVED`
- 开始逻辑：
  - 写入 `started_at`
  - 触发本地 workspace 创建或恢复
  - 将 session 状态推进到 `RUNNING`
- 结束逻辑：
  - 用户主动提交
  - 到期自动结束
  - 写入 `submitted_at` 或 `expired_at`

### Phase 2：本地 Workspace 生命周期（P0）

目标：每个候选人一个独立临时 workspace。

- 定义 `WorkspaceProvider` 抽象：
  - `prepareSessionWorkspace`
  - `startOpenCodeWebProcess`
  - `getSessionEndpoint`
  - `cleanupSessionWorkspace`
- v0 默认实现使用宿主机本地临时目录：
  - 在 `WORKSPACE_ROOT`（例如 `/tmp/interview-workspaces`）下为每个 session 创建独立目录
  - 按题目模板复制 repo 到该目录
  - 为该 session 生成 `OPENCODE_SERVER_PASSWORD`
  - 以该目录为 `cwd` 启动 `opencode web --hostname 127.0.0.1 --port <port>`
- 最小隔离策略：
  - 目录级隔离，不是安全级沙箱
  - 限制同机并发 session 数
  - 默认仅监听本机回环地址，由 `control-plane` 代理访问
- 回收策略：
  - 正常结束后延迟删除临时目录并停止子进程
  - 异常 session 定时扫描并清理残留目录 / 进程

### Phase 3：反向代理与会话接入（P0）

目标：Portal 可以安全地把候选人引导进 OpenCode Web。

- 提供代理路由：`/s/:sessionId/*`
- 根据 `sessionId` 查找对应本地 `opencode web` 进程地址
- 服务端注入 Basic Auth：
  - 用户不直接接触 `OPENCODE_SERVER_PASSWORD`
  - Portal 或 control plane 统一注入 `Authorization` Header
- 处理 SSE 透传：
  - 保持流式响应
  - 处理客户端断线
  - 统一超时和重试策略
- 新窗口打开编码环境：
  - 避免 iframe 的鉴权 / CSP / 第三方脚本复杂度

### Phase 4：计时与状态一致性（P0）

目标：计时以服务端为准，前端只展示。

- 使用服务端作为唯一时间源
- 倒计时接口返回：
  - `server_now`
  - `started_at`
  - `expires_at`
  - `status`
- 自动超时：
  - 通过延迟任务或扫描任务将 session 标记为 `EXPIRED`
  - 超时后禁止再次进入可写状态
- 前端每隔数秒刷新，或订阅轻量事件流

### Phase 5：面试官基础后台（P1）

目标：让面试官能创建题目、发链接、看到场次状态。

- 题目管理：
  - Repo URL / 模板 workspace
  - README 说明
  - 时长
  - 允许 / 禁止事项
- 场次管理：
  - 选择候选人
  - 绑定题目
  - 生成 interview token
- 场次列表：
  - session 状态
  - 倒计时状态
  - OpenCode 进程是否存活
  - workspace 是否已创建

### Phase 6：安全与运维基线（P1）

目标：v0 可用于受控测试，不至于一上人就失控。

- 管理员配置页或配置文件：
  - 模型网关地址
  - workspace TTL
  - 本机最大并发 session
- 限流：
  - token 验证接口
  - session 代理入口
- 审计日志：
  - 谁在什么时间开始 / 结束 / 超时
  - workspace 创建 / 清理结果
- 健康检查：
  - Portal API 健康
  - Redis / PostgreSQL 健康
  - workspace 清理任务健康

## 1.2 v1 预留任务（回放）

- 对 OpenCode 事件流做旁路采集
- 持久化：
  - session metadata
  - chat message
  - AI patch / diff
  - 命令执行记录
  - 测试运行结果
- 回放页：
  - 按时间轴查看消息
  - 代码 diff 回放
  - AI 干预次数统计

## 1.3 v2 预留任务（自动评分）

- 评分 worker：
  - 拉取候选人最终代码
  - 执行测试 / lint / 自定义脚本
- 评分维度：
  - 测试通过率
  - 用时
  - 提交前迭代次数
  - AI 使用强度
  - diff 规模和关键文件触达情况
- 输出评分报告：
  - 总分
  - 维度分
  - 风险提示

## 1.4 推荐实施顺序

如果按最短路径交付 `MVP v0`，建议按下面顺序做：

1. 工程基线 + 数据库 schema
2. 候选人入口页 + token 校验
3. session 状态机 + 服务端计时
4. 本地 temp workspace 创建 / 清理
5. `opencode web` 启动与健康检查
6. `/s/:sessionId/*` 反向代理 + Basic Auth 注入
7. 候选人开始 / 结束完整链路联调
8. 面试官创建题目 / 发链接
9. 超时清理 + 限流 + 审计日志

## 2. 推荐目录结构

建议使用 `pnpm workspace + Turborepo` 做 monorepo。原因很直接：Portal、control plane、worker、共享类型和数据库 schema 会同时存在，拆开管理比单仓单应用更稳。

```text
vide_coding_interview/
  apps/
    portal-web/                 # 候选人 + 面试官 + 管理员 Web 界面
    control-plane/              # API、session 编排、反向代理
    replay-web/                 # v1 回放页面（可后置创建）
  services/
    event-ingestor/             # v1 事件采集与落库
    grader-worker/              # v2 自动评分任务执行器
  packages/
    db/                         # Prisma schema、migration、DB client
    shared-types/               # DTO、领域模型、枚举
    config/                     # 环境变量校验、共享配置
    auth/                       # token 签发、session cookie、权限校验
    queue/                      # BullMQ 队列与任务定义
    ui/                         # Portal 共享组件（如需要）
    opencode-client/            # 对 OpenCode server/SDK 的封装
    workspace-core/             # WorkspaceProvider、进程生命周期、端口分配
  infra/
    docker/                     # 本地依赖（PostgreSQL/Redis）compose
    nginx/                      # 可选边缘层配置
    terraform/                  # 后续云资源编排（可延后）
  scripts/
    bootstrap.sh
    seed.ts
  docs/
    interview-platform-bootstrap-plan.md
```

## 2.1 apps 职责

### `apps/portal-web`

- 技术上只负责 UI 和页面交互
- 页面建议：
  - `/interview/[token]`
  - `/candidate/session/[sessionId]`
  - `/interviewer/problems`
  - `/interviewer/interviews`
  - `/admin/settings`

### `apps/control-plane`

- 对外唯一业务 API
- 负责：
  - token 校验
  - session 状态机
  - 候选人开始 / 提交
  - `/s/:sessionId/*` 代理到 OpenCode Web
  - 触发本地 workspace 创建、OpenCode 子进程启动和清理任务

### `apps/replay-web`

- `v1` 再上
- 与 `portal-web` 分开，避免 v0 把回放复杂度带进来

## 2.2 services 职责

### `services/event-ingestor`

- 专门做旁路采集，避免 v0 的主链路耦合太早
- 只消费事件，不阻塞候选人页面

### `services/grader-worker`

- 只做异步评分
- v2 可以直接对归档后的 workspace 副本执行测试

## 3. 技术选型

## 3.1 前端

- `Next.js 15 + React + TypeScript`
- 原因：
  - Portal 页面以表单、倒计时、状态展示为主，Next.js 足够
  - 面试官后台和候选人页面可共用一套路由与鉴权体系
  - 后续如需 SSR、服务端鉴权、管理后台都方便

UI 层建议：

- 样式：`Tailwind CSS`
- 表单：`react-hook-form + zod`
- 数据获取：`TanStack Query`

## 3.2 控制面 API

- `Fastify + TypeScript`
- 原因：
  - 比把重逻辑塞进 Next.js Route Handlers 更稳
  - 更适合做长连接、代理、流式透传、健康检查
  - 性能和插件生态足够支持 v0 的 SSE 代理与会话路由

关键插件建议：

- `@fastify/cors`
- `@fastify/cookie`
- `@fastify/http-proxy`（或基于 `undici` 自建流式代理）
- `@fastify/rate-limit`

## 3.3 数据层

- `PostgreSQL`
- `Prisma`

原因：

- session、题目、候选人、token 都是强关系模型，关系型数据库最合适
- `Prisma` 在团队协作和迁移管理上更省心
- v1 事件数据先放同一个库，用 `JSONB` 存 payload 即可，后续再拆冷热存储

建议核心表：

- `candidates`
- `problems`
- `interviews`
- `interview_tokens`
- `sessions`
- `session_audit_logs`
- `session_events`（v1）
- `grading_reports`（v2）

## 3.4 队列与异步任务

- `Redis + BullMQ`（可选）

原因：

- 适合做：
  - session 超时任务
  - workspace 延迟清理
  - 异常重试
  - v1 事件消费
  - v2 评分任务

如果要压缩 `v0` 范围，也可以先不接 Redis，先用数据库扫描任务 + 进程内定时器做最小实现；但到 `v1/v2` 最好再补上队列。

## 3.5 Workspace 实现

- `宿主机本地 temp 目录` 作为 `v0` 默认方案
- `Docker / Daytona` 作为后续升级方案

原因：

- v0 先追求最短路径，直接在本机创建临时目录和子进程，复杂度最低
- 题目是 repo-based，本地复制模板目录就能快速形成候选人 workspace
- 后续需要更强安全隔离时，再把 `WorkspaceProvider` 的实现替换为 Docker / Daytona 即可

建议：

- 使用 `fs.mkdtemp` 在 `WORKSPACE_ROOT` 下创建目录
- 每个 session 复制一份题目模板 repo
- 通过环境变量注入：
  - `OPENCODE_SERVER_PASSWORD`
  - `OPENCODE_SERVER_USERNAME`
  - 模型网关配置
- 通过子进程启动 `opencode web`，并把 `cwd` 指向该 session 目录

## 3.6 反向代理

- 边缘层：`Nginx` 或 `Caddy`
- 业务层代理：`control-plane` 内部处理 `/s/:sessionId/*`

原因：

- 边缘层负责 TLS、压缩、基础流量治理
- 业务层代理负责动态路由和 Basic Auth 注入
- 这样职责清楚，不把 session 级鉴权逻辑塞进纯静态网关配置

## 3.7 鉴权与安全

- 候选人入口：一次性或短期有效 `signed token`
- Portal 登录（面试官 / 管理员）：`NextAuth` 或自建 session cookie
- v0 本地 workspace 模式：
  - 仅绑定 `127.0.0.1`
  - 候选人只能通过 `control-plane` 代理进入
  - 适合开发环境或受控内测
  - 不适合直接作为公网多租户生产隔离方案

## 3.8 观测与测试

- 日志：`Pino`
- 错误监控：`Sentry`（可选）
- 单元测试：`Vitest`
- API 集成测试：`Supertest`
- E2E：`Playwright`

## 4. 关键架构决策

## 4.1 不建议把所有东西都塞进一个 Next.js 应用

原因：

- 你这里不只是一个 Web 表单系统，还包含：
  - 动态反向代理
  - SSE 透传
  - 本地 workspace 生命周期管理
  - 延迟清理与定时任务

这些都放在一个 Next.js 进程里，前期看起来快，后面很容易变成部署和排障负担。

## 4.2 v0 先不做 iframe 嵌入 OpenCode Web

原因：

- Basic Auth 注入、Cookie、CSP、跨域、流式连接都更复杂
- 新窗口模式更符合“发链接即可开始”的最短路径

## 4.3 从第一天就定义 `WorkspaceProvider` 接口

原因：

- 这是整个系统里最容易换实现的一层
- 如果一开始把本地 temp 目录和进程管理细节写死在业务代码里，后面切 Docker / Daytona 会很痛苦

## 4.4 要明确接受 v0 的安全边界

原因：

- 本地 temp 目录不是隔离环境，只是独立工作目录
- 如果候选人能执行任意命令，本质上仍在使用宿主机能力
- 所以这版更适合作为内部验证产品流程，而不是直接对陌生公网用户开放

## 5. 建议的首批交付物

如果你现在要开工，第一批我建议只落下面这些，保证能在最短时间跑通：

1. `portal-web`：候选人访问页、开始页、倒计时页
2. `control-plane`：token 校验、session 状态机、开始/结束接口、代理入口
3. `packages/workspace-core`：本地 temp workspace + OpenCode 子进程管理
4. `packages/db`：最小 schema（candidate/problem/interview/session/token）
5. `infra/docker`：本地依赖 compose

做到这一步，就已经能完成你定义的 `MVP v0` 主流程的开发版。

## 6. 下一步建议

在这个基线下，下一步最合理的是直接进入“工程脚手架初始化”，按下面顺序建仓：

1. 初始化 monorepo（`pnpm workspace + turbo`）
2. 创建 `portal-web`、`control-plane`、`packages/db`
3. 先把 session 状态机和候选人入口页跑通
4. 再接入本地 temp workspace 和 `opencode web`

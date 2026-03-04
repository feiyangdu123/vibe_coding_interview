# Vibe Coding Interview 功能文档

## 1. 项目定位

`Vibe Coding Interview` 是一个面向浏览器的在线编程面试平台，目前处于 `MVP v0` 阶段。当前版本的目标是优先跑通完整面试链路，而不是提供生产级隔离能力。

当前实现采用本机临时目录作为每场面试的工作区，并由 `control-plane` 负责创建工作区、启动 `opencode` Web 运行时（或本地 mock 运行时）、维护会话状态以及代理候选人访问编程环境。

## 2. 当前角色与流程

系统当前覆盖两类主要使用角色：

- 管理员/面试官：创建题目、创建候选人、安排面试、分发候选人链接、查看面试状态。
- 候选人：通过面试链接查看题目、开始面试、查看倒计时、打开编程环境。

当前主流程如下：

1. 管理员在后台创建题目与候选人。
2. 管理员选择候选人与题目生成一场面试，并拿到专属候选人链接。
3. 候选人访问 `/interview/[token]` 阅读题目，点击开始后启动会话。
4. 系统创建或恢复本地工作区，启动 `opencode` 或 mock 运行时，并将会话状态切换为 `RUNNING`。
5. 候选人进入 `/candidate/session/[sessionId]` 查看倒计时，并手动打开编程环境。
6. 会话结束后进入终态（提交、超时或归档），工作区和运行时被清理。

## 3. 已实现功能

### 3.1 管理后台

管理后台由 `apps/portal-web` 提供，当前已有以下页面入口：

- `/admin/problems`
- `/admin/candidates`
- `/admin/interviews/new`
- `/admin/interviews`

已实现能力：

- 题目管理
  - 新增题目
  - 编辑题目
  - 删除题目（软删除）
  - 配置题目标题、说明、时长、模板路径
- 候选人管理
  - 新增候选人
  - 编辑候选人
  - 删除候选人（软删除）
  - 配置姓名、邮箱、电话、应聘岗位
- 安排面试
  - 选择候选人与题目创建面试
  - 自动创建 `Interview`、`InterviewToken` 和 `Session`
  - 自动生成候选人访问链接
- 面试列表
  - 查看候选人、题目、会话状态
  - 查看创建时间、开始时间、截止时间
  - 快速跳转候选人题目页和面试状态页

### 3.2 候选人侧页面

候选人侧当前由两个页面组成：

- `/interview/[token]` 候选人题目页
- `/candidate/session/[sessionId]` 面试状态页

已实现能力：

- 基于 token 加载题目详情与候选人信息
- 面试开始前展示题目说明、面试时长和当前状态
- 点击“开始面试”后调用后端启动会话
- 面试状态页展示
  - 当前状态
  - 开始时间
  - 截止时间
  - 剩余倒计时
  - 候选人信息
- 候选人可从状态页手动打开编程环境
- 页面每 15 秒自动刷新一次服务端状态
- 倒计时归零后自动触发超时结束逻辑

### 3.3 Control Plane 后端

`apps/control-plane` 是当前唯一业务后端，核心职责包括：

- 提供健康检查接口：`GET /healthz`
- 提供管理后台接口
  - `GET/POST /api/admin/problems`
  - `PATCH/DELETE /api/admin/problems/:problemId`
  - `GET/POST /api/admin/candidates`
  - `PATCH/DELETE /api/admin/candidates/:candidateId`
  - `GET/POST /api/admin/interviews`
- 提供候选人会话接口
  - `GET /api/interviews/:token`
  - `GET /api/sessions/:sessionId`
  - `POST /api/sessions/:sessionId/start`
  - `POST /api/sessions/:sessionId/end`
- 为编程环境提供反向代理
  - `/s/:sessionId`
  - `/s/:sessionId/*`
  - 兼容基于 cookie 的根路径代理访问
- 对代理请求自动注入 Basic Auth
- 支持 WebSocket upgrade 转发
- 对普通 API 开启限流，并放行运行时代理路径

### 3.4 会话与工作区管理

`packages/workspace-core` 提供本地工作区生命周期能力：

- 为每个 `session` 创建独立临时目录
- 支持按题目模板路径复制初始化内容到工作区
- 按配置分配独立端口
- 启动 `opencode serve --hostname 127.0.0.1 --port <port>`
- 如果本机未安装 `opencode`，自动降级为 mock 页面
- 支持通过 `OPENCODE_BIN=mock` 强制使用 mock 模式
- 会话结束时终止子进程并删除工作目录
- 限制本机最大并发会话数

当前运行时模式：

- `opencode`：真实浏览器编程环境
- `mock`：本地占位页，仅用于联调候选人流程

### 3.5 数据模型与审计

当前 Prisma schema 已定义以下核心实体：

- `Candidate`
- `Problem`
- `Interview`
- `InterviewToken`
- `Session`
- `SessionAuditLog`

当前已具备的数据能力：

- 候选人与题目支持软删除
- 面试创建时自动生成一次性 token 和初始 session
- 会话开始时记录启动审计日志
- 会话恢复时记录恢复审计日志
- 会话结束时记录结束审计日志
- 删除候选人/题目后，为关联会话补充审计记录

## 4. 会话状态说明

当前系统定义了以下会话状态：

- `CREATED`：已创建，尚未开始
- `READY`：预留状态，当前版本未主动写入
- `RUNNING`：进行中，候选人可进入编程环境
- `SUBMITTED`：已提交，终态
- `EXPIRED`：已超时，终态
- `ARCHIVED`：已归档，终态

补充说明：

- 当前前端没有“提交答案”按钮，`SUBMITTED` 主要通过接口调用进入。
- `RUNNING` 状态下会根据服务端 `expiresAt` 计算剩余时间。
- 终态会阻止再次进入可写面试流程。

## 5. 当前版本边界

这套实现已经能跑通本地演示和受控联调，但仍有明显边界：

- 不是安全沙箱
  - 当前工作区直接位于宿主机目录
  - 仅适合开发环境或受控内测
- 管理后台没有鉴权
  - 当前所有管理接口默认可直接访问
- Redis 尚未接入业务链路
  - `docker compose` 会启动 Redis，但当前代码未实际使用
- `services/event-ingestor` 与 `services/grader-worker` 仍是预留目录
  - 分别面向后续“回放”和“自动评分”
- 数据库迁移脚本尚未封装为一键命令
  - 当前需要手动执行 Prisma 同步
- 前端暂未提供显式“提交面试”操作
  - 如需手动结束，需调用 session end API

## 6. 适用场景

当前版本更适合以下场景：

- 本地开发联调
- 演示候选人端到端流程
- 受控环境下的内部试运行

当前版本不建议直接用于对外开放的生产面试系统，原因主要是缺少真正的运行时隔离、权限控制和运维回收机制。

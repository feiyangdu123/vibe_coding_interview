# Vibe Coding Interview 使用文档

## 1. 适用范围

本文档面向当前仓库的本地开发与联调环境，覆盖：

- 环境准备
- 本地启动
- 管理员操作流程
- 候选人使用流程
- 常见问题排查

## 2. 环境要求

建议准备以下运行环境：

- Node.js 22 或更高版本
  - `control-plane` 会优先使用 Node 内置的 `process.loadEnvFile`
  - 如果使用更低版本，需要自行导出环境变量
- `pnpm` 10.x
- Docker / Docker Compose
- PostgreSQL 16（可通过仓库内 compose 启动）
- Redis 7（当前主要用于预留，仍建议按 compose 一起启动）
- `opencode`（可选）
  - 未安装时系统会自动回退到 mock 运行时

## 3. 关键目录

- `apps/portal-web`：前端页面，包含管理后台和候选人页面
- `apps/control-plane`：后端 API、会话编排、运行时代理
- `packages/db`：Prisma schema 与数据库客户端
- `packages/workspace-core`：本地工作区与运行时管理
- `infra/docker/docker-compose.yml`：本地 PostgreSQL/Redis
- `docs/feature-overview.md`：功能说明

## 4. 启动前配置

仓库根目录当前已经包含一份 `.env`，可以直接按需修改。常用配置项如下：

- `CONTROL_PLANE_HOST`
  - control-plane 监听地址，默认 `127.0.0.1`
- `CONTROL_PLANE_PORT`
  - control-plane 端口，默认 `4000`
- `NEXT_PUBLIC_CONTROL_PLANE_ORIGIN`
  - 前端访问后端的基础地址，默认 `http://127.0.0.1:4000`
- `WORKSPACE_ROOT`
  - 会话工作区根目录，默认 `/tmp/vibe-interview-workspaces`
- `WORKSPACE_BASE_PORT`
  - 编程环境起始端口，默认 `4100`
- `WORKSPACE_MAX_SESSIONS`
  - 最大并发会话数，默认 `5`
- `OPENCODE_BIN`
  - `opencode` 可执行文件名；设置为 `mock` 可强制使用 mock 运行时
- `OPENCODE_SERVER_USERNAME`
  - 运行时 Basic Auth 用户名
- `DEFAULT_TEMPLATE_PATH`
  - 默认模板路径；题目未单独配置模板时使用
- `DATABASE_URL`
  - PostgreSQL 连接串
- `REDIS_URL`
  - Redis 连接串（当前预留）

如果你本机没有安装 `opencode`，可以直接把 `OPENCODE_BIN=mock`，这样候选人点击“打开编程环境”时会看到占位页，仍然可以完整验证流程。

## 5. 本地初始化

### 5.1 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

也可以直接使用仓库自带脚本：

```bash
./scripts/bootstrap.sh
```

这个脚本当前会执行：

- `pnpm install`
- `pnpm db:generate`

### 5.2 启动本地基础设施

执行：

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

这会启动：

- PostgreSQL：`127.0.0.1:5432`
- Redis：`127.0.0.1:6379`

### 5.3 生成 Prisma Client 并同步数据库结构

当前仓库已经提供了 Prisma Client 生成命令：

```bash
pnpm db:generate
```

由于仓库还没有封装 migration / db push 脚本，首次启动前建议手动同步 schema：

```bash
pnpm --filter @vibe-interview/db exec prisma db push --schema prisma/schema.prisma
```

如果跳过这一步，`control-plane` 在读写候选人、题目或面试数据时会因为缺表而报错。

## 6. 启动项目

推荐分别在两个终端启动：

终端 1：

```bash
pnpm dev:control-plane
```

终端 2：

```bash
pnpm dev:portal
```

启动后默认访问地址：

- 前端首页：`http://127.0.0.1:3000`
- 管理后台：
  - `http://127.0.0.1:3000/admin/problems`
  - `http://127.0.0.1:3000/admin/candidates`
  - `http://127.0.0.1:3000/admin/interviews/new`
  - `http://127.0.0.1:3000/admin/interviews`
- 后端健康检查：`http://127.0.0.1:4000/healthz`

## 7. 管理员使用流程

### 7.1 创建题目

访问 `/admin/problems`，填写以下信息：

- 题目标题
- 面试时长（分钟）
- 模板目录路径（可选）
- 题目说明

说明：

- 模板路径可以是本机可读目录，也可以是单个文件路径。
- 候选人开始面试时，系统会将模板内容复制到本场面试独立工作区。
- 如果题目未配置模板路径，会回退到 `DEFAULT_TEMPLATE_PATH`。

### 7.2 创建候选人

访问 `/admin/candidates`，填写：

- 姓名
- 邮箱
- 电话（可选）
- 应聘岗位（可选）

候选人邮箱在数据库中唯一，重复创建会失败。

### 7.3 安排面试

访问 `/admin/interviews/new`：

1. 选择候选人
2. 选择题目
3. 点击“生成候选人链接”

创建成功后，页面会显示：

- 候选人链接
- 打开候选人题目页入口
- 复制链接按钮

系统会同时生成：

- 一条 `Interview`
- 一条唯一的 `InterviewToken`
- 一条初始状态为 `CREATED` 的 `Session`

### 7.4 查看面试列表

访问 `/admin/interviews` 可以查看：

- 候选人信息
- 题目信息
- 当前状态
- 创建时间、开始时间、截止时间
- 候选人题目页入口
- 面试状态页入口

## 8. 候选人使用流程

### 8.1 进入题目页

候选人通过管理员发出的链接访问：

```text
/interview/<token>
```

页面会展示：

- 题目名称
- 题目说明
- 面试时长
- 候选人信息
- 当前会话状态

### 8.2 开始面试

候选人点击“我已阅读题目，开始面试”后，系统会：

1. 校验 token 是否存在和是否过期
2. 启动或恢复会话
3. 创建工作区
4. 启动 `opencode` 或 mock 运行时
5. 将会话切换为 `RUNNING`
6. 记录 token 使用时间
7. 跳转到 `/candidate/session/<sessionId>`

### 8.3 使用面试状态页

面试状态页会展示：

- 当前状态
- 剩余时间
- 开始时间
- 截止时间
- 候选人信息

候选人可执行的操作：

- `打开编程环境`
  - 新开窗口打开 `control-plane` 的代理地址
- `刷新状态`
  - 立即从服务端获取最新状态

补充说明：

- 页面会每 15 秒自动刷新一次状态。
- 倒计时以服务端时间为准，前端只是展示。
- 如果剩余时间到 0，页面会自动触发超时结束逻辑。

## 9. 手动结束会话

当前前端还没有提供“提交面试”按钮。如果需要手动结束会话，可以直接调用接口：

```bash
curl -X POST "http://127.0.0.1:4000/api/sessions/<sessionId>/end" \
  -H "content-type: application/json" \
  -d '{"reason":"submitted"}'
```

可选 `reason`：

- `submitted`
- `expired`
- `archived`

对应终态分别为：

- `SUBMITTED`
- `EXPIRED`
- `ARCHIVED`

## 10. 常见问题

### 10.1 前端提示无法连接 control-plane

排查顺序：

1. 确认 `pnpm dev:control-plane` 正在运行
2. 访问 `http://127.0.0.1:4000/healthz` 检查是否返回健康状态
3. 确认 `.env` 中 `NEXT_PUBLIC_CONTROL_PLANE_ORIGIN` 与后端实际地址一致

### 10.2 创建数据时报数据库错误

通常是以下原因之一：

- PostgreSQL 未启动
- `DATABASE_URL` 不正确
- 未执行 `prisma db push`

建议重新执行：

```bash
docker compose -f infra/docker/docker-compose.yml up -d
pnpm db:generate
pnpm --filter @vibe-interview/db exec prisma db push --schema prisma/schema.prisma
```

### 10.3 打开编程环境后看到占位页

这是预期行为之一，说明当前运行在 mock 模式。常见原因：

- 本机未安装 `opencode`
- `.env` 中将 `OPENCODE_BIN` 设置成了 `mock`

如果你只是验证流程，可以继续使用 mock 模式；如果要接入真实编程环境，需要安装可执行的 `opencode` 命令。

### 10.4 提示最大并发会话数已满

说明当前活跃会话数量已达到 `WORKSPACE_MAX_SESSIONS`。处理方式：

- 手动结束部分会话
- 调大 `.env` 中的 `WORKSPACE_MAX_SESSIONS`
- 重启后端前先确认是否需要保留当前正在进行的会话

### 10.5 启动面试时报模板路径错误

说明题目模板路径或默认模板路径不可读。请确认：

- 路径存在
- 当前启动用户有读取权限
- 填写的是本机文件系统路径，而不是浏览器可访问 URL

## 11. 当前使用限制

在实际使用中需要注意：

- 当前管理后台没有登录鉴权，不要直接暴露到公网
- 当前工作区不是容器沙箱，不适合不受控的多租户环境
- Redis、事件回放、自动评分仍未接入主流程
- 会话结束后的交互仍以 API 为主，前端流程还会继续补齐

# Vibe Coding Interview Platform

在线编程面试平台，为每个候选人提供隔离的 OpenCode 编程环境。

## 技术栈

- 前端: Next.js 14 + Tailwind CSS
- 后端: Node.js + Fastify
- 数据库: PostgreSQL + Prisma ORM
- 包管理: pnpm + monorepo (turborepo)
- 编程环境: OpenCode Web UI

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接
```

### 3. 启动 PostgreSQL

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=admin123 -e POSTGRES_DB=vibe_interview postgres
```

### 4. 数据库迁移

```bash
cd packages/database
pnpm prisma migrate dev
```

### 5. 启动开发服务器

```bash
pnpm dev
```

- Web 前端: http://localhost:3000
- API 后端: http://localhost:3001
- 管理后台: http://localhost:3000/admin

## 公网演示部署

适合 5 个候选人并发演示的默认部署形态：

- `demo.example.com` -> Next.js Web (`127.0.0.1:3000`)
- `demo.example.com/api/*` -> Fastify API (`127.0.0.1:3001`)
- `oc1.example.com` 到 `oc5.example.com` -> 5 个固定 OpenCode 槽位 (`127.0.0.1:4100` 到 `127.0.0.1:4104`)

核心环境变量：

```bash
WEB_PUBLIC_URL=https://demo.example.com
INTERNAL_API_BASE_URL=http://127.0.0.1:3001
OPENCODE_BIND_HOST=127.0.0.1
OPENCODE_SLOTS=oc1.example.com:4100,oc2.example.com:4101,oc3.example.com:4102,oc4.example.com:4103,oc5.example.com:4104
```

Nginx 反向代理示例见 `deploy/nginx.conf.example`。

## 项目结构

```
vibe-coding-interview/
├── apps/
│   ├── web/              # Next.js 前端应用
│   └── api/              # Fastify 后端服务
├── packages/
│   ├── database/         # Prisma schema
│   ├── shared-types/     # 共享类型定义
│   └── opencode-manager/ # OpenCode 实例管理器
└── pnpm-workspace.yaml
```

## 核心功能

- 题目管理：创建、编辑、删除编程题目
- 候选人管理：管理候选人信息
- 面试管理：创建面试、生成访问链接
- 环境隔离：每个面试使用独立的 OpenCode 实例和端口
- 自动清理：面试结束后自动停止 OpenCode 进程

## 开发说明

### 添加新的 API 路由

在 `apps/api/src/routes/` 目录下创建新的路由文件。

### 添加新的前端页面

在 `apps/web/app/` 目录下创建新的页面组件。

### 数据库变更

```bash
cd packages/database
pnpm prisma migrate dev --name your_migration_name
```

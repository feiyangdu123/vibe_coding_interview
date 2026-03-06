# 开发指南

## 当前进度

已完成基础架构搭建，包括：

### ✅ Phase 1: 基础设施
- Monorepo 结构 (pnpm + turborepo)
- 数据库设计 (Prisma + PostgreSQL)
- 项目配置文件

### ✅ Phase 2: OpenCode 管理器
- 端口管理 (4100-4200)
- 实例启动/停止
- 进程生命周期管理

### ✅ Phase 3: 后端 API
- Fastify 服务器
- 管理后台 API (题目、候选人、面试)
- 候选人面试 API
- 自动清理任务

### ✅ Phase 4: 前端基础
- Next.js 14 + Tailwind CSS
- 管理后台布局 (可折叠侧边栏)
- 题目管理页面
- 候选人管理页面
- 面试管理页面

### ✅ Phase 5: 候选人面试页面
- 面试详情展示
- 倒计时功能
- OpenCode 启动按钮

## 下一步工作

### 1. 启动数据库

```bash
# 使用 Docker 启动 PostgreSQL
docker run -d \
  --name vibe-postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=vibe_interview \
  postgres:16
```

### 2. 运行数据库迁移

```bash
cd packages/database
pnpm prisma migrate dev --name init
```

### 3. 启动开发服务器

```bash
# 在项目根目录
pnpm dev
```

这将同时启动:
- API 服务器: http://localhost:3001
- Web 前端: http://localhost:3000

### 4. 添加测试数据

可以使用 Prisma Studio 添加测试数据:

```bash
cd packages/database
pnpm prisma studio
```

或者创建一个 seed 脚本。

## 待完善功能

### 高优先级
1. 表单功能 - 创建/编辑题目、候选人、面试
2. 删除确认对话框
3. 错误处理和提示
4. 工作目录模板管理

### 中优先级
1. 搜索和筛选功能
2. 分页
3. 表单验证
4. 更多 UI 组件 (Dialog, Alert, Input 等)

### 低优先级
1. 用户认证
2. 权限管理
3. 日志记录
4. 性能优化

## 技术说明

### OpenCode 集成

确保系统已安装 OpenCode:

```bash
# 检查 OpenCode 是否可用
which opencode

# 测试启动
opencode serve --port 4100
```

### 环境变量

项目根目录的 `.env` 文件:

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/vibe_interview"
API_PORT=3001
WEB_PORT=3000
OPENCODE_PORT_MIN=4100
OPENCODE_PORT_MAX=4200
```

### 项目结构

```
vibe-coding-interview/
├── apps/
│   ├── api/                    # Fastify 后端
│   │   └── src/
│   │       ├── routes/         # API 路由
│   │       ├── services/       # 业务逻辑
│   │       └── server.ts       # 入口文件
│   └── web/                    # Next.js 前端
│       ├── app/                # App Router
│       │   ├── admin/          # 管理后台
│       │   └── interview/      # 候选人面试
│       └── components/         # React 组件
├── packages/
│   ├── database/               # Prisma
│   ├── opencode-manager/       # OpenCode 管理
│   └── shared-types/           # 类型定义
└── pnpm-workspace.yaml
```

## 常见问题

### 端口被占用

如果端口 3000 或 3001 被占用:

```bash
# 修改 .env 文件中的端口
API_PORT=3002
WEB_PORT=3001
```

### 数据库连接失败

检查 PostgreSQL 是否运行:

```bash
docker ps | grep postgres
```

### OpenCode 启动失败

检查 OpenCode 是否正确安装，并且端口范围 4100-4200 可用。

## 开发建议

1. 使用 Prisma Studio 查看数据库: `pnpm prisma studio`
2. 查看 API 日志了解请求详情
3. 使用浏览器开发工具调试前端
4. 定期提交代码到 Git

# 聊天记录查看功能实现总结

## 实现内容

成功为管理后台的面试管理页面添加了"查看聊天记录"功能，允许管理员查看候选人在面试过程中与 AI 助手的对话内容。

## 技术实现

### 后端 (API)

1. **依赖添加** (`apps/api/package.json`)
   - 添加 `sqlite` 和 `sqlite3` 包用于读取 OpenCode 的 SQLite 数据库
   - 使用异步 API 避免阻塞

2. **聊天历史服务** (`apps/api/src/services/chat-history-service.ts`)
   - 从 Interview 记录获取 `dataDir` 字段
   - 构造 OpenCode 数据库路径：`{dataDir}/opencode/opencode.db`
   - 查询 `session`、`message` 和 `part` 表
   - 将 OpenCode 的复杂消息格式转换为简化的聊天记录格式
   - 支持的消息部分类型：
     - `text`: 文本内容
     - `reasoning`: 推理过程（可折叠）
     - `tool`: 工具调用（显示状态）
     - `file`: 文件附件
   - 完善的错误处理：
     - 面试不存在
     - 数据库文件不存在
     - 数据库读取失败

3. **API 端点** (`apps/api/src/routes/admin/interviews.ts`)
   - 新增路由：`GET /api/admin/interviews/:id/chat-history`
   - 返回格式：
     ```json
     {
       "messages": [...],
       "sessionInfo": { "title": "...", "directory": "..." },
       "error": "..." // 可选
     }
     ```

### 前端 (Web)

1. **聊天消息组件** (`apps/web/components/chat-message.tsx`)
   - 渲染单条消息及其所有部分
   - 用户消息和助手消息使用不同样式
   - 支持的部分类型：
     - 文本：普通文本显示
     - 推理：可折叠区域，默认收起
     - 工具：显示工具名称和状态徽章（completed/error/running）
     - 文件：显示文件图标和名称

2. **聊天历史对话框** (`apps/web/components/chat-history-dialog.tsx`)
   - 模态对话框展示完整聊天历史
   - 状态处理：
     - 加载中：显示加载动画
     - 错误：显示错误信息
     - 空状态：显示"暂无聊天记录"
     - 正常：滚动列表显示消息
   - 响应式设计，最大宽度 4xl，最大高度 80vh

3. **面试管理页面更新** (`apps/web/app/admin/interviews/page.tsx`)
   - 在操作列添加"查看聊天"按钮
   - 按钮位于"复制链接"和"删除"之间
   - `pending` 状态时按钮禁用（面试未开始）
   - 点击按钮打开聊天历史对话框

## 数据流

1. 用户点击"查看聊天"按钮
2. 前端发送请求到 `/api/admin/interviews/:id/chat-history`
3. 后端从数据库获取 Interview 记录的 `dataDir`
4. 后端打开 OpenCode SQLite 数据库（只读模式）
5. 后端查询并转换消息数据
6. 前端在对话框中渲染聊天记录

## 关键设计决策

1. **使用 sqlite + sqlite3 而非 better-sqlite3**
   - better-sqlite3 需要原生编译，在某些环境下可能失败
   - sqlite + sqlite3 更稳定，安装成功率更高
   - 异步 API 不会阻塞事件循环

2. **简化消息格式**
   - OpenCode 的完整消息格式非常复杂
   - 管理后台只需只读查看，不需要实时更新
   - 简化后的格式更易于渲染和维护

3. **使用对话框而非独立页面**
   - 保持上下文，无需离开面试列表
   - 快速访问，打开/关闭更便捷
   - 符合现有 UI 模式

4. **按需加载数据**
   - 只在打开对话框时获取数据
   - 避免为所有面试预加载聊天记录
   - 提高性能和可扩展性

## 测试建议

1. **pending 状态面试**：按钮应该禁用
2. **in_progress 状态面试**：点击按钮应显示实时聊天记录
3. **completed 状态面试**：点击按钮应显示完整聊天记录
4. **数据库不存在**：应显示友好的错误提示
5. **空聊天记录**：应显示空状态 UI
6. **包含工具调用的消息**：应正确显示工具名称和状态
7. **包含推理的消息**：应可折叠/展开

## 文件清单

### 新建文件
- `apps/api/src/services/chat-history-service.ts` - SQLite 查询和数据转换
- `apps/web/components/chat-message.tsx` - 消息渲染组件
- `apps/web/components/chat-history-dialog.tsx` - 对话框组件

### 修改文件
- `apps/api/package.json` - 添加 sqlite 依赖
- `apps/api/src/routes/admin/interviews.ts` - 添加聊天历史 API 端点
- `apps/web/app/admin/interviews/page.tsx` - 添加"查看聊天"按钮和对话框

## 后续优化建议

1. **分页加载**：如果聊天记录很长，可以考虑分页加载
2. **搜索功能**：在聊天记录中搜索关键词
3. **导出功能**：导出聊天记录为 PDF 或文本文件
4. **实时更新**：对于进行中的面试，可以考虑实时更新聊天记录
5. **代码高亮**：对于代码片段，可以添加语法高亮

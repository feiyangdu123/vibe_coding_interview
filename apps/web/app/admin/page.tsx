export default function AdminPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">管理后台</h1>
      <p className="text-gray-600">欢迎使用 Vibe Coding Interview 管理系统</p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        <a href="/admin/problems" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">📝</div>
          <h3 className="font-semibold">题目管理</h3>
          <p className="text-sm text-gray-600 mt-1">管理编程题目</p>
        </a>
        <a href="/admin/candidates" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">👤</div>
          <h3 className="font-semibold">候选人</h3>
          <p className="text-sm text-gray-600 mt-1">管理候选人信息</p>
        </a>
        <a href="/admin/interviews" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">📋</div>
          <h3 className="font-semibold">面试管理</h3>
          <p className="text-sm text-gray-600 mt-1">创建和管理面试</p>
        </a>
        <a href="/admin/processes" className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-2xl mb-2">⚙️</div>
          <h3 className="font-semibold">进程管理</h3>
          <p className="text-sm text-gray-600 mt-1">监控 OpenCode 进程</p>
        </a>
      </div>
    </div>
  )
}

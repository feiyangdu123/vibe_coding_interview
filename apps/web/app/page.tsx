export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Vibe Coding Interview</h1>
        <p className="text-gray-600 mb-8">在线编程面试平台</p>
        <div className="space-x-4">
          <a href="/admin" className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90">
            管理后台
          </a>
        </div>
      </div>
    </div>
  )
}

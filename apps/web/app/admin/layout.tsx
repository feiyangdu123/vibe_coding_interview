'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen">
      <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-gray-900 text-white transition-all duration-300`}>
        <div className="p-4 flex items-center justify-between">
          {!collapsed && <h1 className="text-xl font-bold">Vibe Interview</h1>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 hover:bg-gray-800 rounded"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="mt-8">
          <Link
            href="/admin/problems"
            className="block px-4 py-3 hover:bg-gray-800 transition-colors"
          >
            {collapsed ? '📝' : '📝 题目管理'}
          </Link>
          <Link
            href="/admin/candidates"
            className="block px-4 py-3 hover:bg-gray-800 transition-colors"
          >
            {collapsed ? '👤' : '👤 候选人'}
          </Link>
          <Link
            href="/admin/interviews"
            className="block px-4 py-3 hover:bg-gray-800 transition-colors"
          >
            {collapsed ? '📋' : '📋 面试管理'}
          </Link>
          <Link
            href="/admin/processes"
            className="block px-4 py-3 hover:bg-gray-800 transition-colors"
          >
            {collapsed ? '⚙️' : '⚙️ 进程管理'}
          </Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6 bg-gray-50">
        {children}
      </main>
    </div>
  )
}

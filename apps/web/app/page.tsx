'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => {
        if (res.ok) {
          router.push('/admin')
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="rounded-xl border border-border bg-white px-8 py-7 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex justify-center">
          <Badge variant="outline">Console Bootstrap</Badge>
        </div>
        <div className="text-base font-semibold text-slate-950">正在进入控制台</div>
        <p className="mt-2 text-sm text-slate-500">检查登录态并路由到对应页面...</p>
      </div>
    </div>
  )
}

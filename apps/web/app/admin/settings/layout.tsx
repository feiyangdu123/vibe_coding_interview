'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { KeyRound, Users } from 'lucide-react'

const settingsTabs = [
  {
    href: '/admin/settings/members',
    label: '成员管理',
    icon: Users
  },
  {
    href: '/admin/settings/api-keys',
    label: 'API 配置',
    icon: KeyRound
  }
]

export default function SettingsLayout({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="console-page">
      {/* Page header */}
      <div className="pb-5">
        <div className="text-[11px] font-medium text-slate-400">
          企业设置
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-slate-950">
          企业设置
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          管理企业成员、角色与组织级 API 配置
        </p>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 flex gap-1 border-b border-border">
        {settingsTabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}

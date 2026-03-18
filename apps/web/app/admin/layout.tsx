'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftClose,
  ShieldCheck
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  findActiveAdminTrail,
  getAdminNavigation,
  isAdminNavItemActive
} from '@/components/admin/navigation'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'

interface SessionUser {
  username: string
  organizationName?: string
  organizationSlug?: string
  role: 'ORG_ADMIN' | 'INTERVIEWER'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const navigation = useMemo(() => getAdminNavigation(user?.role), [user?.role])
  const activeTrail = findActiveAdminTrail(navigation, pathname)
  const activeLabel = activeTrail[activeTrail.length - 1]?.label ?? '控制台'

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-2 text-center">
          <div className="text-sm font-medium text-slate-900">正在初始化控制台</div>
          <div className="text-sm text-slate-500">加载用户信息与组织权限...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/18 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="关闭导航"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-white transition-transform duration-200 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed && 'lg:w-20 lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/admin" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">Vibe Interview</div>
                <div className="text-xs text-slate-500">Enterprise Console</div>
              </div>
            )}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? '展开导航' : '收起导航'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {!collapsed && user ? (
          <div className="border-b border-border px-4 py-4">
            <div className="rounded-xl border border-border bg-slate-50/70 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-950">{user.username}</div>
                  <div className="truncate text-sm text-slate-500">{user.organizationName || '未命名组织'}</div>
                  {user.organizationSlug ? (
                    <div className="truncate text-xs text-slate-400">{user.organizationSlug}</div>
                  ) : null}
                  <div className="mt-2">
                    <Badge variant={user.role === 'ORG_ADMIN' ? 'info' : 'secondary'}>
                      {user.role === 'ORG_ADMIN' ? '组织管理员' : '面试官'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            导航目录
          </div>
          <div className="space-y-1.5">
            {navigation.map((item) => {
              const active = isAdminNavItemActive(item, pathname)
              const Icon = item.icon
              const showChildren = !!item.children && !collapsed && active

              return (
                <div key={item.href}>
                  <Link
                    href={item.children?.[0]?.href && pathname.startsWith(item.href) ? item.children[0].href : item.href}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                      active
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-transparent text-slate-600 hover:border-border hover:bg-slate-50 hover:text-slate-900',
                      collapsed && 'justify-center px-0'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{item.label}</div>
                          {item.description ? (
                            <div className="truncate text-xs text-slate-400 group-hover:text-slate-500">
                              {item.description}
                            </div>
                          ) : null}
                        </div>
                        {item.children ? (
                          <ChevronRight
                            className={cn(
                              'h-4 w-4 shrink-0 transition-transform',
                              active && 'rotate-90'
                            )}
                          />
                        ) : null}
                      </>
                    )}
                  </Link>

                  {showChildren ? (
                    <div className="mt-1 space-y-1 pl-10">
                      {item.children?.map((child) => {
                        const childActive = isAdminNavItemActive(child, pathname)
                        const ChildIcon = child.icon

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                              childActive
                                ? 'bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            )}
                          >
                            <ChildIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <Button
            type="button"
            variant="outline"
            className={cn('w-full justify-start', collapsed && 'justify-center px-0')}
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed ? <span>退出登录</span> : null}
          </Button>
        </div>
      </aside>

      <div className={cn('flex min-h-screen flex-col lg:pl-72', collapsed && 'lg:pl-20')}>
        <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="打开导航"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="hidden lg:flex">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={collapsed ? '展开导航' : '收起导航'}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {activeTrail.map((item, index) => (
                  <div key={`${item.href}-${index}`} className="flex items-center gap-2">
                    {index > 0 ? <span>/</span> : null}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="truncate text-sm font-semibold text-slate-950">{activeLabel}</div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <Badge variant="outline" className="hidden sm:inline-flex">
                控制台
              </Badge>
              <div className="hidden items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-slate-600 md:flex">
                <Building2 className="h-4 w-4" />
                <span className="max-w-[180px] truncate">{user?.organizationName || '未命名组织'}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

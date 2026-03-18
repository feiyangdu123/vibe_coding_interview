'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import {
  Building2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  User
} from 'lucide-react'

interface SessionUser {
  id: string
  username: string
  email?: string
  role: 'ORG_ADMIN' | 'INTERVIEWER'
  organizationId: string
  organizationName?: string
  organizationSlug?: string
}

interface OrganizationMember {
  id: string
  username: string
  email?: string
  role: 'ORG_ADMIN' | 'INTERVIEWER'
  createdAt?: string
}

export default function OrganizationMembersSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'INTERVIEWER' as 'ORG_ADMIN' | 'INTERVIEWER'
  })

  const loadData = async () => {
    try {
      const me = await apiFetch('/api/auth/me')
      setUser(me.user)

      if (me.user?.role === 'ORG_ADMIN') {
        const membersRes = await apiFetch('/api/admin/users?limit=1000')
        setMembers(membersRes.data || [])
      }
    } catch (error) {
      console.error(error)
      toast.error('加载企业成员失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          username: form.username,
          email: form.email || undefined,
          password: form.password,
          role: form.role
        })
      })

      toast.success('成员创建成功')
      setForm({
        username: '',
        email: '',
        password: '',
        role: 'INTERVIEWER'
      })
      await loadData()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || '成员创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredMembers = members.filter((m) => {
    const matchSearch =
      !searchQuery ||
      m.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchRole = roleFilter === 'all' || m.role === roleFilter
    return matchSearch && matchRole
  })

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-400">加载中...</div>
      </div>
    )
  }

  if (!user) {
    return <div className="text-sm text-slate-400">未获取到当前用户信息</div>
  }

  if (user.role !== 'ORG_ADMIN') {
    return (
      <div className="rounded-xl border border-border bg-white p-8 text-center">
        <p className="text-sm text-slate-500">只有企业管理员可以查看和管理成员。</p>
      </div>
    )
  }

  const adminCount = members.filter((m) => m.role === 'ORG_ADMIN').length
  const interviewerCount = members.filter((m) => m.role === 'INTERVIEWER').length

  return (
    <div className="space-y-5">
      {/* Organization summary bar */}
      <div className="flex items-center gap-6 rounded-lg border border-border bg-white px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
            <Building2 className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">企业名称</div>
            <div className="text-sm font-medium text-slate-900">{user.organizationName || '-'}</div>
          </div>
        </div>

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
            <Tag className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">企业标识</div>
            <div className="text-sm font-medium text-slate-900 font-mono">{user.organizationSlug || '-'}</div>
          </div>
        </div>

        <div className="h-8 w-px bg-border" />

        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">当前管理员</div>
            <div className="text-sm font-medium text-slate-900">{user.username}</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
          <span>{adminCount} 位管理员</span>
          <span>{interviewerCount} 位面试官</span>
          <span>共 {members.length} 人</span>
        </div>
      </div>

      {/* Two-column main content */}
      <div className="grid gap-5 xl:grid-cols-[1fr,340px]">
        {/* Left: Member list */}
        <div className="rounded-xl border border-border bg-white">
          {/* List header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">成员列表</h2>
              <p className="text-xs text-slate-400 mt-0.5">{filteredMembers.length} 位成员</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => loadData()}
              className="h-8 w-8"
              title="刷新"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="搜索用户名或邮箱..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-9 text-xs"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="角色筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                <SelectItem value="ORG_ADMIN">企业管理员</SelectItem>
                <SelectItem value="INTERVIEWER">面试官</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">用户名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="w-12 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="text-sm text-slate-400">
                      {searchQuery || roleFilter !== 'all' ? '没有匹配的成员' : '暂无成员'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{member.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-500">{member.email || '-'}</span>
                    </TableCell>
                    <TableCell>
                      {member.role === 'ORG_ADMIN' ? (
                        <Badge variant="info" className="rounded-md text-[10px] px-1.5 py-0">
                          管理员
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-md text-[10px] px-1.5 py-0">
                          面试官
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-400">
                        {member.createdAt
                          ? new Date(member.createdAt).toLocaleDateString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })
                          : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="pr-5">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Right: Add member form */}
        <div className="h-fit rounded-xl border border-border bg-white">
          <div className="border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">新增成员</h2>
            </div>
            <p className="mt-1 text-xs text-slate-400">创建后可用于登录面试后台</p>
          </div>

          <form onSubmit={handleCreateMember} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                用户名 <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="member_name"
                  required
                  className="h-9 pl-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">邮箱</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="member@company.com"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">
                密码 <span className="text-red-400">*</span>
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="至少 6 位"
                required
                minLength={6}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">角色</label>
              <Select
                value={form.role}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    role: value as 'ORG_ADMIN' | 'INTERVIEWER'
                  }))
                }
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERVIEWER">面试官</SelectItem>
                  <SelectItem value="ORG_ADMIN">企业管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={submitting} className="w-full h-9 text-sm mt-2">
              {submitting ? '创建中...' : '创建成员'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

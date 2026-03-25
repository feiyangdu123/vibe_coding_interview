'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ClipboardList,
  Crown,
  FileCode2,
  FileSpreadsheet,
  ServerCog,
  Settings2,
  Users,
  Wallet
} from 'lucide-react'
import { MetricCard } from '@/components/admin/metric-card'
import { PageHeader } from '@/components/admin/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'
import type { InterviewQuotaSummary } from '@vibe/shared-types'

// --- Org Dashboard types ---

interface DashboardStats {
  interviewTotal: string
  candidateTotal: string
  problemTotal: string
  processTotal: string
  quotaAvailable: string
  quotaReserved: string
}

const defaultStats: DashboardStats = {
  interviewTotal: '--',
  candidateTotal: '--',
  problemTotal: '--',
  processTotal: '--',
  quotaAvailable: '--',
  quotaReserved: '--'
}

const quickLinks = [
  {
    href: '/admin/interview-quota',
    title: '面试配额',
    description: '查看剩余可创建场次、预占情况和历史消费流水',
    tag: '额度管理'
  },
  {
    href: '/admin/interviews',
    title: '面试管理',
    description: '查看创建记录、AI 评估结果和导出报表',
    tag: '核心业务'
  },
  {
    href: '/admin/candidates',
    title: '候选人',
    description: '统一维护候选人基本信息和联络方式',
    tag: '资料管理'
  },
  {
    href: '/admin/problems',
    title: '题目管理',
    description: '企业题库、模板复制与难度筛选',
    tag: '题库维护'
  },
  {
    href: '/admin/processes',
    title: '运行进程',
    description: '跟踪 Runtime 健康状态与异常停止',
    tag: '运行保障'
  }
]

// --- Platform Dashboard types ---

interface PlatformStats {
  orgCount: number
  interviewTotal: number
  activeTemplates: number
  inProgressInterviews: number
  interviewsByOrg: {
    organizationId: string
    organizationName: string
    organizationSlug: string
    interviewCount: number
  }[]
}

const platformQuickLinks = [
  {
    href: '/admin/platform/templates',
    title: '模板管理',
    description: '管理平台题目模板库，供企业复制使用',
    tag: '平台模板',
    icon: FileCode2
  },
  {
    href: '/admin/platform/evaluation-configs',
    title: '评估配置',
    description: '按题目类型配置 AI 评估维度与提示词',
    tag: '评估管理',
    icon: Settings2
  }
]

// --- Platform Admin Dashboard ---

function PlatformDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null)

  useEffect(() => {
    apiFetch('/api/platform/stats')
      .then(setStats)
      .catch(() => {})
  }, [])

  return (
    <div className="console-page">
      <PageHeader
        meta="Platform Admin"
        title="平台运营总览"
        description="全平台视角查看企业数量、面试总量、模板与活跃进程。"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="企业总数"
          value={stats ? String(stats.orgCount) : '--'}
          description="已注册的企业组织数量"
          icon={Building2}
        />
        <MetricCard
          label="面试总量"
          value={stats ? String(stats.interviewTotal) : '--'}
          description="全平台累计面试场次"
          icon={ClipboardList}
        />
        <MetricCard
          label="活跃模板"
          value={stats ? String(stats.activeTemplates) : '--'}
          description="当前启用的平台题目模板"
          icon={FileCode2}
          tone="success"
        />
        <MetricCard
          label="进行中面试"
          value={stats ? String(stats.inProgressInterviews) : '--'}
          description="当前正在进行的面试场次"
          icon={ServerCog}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
        <Card>
          <CardHeader>
            <div className="console-kicker">Organization Overview</div>
            <CardTitle className="mt-2">各企业面试情况</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats?.interviewsByOrg?.length ? (
              <div className="py-8 text-center text-sm text-slate-500">暂无面试数据</div>
            ) : (
              <div className="space-y-2">
                {stats.interviewsByOrg.map((org) => (
                  <div
                    key={org.organizationId}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-slate-950">{org.organizationName}</div>
                        {org.organizationSlug && (
                          <Badge variant="secondary">{org.organizationSlug}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{org.interviewCount} 场</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <div className="console-kicker">Quick Access</div>
              <CardTitle className="mt-2">平台管理入口</CardTitle>
            </div>
            <Badge variant="outline">
              <Crown className="mr-1 h-3 w-3" />
              管理员
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {platformQuickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-slate-950">{item.title}</div>
                    <Badge variant="secondary">{item.tag}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{item.description}</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// --- Org Admin Dashboard ---

function OrgDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>(defaultStats)
  const [quotaSummary, setQuotaSummary] = useState<InterviewQuotaSummary | null>(null)

  useEffect(() => {
    const loadStats = async () => {
      const [interviews, candidates, problems, processes, quota] = await Promise.allSettled([
        apiFetch('/api/admin/interviews?limit=1'),
        apiFetch('/api/admin/candidates?limit=1'),
        apiFetch('/api/admin/problems?limit=1'),
        apiFetch('/api/admin/processes'),
        apiFetch('/api/admin/interview-quota')
      ])

      setStats({
        interviewTotal:
          interviews.status === 'fulfilled' ? String(interviews.value.pagination?.total ?? 0) : '--',
        candidateTotal:
          candidates.status === 'fulfilled' ? String(candidates.value.pagination?.total ?? 0) : '--',
        problemTotal:
          problems.status === 'fulfilled' ? String(problems.value.pagination?.total ?? 0) : '--',
        processTotal:
          processes.status === 'fulfilled' ? String(processes.value.processes?.length ?? 0) : '--',
        quotaAvailable:
          quota.status === 'fulfilled' ? String(quota.value.availableCount ?? 0) : '--',
        quotaReserved:
          quota.status === 'fulfilled' ? String(quota.value.reservedCount ?? 0) : '--'
      })

      setQuotaSummary(quota.status === 'fulfilled' ? quota.value : null)
    }

    loadStats()
  }, [])

  return (
    <div className="console-page">
      <PageHeader
        meta="Control Plane"
        title="运营总览"
        description="统一查看面试执行、题库资产、候选人数据和 Runtime 状态。该工作台采用表格优先和分区明确的企业级控制台布局。"
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/admin/problems')}>
              <FileSpreadsheet className="h-4 w-4" />
              维护题库
            </Button>
            <Button onClick={() => router.push('/admin/interviews/create')}>
              <CalendarClock className="h-4 w-4" />
              创建面试
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="剩余可创建"
          value={stats.quotaAvailable}
          description={`当前预占中 ${stats.quotaReserved} 场，完成后才会真正扣减`}
          icon={Wallet}
          tone="warning"
        />
        <MetricCard
          label="面试总量"
          value={stats.interviewTotal}
          description="包含待开始、进行中、已完成与失败记录"
          icon={ClipboardList}
        />
        <MetricCard
          label="候选人规模"
          value={stats.candidateTotal}
          description="候选人档案已沉淀到企业统一库"
          icon={Users}
        />
        <MetricCard
          label="题库规模"
          value={stats.problemTotal}
          description="企业题目与模板复制后的可用题目数量"
          icon={FileCode2}
          tone="success"
        />
        <MetricCard
          label="运行进程"
          value={stats.processTotal}
          description="当前处于活跃或可观察状态的运行实例"
          icon={ServerCog}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <div className="console-kicker">Quick Access</div>
              <CardTitle className="mt-2">核心模块入口</CardTitle>
            </div>
            <Badge variant="outline">表格优先</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-slate-950">{item.title}</div>
                    <Badge variant="secondary">{item.tag}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{item.description}</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="console-kicker">Quota Overview</div>
            <CardTitle className="mt-2">面试配额</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <Wallet className="h-4 w-4" />
                当前额度
              </div>
              <div className="mt-2 text-sm leading-6 text-blue-900/80">
                总额 {quotaSummary?.totalGranted ?? '--'} 场，已消耗 {quotaSummary?.consumedCount ?? '--'} 场，预占中 {quotaSummary?.reservedCount ?? '--'} 场。
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="text-sm font-medium text-slate-950">1. 创建即预占</div>
                <div className="mt-1 text-sm text-slate-500">
                  创建面试会先锁定 1 场额度，避免只剩 1 场时还能继续超发多场面试。
                </div>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="text-sm font-medium text-slate-950">2. 完成后实扣</div>
                <div className="mt-1 text-sm text-slate-500">
                  候选人提交、时间到或面试官结束才实扣；取消、未到场、系统错误会释放预占。
                </div>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <div className="text-sm font-medium text-slate-950">3. 查看历史流水</div>
                <div className="mt-1 text-sm text-slate-500">
                  在场次流水中查看每次预占、扣减和释放的原因，便于运营核对。
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={() => router.push('/admin/interview-quota')}>
              查看场次流水
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// --- Main Page: role-based rendering ---

export default function AdminPage() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((data) => setRole(data.user?.role ?? null))
      .catch(() => {})
  }, [])

  if (!role) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-slate-500">加载中...</div>
      </div>
    )
  }

  if (role === 'PLATFORM_ADMIN') {
    return <PlatformDashboard />
  }

  return <OrgDashboard />
}

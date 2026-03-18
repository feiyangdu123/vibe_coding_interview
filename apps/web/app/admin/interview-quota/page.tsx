'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet, LockKeyhole, Receipt, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/admin/page-header'
import { MetricCard } from '@/components/admin/metric-card'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import type { InterviewQuotaLedgerEntry, InterviewQuotaSummary, PaginationMeta } from '@vibe/shared-types'

const actionLabel = {
  GRANT: '发放',
  RESERVE: '预占',
  CONSUME: '扣减',
  RELEASE: '释放',
  ADJUST: '调整'
}

const reasonLabel = {
  ORGANIZATION_CREATED: '企业初始化',
  INTERVIEW_CREATED: '创建面试',
  INTERVIEW_COMPLETED: '面试有效结束',
  INTERVIEW_CANCELLED: '管理员取消',
  CANDIDATE_NO_SHOW: '候选人未到场',
  SYSTEM_VOID: '系统错误作废',
  MANUAL_ADJUSTMENT: '人工调账',
  MIGRATION_BACKFILL: '历史数据回填'
}

export default function InterviewQuotaPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<InterviewQuotaSummary | null>(null)
  const [entries, setEntries] = useState<InterviewQuotaLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [flow, setFlow] = useState<'all' | 'consumed' | 'released' | 'reserved'>('all')
  const [pageSize, setPageSize] = useState(25)
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1
  })

  const loadData = async (page = pagination.page, nextFlow = flow, nextPageSize = pageSize) => {
    setLoading(true)
    try {
      const [summaryRes, ledgerRes] = await Promise.all([
        apiFetch('/api/admin/interview-quota'),
        apiFetch(`/api/admin/interview-quota/ledger?page=${page}&limit=${nextPageSize}&flow=${nextFlow}`)
      ])

      setSummary(summaryRes)
      setEntries(ledgerRes.data || [])
      setPagination(ledgerRes.pagination)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(1, flow, pageSize)
  }, [flow, pageSize])

  const getDeltaText = (entry: InterviewQuotaLedgerEntry) => {
    if (entry.action === 'GRANT') return `+${entry.deltaTotal} 总额`
    if (entry.action === 'RESERVE') return `+${entry.deltaReserved} 预占`
    if (entry.action === 'CONSUME') return `${entry.deltaReserved} 预占 / +${entry.deltaConsumed} 扣减`
    if (entry.action === 'RELEASE') return `${entry.deltaReserved} 预占`
    return `总额 ${entry.deltaTotal}, 预占 ${entry.deltaReserved}, 扣减 ${entry.deltaConsumed}`
  }

  return (
    <div className="console-page">
      <PageHeader
        meta="Interview Quota"
        title="场次流水"
        description="查看面试配额的剩余、预占、扣减和释放明细，便于企业管理员核对每一笔场次变化。"
        actions={
          <Button variant="outline" onClick={() => router.push('/admin')}>
            返回运营总览
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="剩余可创建"
          value={summary ? String(summary.availableCount) : '--'}
          description="当前还能继续创建的面试场次"
          icon={Wallet}
          tone="warning"
        />
        <MetricCard
          label="预占中"
          value={summary ? String(summary.reservedCount) : '--'}
          description="已创建但尚未完成结算的场次"
          icon={LockKeyhole}
        />
        <MetricCard
          label="已消耗"
          value={summary ? String(summary.consumedCount) : '--'}
          description="已经完成并实际扣减的场次"
          icon={Receipt}
          tone="success"
        />
        <MetricCard
          label="总额度"
          value={summary ? String(summary.totalGranted) : '--'}
          description="当前企业可支配的总场次数"
          icon={Undo2}
        />
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <Select value={flow} onValueChange={(value) => setFlow(value as typeof flow)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="流水类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部流水</SelectItem>
                <SelectItem value="consumed">仅已扣减</SelectItem>
                <SelectItem value="released">仅已释放</SelectItem>
                <SelectItem value="reserved">仅预占</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">加载中...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>动作</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>候选人</TableHead>
                    <TableHead>面试官</TableHead>
                    <TableHead>面试状态</TableHead>
                    <TableHead>变更</TableHead>
                    <TableHead>变更后可用</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        暂无流水记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{new Date(entry.createdAt).toLocaleString('zh-CN')}</TableCell>
                        <TableCell>
                          <Badge variant={entry.action === 'CONSUME' ? 'success' : entry.action === 'RELEASE' ? 'default' : 'warning'}>
                            {actionLabel[entry.action] || entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{reasonLabel[entry.reason] || entry.reason}</TableCell>
                        <TableCell>
                          {entry.interview?.candidate
                            ? `${entry.interview.candidate.name} (${entry.interview.candidate.email})`
                            : '-'}
                        </TableCell>
                        <TableCell>{entry.interview?.interviewer?.username || '-'}</TableCell>
                        <TableCell>{entry.interview?.status || '-'}</TableCell>
                        <TableCell>{getDeltaText(entry)}</TableCell>
                        <TableCell>{entry.availableAfter}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {pagination.total > 0 && (
                <Pagination
                  page={pagination.page}
                  pageSize={pagination.limit}
                  total={pagination.total}
                  totalPages={pagination.totalPages}
                  onPageChange={(nextPage) => loadData(nextPage, flow)}
                  onPageSizeChange={(nextPageSize) => {
                    setPageSize(nextPageSize)
                  }}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

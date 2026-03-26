'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/admin/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { ChatHistoryDialog } from '@/components/chat-history-dialog'
import { EvaluationDialog } from '@/components/evaluation-dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { MoreHorizontal, ExternalLink, FolderOpen, MessageSquare, ClipboardCheck, Eye, Ban, Trash2 } from 'lucide-react'
import type { PaginationMeta, InterviewStatus, InterviewQuotaState } from '@vibe/shared-types'
import { apiFetch, downloadFile } from '@/lib/api'
import { copyToClipboard } from '@/lib/clipboard'

interface Interview {
  id: string
  token: string
  status: InterviewStatus
  createdAt: string
  scheduledStartAt?: string
  workDir?: string
  quotaState?: InterviewQuotaState
  endReason?: string
  candidate: {
    name: string
    email: string
  }
  problem: {
    title: string
    duration: number
  }
  interviewer?: {
    username: string
  }
  problemSnapshot?: {
    positionName?: string
  }
  aiEvaluationStatus?: string
  aiEvaluationScore?: number
  manualReviewStatus?: string
  finalDecision?: string
}

const statusConfig = {
  PENDING: { label: '待开始', variant: 'warning' as const },
  IN_PROGRESS: { label: '进行中', variant: 'info' as const },
  COMPLETED: { label: '已完成', variant: 'success' as const },
  EXPIRED: { label: '已过期', variant: 'default' as const },
  CANCELLED: { label: '已取消', variant: 'default' as const },
  SUBMITTED: { label: '已提交', variant: 'success' as const }
}

const quotaStateConfig = {
  RESERVED: { label: '预占', variant: 'warning' as const },
  CONSUMED: { label: '已扣', variant: 'success' as const },
  RELEASED: { label: '释放', variant: 'default' as const }
}

const endReasonLabel: Record<string, string> = {
  CANDIDATE_SUBMIT: '候选人提交',
  TIME_UP: '时间到',
  INTERVIEWER_STOP: '面试官结束',
  SYSTEM_ERROR: '系统错误',
  CANCELLED_BY_ORG: '管理员取消',
  CANDIDATE_NO_SHOW: '候选人未到场'
}

const getStatusConfig = (status: string) => {
  return statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'default' as const }
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancellingInterviewId, setCancellingInterviewId] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingInterviewId, setDeletingInterviewId] = useState<string | null>(null)
  const [chatDialogOpen, setChatDialogOpen] = useState(false)
  const [evaluationDialogOpen, setEvaluationDialogOpen] = useState(false)
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null)
  const [selectedInterviewStatus, setSelectedInterviewStatus] = useState<string | undefined>(undefined)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [aiStatusFilter, setAiStatusFilter] = useState('all')
  const [reviewStatusFilter, setReviewStatusFilter] = useState('all')
  const [decisionFilter, setDecisionFilter] = useState('all')
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1
  })
  const debouncedSearch = useDebounce(search, 500)

  const loadInterviews = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(aiStatusFilter !== 'all' && { aiStatus: aiStatusFilter }),
        ...(reviewStatusFilter !== 'all' && { reviewStatus: reviewStatusFilter }),
        ...(decisionFilter !== 'all' && { decision: decisionFilter })
      })

      const response = await apiFetch(`/api/admin/interviews?${params}`)
      setInterviews(response.data || [])
      setPagination(response.pagination)
      setLoading(false)
    } catch (err) {
      console.error(err)
      toast.error('加载失败')
      setInterviews([])
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInterviews()
  }, [page, pageSize, debouncedSearch, statusFilter, aiStatusFilter, reviewStatusFilter, decisionFilter])

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/interview/${token}`
    copyToClipboard(link)
    toast.success('链接已复制')
  }

  const copyWorkDir = (workDir: string) => {
    copyToClipboard(workDir)
    toast.success('目录路径已复制')
  }

  const handleCancel = async (id: string) => {
    setCancellingInterviewId(id)
    setCancelDialogOpen(true)
  }

  const confirmCancel = async () => {
    if (!cancellingInterviewId) return

    try {
      await apiFetch(`/api/admin/interviews/${cancellingInterviewId}/cancel`, {
        method: 'POST'
      })

      loadInterviews()
      toast.success('面试已取消')
    } catch (err) {
      console.error(err)
      toast.error('取消失败')
    } finally {
      setCancellingInterviewId(null)
      setCancelDialogOpen(false)
    }
  }

  const handleDelete = (id: string) => {
    setDeletingInterviewId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingInterviewId) return

    try {
      await apiFetch(`/api/admin/interviews/${deletingInterviewId}/delete`, {
        method: 'POST'
      })

      loadInterviews()
      toast.success('面试已删除')
    } catch (err) {
      console.error(err)
      toast.error('删除失败')
    } finally {
      setDeletingInterviewId(null)
      setDeleteDialogOpen(false)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(aiStatusFilter !== 'all' && { aiStatus: aiStatusFilter }),
        ...(reviewStatusFilter !== 'all' && { reviewStatus: reviewStatusFilter }),
        ...(decisionFilter !== 'all' && { decision: decisionFilter })
      })

      await downloadFile(`/api/admin/interviews/export?${params}`)
      toast.success('导出成功')
    } catch (err) {
      toast.error('导出失败')
    }
  }

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) +
      ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">加载中...</div>
    </div>
  )

  return (
    <div className="console-page">
      <PageHeader
        meta="Interview Operations"
        title="面试管理"
        description="查看面试执行情况、导出报表，并进入详情页触发 AI 评估或人工复核。"
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              导出 Excel
            </Button>
            <Button onClick={() => window.location.href = '/admin/interviews/create'}>创建面试</Button>
          </>
        }
      />

      <Card>
        <CardContent className="pt-5">
          {/* 筛选区 */}
          <div className="grid grid-cols-[1fr_repeat(4,160px)] gap-3 mb-5 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">搜索</label>
              <Input
                placeholder="候选人姓名、邮箱或题目..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">面试状态</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="PENDING">待开始</SelectItem>
                  <SelectItem value="IN_PROGRESS">进行中</SelectItem>
                  <SelectItem value="COMPLETED">已完成</SelectItem>
                  <SelectItem value="CANCELLED">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">AI 评估</label>
              <Select
                value={aiStatusFilter}
                onValueChange={(value) => {
                  setAiStatusFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部评估" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部评估</SelectItem>
                  <SelectItem value="pending">待评估</SelectItem>
                  <SelectItem value="running">评估中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">复核状态</label>
              <Select
                value={reviewStatusFilter}
                onValueChange={(value) => {
                  setReviewStatusFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部复核" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部复核</SelectItem>
                  <SelectItem value="pending">待复核</SelectItem>
                  <SelectItem value="completed">已复核</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">最终结论</label>
              <Select
                value={decisionFilter}
                onValueChange={(value) => {
                  setDecisionFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部结论" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部结论</SelectItem>
                  <SelectItem value="pass">通过</SelectItem>
                  <SelectItem value="fail">不通过</SelectItem>
                  <SelectItem value="pending">待定</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 表格区 */}
          <div className="overflow-x-auto">
            <Table className="table-fixed min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">候选人</TableHead>
                  <TableHead className="w-[120px]">职位</TableHead>
                  <TableHead className="w-[140px]">题目</TableHead>
                  <TableHead className="w-[100px]">预约时间</TableHead>
                  <TableHead className="w-[72px]">状态</TableHead>
                  <TableHead className="w-[64px]">AI 评分</TableHead>
                  <TableHead className="w-[72px]">复核</TableHead>
                  <TableHead className="w-[72px]">结论</TableHead>
                  <TableHead className="w-[90px]">创建时间</TableHead>
                  <TableHead className="w-[100px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interviews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                      {search || statusFilter !== 'all' ? '未找到匹配的面试' : '暂无面试，点击"创建面试"创建第一个面试'}
                    </TableCell>
                  </TableRow>
                ) : (
                  interviews.map(interview => (
                    <TableRow key={interview.id} className="group">
                      {/* 候选人 */}
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate" title={interview.candidate.name}>
                            {interview.candidate.name}
                          </div>
                          <div className="text-xs text-slate-400 truncate" title={interview.candidate.email}>
                            {interview.candidate.email}
                          </div>
                        </div>
                      </TableCell>

                      {/* 职位 */}
                      <TableCell>
                        <span
                          className="line-clamp-2 text-slate-700"
                          title={interview.problemSnapshot?.positionName || '-'}
                        >
                          {interview.problemSnapshot?.positionName || '-'}
                        </span>
                      </TableCell>

                      {/* 题目 */}
                      <TableCell>
                        <div className="min-w-0">
                          <div className="line-clamp-1 text-slate-700" title={interview.problem.title}>
                            {interview.problem.title}
                          </div>
                          <div className="text-xs text-slate-400">{interview.problem.duration}min</div>
                        </div>
                      </TableCell>

                      {/* 预约时间 */}
                      <TableCell className="text-slate-600 whitespace-nowrap text-xs">
                        {interview.scheduledStartAt
                          ? formatDateTime(interview.scheduledStartAt)
                          : <span className="text-slate-300">-</span>}
                      </TableCell>

                      {/* 状态 */}
                      <TableCell>
                        <Badge variant={getStatusConfig(interview.status).variant} className="whitespace-nowrap">
                          {getStatusConfig(interview.status).label}
                        </Badge>
                      </TableCell>

                      {/* AI 评分 */}
                      <TableCell>
                        {interview.aiEvaluationStatus === 'completed' && interview.aiEvaluationScore !== undefined ? (
                          <Badge
                            variant={
                              interview.aiEvaluationScore >= 70 ? 'success' :
                              interview.aiEvaluationScore >= 50 ? 'warning' :
                              'error'
                            }
                            className="font-semibold"
                          >
                            {interview.aiEvaluationScore.toFixed(1)}
                          </Badge>
                        ) : interview.aiEvaluationStatus === 'running' ? (
                          <span className="text-xs text-sky-500">评估中</span>
                        ) : interview.aiEvaluationStatus === 'failed' ? (
                          <span className="text-xs text-red-500">失败</span>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </TableCell>

                      {/* 复核状态 */}
                      <TableCell>
                        {interview.manualReviewStatus === 'completed' ? (
                          <Badge variant="success" className="whitespace-nowrap">已复核</Badge>
                        ) : interview.manualReviewStatus === 'pending' ? (
                          <Badge variant="warning" className="whitespace-nowrap">待复核</Badge>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </TableCell>

                      {/* 最终结论 */}
                      <TableCell>
                        {interview.finalDecision === 'pass' ? (
                          <Badge variant="success">通过</Badge>
                        ) : interview.finalDecision === 'fail' ? (
                          <Badge variant="error">不通过</Badge>
                        ) : interview.finalDecision === 'pending' ? (
                          <Badge variant="warning">待定</Badge>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </TableCell>

                      {/* 创建时间 */}
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(interview.createdAt)}
                      </TableCell>

                      {/* 操作 */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => window.location.href = `/admin/interviews/${interview.id}`}
                          >
                            详情
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {interview.aiEvaluationStatus === 'completed' && (
                                <DropdownMenuItem
                                  onClick={() => window.location.href = `/admin/interviews/${interview.id}/review`}
                                >
                                  <ClipboardCheck className="mr-2 h-3.5 w-3.5" />
                                  {interview.manualReviewStatus === 'completed' ? '查看复核' : '进入复核'}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => copyLink(interview.token)}>
                                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                复制链接
                              </DropdownMenuItem>
                              {interview.workDir && (
                                <DropdownMenuItem onClick={() => copyWorkDir(interview.workDir!)}>
                                  <FolderOpen className="mr-2 h-3.5 w-3.5" />
                                  复制目录
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                disabled={interview.status === 'PENDING'}
                                onClick={() => {
                                  setSelectedInterviewId(interview.id)
                                  setChatDialogOpen(true)
                                }}
                              >
                                <MessageSquare className="mr-2 h-3.5 w-3.5" />
                                查看聊天
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={interview.aiEvaluationStatus !== 'completed'}
                                onClick={() => {
                                  setSelectedInterviewId(interview.id)
                                  setSelectedInterviewStatus(interview.status)
                                  setEvaluationDialogOpen(true)
                                }}
                              >
                                <Eye className="mr-2 h-3.5 w-3.5" />
                                查看评估
                              </DropdownMenuItem>
                              {interview.status === 'PENDING' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                    onClick={() => handleCancel(interview.id)}
                                  >
                                    <Ban className="mr-2 h-3.5 w-3.5" />
                                    取消面试
                                  </DropdownMenuItem>
                                </>
                              )}
                              {['COMPLETED', 'CANCELLED', 'EXPIRED', 'SUBMITTED'].includes(interview.status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                    onClick={() => handleDelete(interview.id)}
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    删除面试
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination.total > 0 && (
            <Pagination
              page={pagination.page}
              pageSize={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPage(1)
              }}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="确认取消"
        description="确定要取消这场待开始面试吗？取消后会释放预占的面试配额。"
        onConfirm={confirmCancel}
        confirmText="取消面试"
        variant="destructive"
      />

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="确认删除"
        description="确定要删除这场面试吗？删除后面试将从列表中隐藏，但数据不会被物理删除，仍可通过直接链接访问。"
        onConfirm={confirmDelete}
        confirmText="删除面试"
        variant="destructive"
      />

      <ChatHistoryDialog
        open={chatDialogOpen}
        onOpenChange={setChatDialogOpen}
        interviewId={selectedInterviewId}
      />

      <EvaluationDialog
        open={evaluationDialogOpen}
        onOpenChange={setEvaluationDialogOpen}
        interviewId={selectedInterviewId}
        interviewStatus={selectedInterviewStatus}
      />
    </div>
  )
}

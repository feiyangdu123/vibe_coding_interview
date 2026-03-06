'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { ChatHistoryDialog } from '@/components/chat-history-dialog'
import { EvaluationDialog } from '@/components/evaluation-dialog'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { interviewSchema, type InterviewFormData } from '@vibe/shared-types'
import type { PaginationMeta, InterviewStatus } from '@vibe/shared-types'

interface Interview {
  id: string
  token: string
  status: InterviewStatus
  createdAt: string
  workDir?: string
  candidate: {
    name: string
    email: string
  }
  problem: {
    title: string
    duration: number
  }
  // 新增评估字段
  aiEvaluationStatus?: string
  aiEvaluationScore?: number
}

interface Candidate {
  id: string
  name: string
  email: string
}

interface Problem {
  id: string
  title: string
  duration: number
}

const statusConfig = {
  pending: { label: '待开始', variant: 'warning' as const },
  in_progress: { label: '进行中', variant: 'info' as const },
  completed: { label: '已完成', variant: 'success' as const },
  expired: { label: '已过期', variant: 'error' as const }
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingInterviewId, setDeletingInterviewId] = useState<string | null>(null)
  const [chatDialogOpen, setChatDialogOpen] = useState(false)
  const [evaluationDialogOpen, setEvaluationDialogOpen] = useState(false)
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null)

  // Pagination, search, and filter state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1
  })
  const debouncedSearch = useDebounce(search, 500)

  const form = useForm<InterviewFormData>({
    resolver: zodResolver(interviewSchema),
    defaultValues: {
      candidateId: '',
      problemId: '',
      duration: 60
    }
  })

  const loadInterviews = () => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: pageSize.toString(),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(statusFilter !== 'all' && { status: statusFilter })
    })

    fetch(`http://localhost:3001/api/admin/interviews?${params}`)
      .then(res => res.json())
      .then(response => {
        if (response.data) {
          setInterviews(response.data)
          setPagination(response.pagination)
        } else {
          setInterviews([])
          if (response.error || response.message) {
            toast.error(response.error || response.message)
          }
        }
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setInterviews([])
        toast.error('加载失败')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadInterviews()
  }, [page, pageSize, debouncedSearch, statusFilter])

  useEffect(() => {
    // Load candidates and problems for the form (without pagination)
    fetch('http://localhost:3001/api/admin/candidates?limit=1000')
      .then(res => res.json())
      .then(response => setCandidates(response.data || response))
      .catch(err => console.error(err))

    fetch('http://localhost:3001/api/admin/problems?limit=1000')
      .then(res => res.json())
      .then(response => setProblems(response.data || response))
      .catch(err => console.error(err))
  }, [])

  const handleCreate = () => {
    form.reset({
      candidateId: '',
      problemId: '',
      duration: 60
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: InterviewFormData) => {
    setSubmitting(true)

    try {
      const res = await fetch('http://localhost:3001/api/admin/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        const interview = await res.json()
        setDialogOpen(false)
        loadInterviews()

        // Show the interview link
        const link = `${window.location.origin}/interview/${interview.token}`
        toast.success('面试创建成功！链接已复制到剪贴板')
        navigator.clipboard.writeText(link)
      } else {
        toast.error('创建失败')
      }
    } catch (err) {
      console.error(err)
      toast.error('创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/interview/${token}`
    navigator.clipboard.writeText(link)
    toast.success('链接已复制')
  }

  const copyWorkDir = (workDir: string) => {
    navigator.clipboard.writeText(workDir)
    toast.success('目录路径已复制')
  }

  const handleDelete = async (id: string) => {
    setDeletingInterviewId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingInterviewId) return

    try {
      const res = await fetch(`http://localhost:3001/api/admin/interviews/${deletingInterviewId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        loadInterviews()
        toast.success('面试删除成功')
      } else {
        toast.error('删除失败')
      }
    } catch (err) {
      console.error(err)
      toast.error('删除失败')
    } finally {
      setDeletingInterviewId(null)
      setDeleteDialogOpen(false)
    }
  }

  if (loading) return <div>加载中...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">面试管理</h1>
        <Button onClick={handleCreate}>创建面试</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="搜索候选人姓名、邮箱或题目..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="max-w-sm"
            />
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="w-40"
            >
              <option value="all">全部状态</option>
              <option value="pending">待开始</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
              <option value="expired">已过期</option>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>候选人</TableHead>
                <TableHead>题目</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>AI评分</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {search || statusFilter !== 'all' ? '未找到匹配的面试' : '暂无面试，点击"创建面试"创建第一个面试'}
                  </TableCell>
                </TableRow>
              ) : (
                interviews.map(interview => (
                  <TableRow key={interview.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{interview.candidate.name}</div>
                        <div className="text-sm text-muted-foreground">{interview.candidate.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{interview.problem.title}</div>
                        <div className="text-sm text-muted-foreground">{interview.problem.duration} 分钟</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[interview.status].variant}>
                        {statusConfig[interview.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {interview.aiEvaluationStatus === 'completed' && interview.aiEvaluationScore !== undefined ? (
                        <Badge
                          variant={
                            interview.aiEvaluationScore >= 7 ? 'success' :
                            interview.aiEvaluationScore >= 5 ? 'warning' :
                            'error'
                          }
                          className="font-semibold"
                        >
                          {interview.aiEvaluationScore.toFixed(1)}/10
                        </Badge>
                      ) : interview.aiEvaluationStatus === 'running' ? (
                        <Badge variant="info">评估中...</Badge>
                      ) : interview.aiEvaluationStatus === 'failed' ? (
                        <Badge variant="error">评估失败</Badge>
                      ) : (
                        <Badge variant="default" className="bg-gray-400 text-gray-600">未评估</Badge>
                      )}
                    </TableCell>
                    <TableCell>{new Date(interview.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => copyLink(interview.token)}>
                        复制链接
                      </Button>
                      {interview.workDir && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyWorkDir(interview.workDir!)}
                          title={interview.workDir}
                        >
                          复制目录
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInterviewId(interview.id)
                          setChatDialogOpen(true)
                        }}
                        disabled={interview.status === 'pending'}
                      >
                        查看聊天
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInterviewId(interview.id)
                          setEvaluationDialogOpen(true)
                        }}
                        disabled={interview.aiEvaluationStatus !== 'completed'}
                      >
                        查看评估
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(interview.id)}>
                        删除
                      </Button>
                    </TableCell>
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
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPage(1)
              }}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>创建面试</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="candidateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>候选人</FormLabel>
                      <FormControl>
                        <Select {...field}>
                          <option value="">请选择候选人</option>
                          {candidates.map(candidate => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name} ({candidate.email})
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="problemId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>题目</FormLabel>
                      <FormControl>
                        <Select {...field}>
                          <option value="">请选择题目</option>
                          {problems.map(problem => (
                            <option key={problem.id} value={problem.id}>
                              {problem.title} ({problem.duration} 分钟)
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>时长（分钟）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? '创建中...' : '创建'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="确认删除"
        description="确定要删除这个面试吗？此操作无法撤销。"
        onConfirm={confirmDelete}
        confirmText="删除"
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
      />
    </div>
  )
}


'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/admin/page-header'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { problemSchema, type ProblemFormData } from '@vibe/shared-types'
import type { PaginationMeta, ProblemVisibility, ProblemType } from '@vibe/shared-types'
import { apiFetch } from '@/lib/api'

interface Problem {
  id: string
  slug?: string
  title: string
  description: string
  requirements: string
  duration: number
  workDirTemplate: string
  createdAt: string
  visibility?: ProblemVisibility
  problemType?: ProblemType
  roleTrack?: string
  difficulty?: string
  language?: string
  tags?: string[]
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProblemId, setDeletingProblemId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'organization' | 'templates'>('organization')

  // Pagination and search state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1
  })
  const debouncedSearch = useDebounce(search, 500)

  // Filter state
  const [visibilityTab, setVisibilityTab] = useState<'all' | 'PRIVATE' | 'ORG_SHARED'>('all')
  const [filters, setFilters] = useState({
    problemType: 'all',
    difficulty: 'all',
    roleTrack: '',
    language: 'all',
    tags: ''
  })

  const form = useForm<ProblemFormData>({
    resolver: zodResolver(problemSchema),
    defaultValues: {
      title: '',
      description: '',
      requirements: '',
      duration: 60,
      workDirTemplate: 'templates/default',
      scoringCriteria: {},
      visibility: 'PRIVATE',
      problemType: 'CODING',
      roleTrack: '',
      difficulty: '',
      language: '',
      tags: [],
      evaluationInstructionsText: '',
      acceptanceCriteria: []
    }
  })

  const loadProblems = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filters.problemType !== 'all' && { problemType: filters.problemType }),
        ...(filters.difficulty !== 'all' && { difficulty: filters.difficulty }),
        ...(filters.roleTrack && { roleTrack: filters.roleTrack }),
        ...(filters.language !== 'all' && { language: filters.language }),
        ...(filters.tags && { tags: filters.tags })
      })

      if (viewMode === 'organization' && visibilityTab !== 'all') {
        params.set('visibility', visibilityTab)
      }

      const endpoint = viewMode === 'organization'
        ? `/api/admin/problems?${params}`
        : `/api/admin/problem-templates?${params}`

      const response = await apiFetch(endpoint)
      setProblems(response.data || [])
      setPagination(response.pagination)
      setLoading(false)
    } catch (err) {
      console.error(err)
      toast.error('加载失败')
      setProblems([])
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProblems()
  }, [page, pageSize, debouncedSearch, visibilityTab, filters, viewMode])

  const handleCreate = () => {
    setEditingProblem(null)
    form.reset({
      title: '',
      description: '',
      requirements: '',
      duration: 60,
      workDirTemplate: 'templates/default',
      scoringCriteria: {},
      visibility: 'PRIVATE',
      problemType: 'CODING',
      roleTrack: '',
      difficulty: '',
      language: '',
      tags: [],
      evaluationInstructionsText: '',
      acceptanceCriteria: []
    })
    setDialogOpen(true)
  }

  const handleCopyTemplate = async (templateId: string) => {
    try {
      await apiFetch(`/api/admin/problem-templates/${templateId}/copy`, {
        method: 'POST'
      })
      toast.success('已复制到本企业题库')
    } catch (err) {
      console.error(err)
      toast.error('复制模板失败')
    }
  }

  const handleEdit = (problem: Problem) => {
    setEditingProblem(problem)
    form.reset({
      title: problem.title,
      description: problem.description,
      requirements: problem.requirements,
      duration: problem.duration,
      workDirTemplate: problem.workDirTemplate,
      scoringCriteria: {},
      visibility: problem.visibility || 'PRIVATE',
      problemType: problem.problemType || 'CODING',
      roleTrack: problem.roleTrack || '',
      difficulty: problem.difficulty || '',
      language: problem.language || '',
      tags: problem.tags || [],
      evaluationInstructionsText: '',
      acceptanceCriteria: []
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: ProblemFormData) => {
    setSubmitting(true)

    try {
      const url = editingProblem
        ? `/api/admin/problems/${editingProblem.id}`
        : '/api/admin/problems'

      const method = editingProblem ? 'PUT' : 'POST'

      await apiFetch(url, {
        method,
        body: JSON.stringify(data)
      })

      setDialogOpen(false)
      loadProblems()
      toast.success(editingProblem ? '题目更新成功' : '题目创建成功')
    } catch (err) {
      console.error(err)
      toast.error('操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingProblemId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingProblemId) return

    try {
      await apiFetch(`/api/admin/problems/${deletingProblemId}`, {
        method: 'DELETE'
      })

      loadProblems()
      toast.success('题目删除成功')
    } catch (err) {
      console.error(err)
      toast.error('删除失败')
    } finally {
      setDeletingProblemId(null)
      setDeleteDialogOpen(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">加载中...</div>
    </div>
  )

  return (
    <div className="console-page">
      <PageHeader
        meta="Problem Library"
        title="题目管理"
        description="维护企业题库，按岗位与难度筛选题目，并从平台模板快速复制可用内容。"
        actions={viewMode === 'organization' ? <Button onClick={handleCreate}>新建题目</Button> : undefined}
      />

      <Card>
        <CardContent className="pt-5">
          <Tabs value={viewMode} onValueChange={(v) => {
            setViewMode(v as 'organization' | 'templates')
            setPage(1)
          }}>
            <TabsList>
              <TabsTrigger value="organization">企业题库</TabsTrigger>
              <TabsTrigger value="templates">平台模板</TabsTrigger>
            </TabsList>
          </Tabs>

          {viewMode === 'organization' && (
            <Tabs value={visibilityTab} onValueChange={(v) => setVisibilityTab(v as any)} className="mt-4">
              <TabsList>
                <TabsTrigger value="all">全部</TabsTrigger>
                <TabsTrigger value="PRIVATE">私有</TabsTrigger>
                <TabsTrigger value="ORG_SHARED">组织共享</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="mt-4 mb-4">
            <Input
              placeholder={viewMode === 'organization' ? '搜索企业题目标题或描述...' : '搜索平台模板标题或描述...'}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="max-w-sm"
            />
          </div>

          <div className="grid grid-cols-5 gap-3 mb-4">
            <Select
              value={filters.problemType}
              onValueChange={(v) => setFilters({ ...filters, problemType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="题目类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="CODING">编程</SelectItem>
                <SelectItem value="SYSTEM_DESIGN">系统设计</SelectItem>
                <SelectItem value="ALGORITHM">算法</SelectItem>
                <SelectItem value="DEBUGGING">调试</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.difficulty}
              onValueChange={(v) => setFilters({ ...filters, difficulty: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="难度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部难度</SelectItem>
                <SelectItem value="Easy">简单</SelectItem>
                <SelectItem value="Medium">中等</SelectItem>
                <SelectItem value="Hard">困难</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="职位方向"
              value={filters.roleTrack}
              onChange={(e) => setFilters({ ...filters, roleTrack: e.target.value })}
            />

            <Select
              value={filters.language}
              onValueChange={(v) => setFilters({ ...filters, language: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="语言" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部语言</SelectItem>
                <SelectItem value="JavaScript">JavaScript</SelectItem>
                <SelectItem value="Python">Python</SelectItem>
                <SelectItem value="Java">Java</SelectItem>
                <SelectItem value="Go">Go</SelectItem>
                <SelectItem value="TypeScript">TypeScript</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="标签（逗号分隔）"
              value={filters.tags}
              onChange={(e) => setFilters({ ...filters, tags: e.target.value })}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>难度</TableHead>
                <TableHead>职位方向</TableHead>
                <TableHead>语言</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>可见性</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {search ? '未找到匹配的题目' : (viewMode === 'organization' ? '暂无题目，点击"新建题目"创建第一个题目' : '暂无平台模板')}
                  </TableCell>
                </TableRow>
              ) : (
                problems.map(problem => (
                  <TableRow key={problem.id}>
                    <TableCell>{problem.title}</TableCell>
                    <TableCell>
                      {problem.problemType && (
                        <Badge variant="outline">
                          {problem.problemType === 'CODING' ? '编程' :
                           problem.problemType === 'SYSTEM_DESIGN' ? '系统设计' :
                           problem.problemType === 'ALGORITHM' ? '算法' :
                           problem.problemType === 'DEBUGGING' ? '调试' : problem.problemType}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {problem.difficulty && (
                        <Badge variant={
                          problem.difficulty === 'Easy' ? 'default' :
                          problem.difficulty === 'Medium' ? 'secondary' : 'destructive'
                        }>
                          {problem.difficulty === 'Easy' ? '简单' :
                           problem.difficulty === 'Medium' ? '中等' :
                           problem.difficulty === 'Hard' ? '困难' : problem.difficulty}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{problem.roleTrack || '-'}</TableCell>
                    <TableCell>{problem.language || '-'}</TableCell>
                    <TableCell>{problem.duration} 分钟</TableCell>
                    <TableCell>
                      <Badge variant={viewMode === 'organization' && problem.visibility === 'ORG_SHARED' ? 'default' : 'secondary'}>
                        {viewMode === 'templates'
                          ? '平台模板'
                          : problem.visibility === 'PRIVATE'
                            ? '私有'
                            : problem.visibility === 'ORG_SHARED'
                              ? '组织共享'
                              : problem.visibility || '私有'}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      {viewMode === 'organization' ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(problem)}>
                            编辑
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(problem.id)}>
                            删除
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleCopyTemplate(problem.id)}>
                          复制到企业
                        </Button>
                      )}
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
                <DialogTitle>{editingProblem ? '编辑题目' : '新建题目'}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>标题</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>题目描述</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>要求</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} />
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

                <FormField
                  control={form.control}
                  name="workDirTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>工作目录模板</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="/tmp/interview" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>可见性</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择可见性" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PRIVATE">私有</SelectItem>
                          <SelectItem value="ORG_SHARED">组织共享</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="problemType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>题目类型</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择题目类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CODING">编程</SelectItem>
                          <SelectItem value="SYSTEM_DESIGN">系统设计</SelectItem>
                          <SelectItem value="ALGORITHM">算法</SelectItem>
                          <SelectItem value="DEBUGGING">调试</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="roleTrack"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>职位方向</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="例如：前端工程师、后端工程师" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>难度</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择难度" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Easy">简单</SelectItem>
                          <SelectItem value="Medium">中等</SelectItem>
                          <SelectItem value="Hard">困难</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>编程语言</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择编程语言" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="JavaScript">JavaScript</SelectItem>
                          <SelectItem value="Python">Python</SelectItem>
                          <SelectItem value="Java">Java</SelectItem>
                          <SelectItem value="Go">Go</SelectItem>
                          <SelectItem value="TypeScript">TypeScript</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>标签</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={Array.isArray(field.value) ? field.value.join(', ') : ''}
                          onChange={(e) => {
                            const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                            field.onChange(tags)
                          }}
                          placeholder="用逗号分隔"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="evaluationInstructionsText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>评估说明</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} placeholder="评估候选人时的注意事项" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="acceptanceCriteria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>验收标准</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={Array.isArray(field.value) ? field.value.join('\n') : ''}
                          onChange={(e) => {
                            const criteria = e.target.value.split('\n').filter(Boolean)
                            field.onChange(criteria)
                          }}
                          rows={4}
                          placeholder="每行一个标准，或JSON格式"
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
                  {submitting ? '处理中...' : (editingProblem ? '保存' : '创建')}
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
        description="确定要删除这个题目吗？此操作无法撤销。"
        onConfirm={confirmDelete}
        confirmText="删除"
        variant="destructive"
      />
    </div>
  )
}

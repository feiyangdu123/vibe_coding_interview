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
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { problemSchema, type ProblemFormData } from '@vibe/shared-types'
import type { PaginationMeta } from '@vibe/shared-types'

interface Problem {
  id: string
  title: string
  description: string
  requirements: string
  duration: number
  workDirTemplate: string
  createdAt: string
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingProblemId, setDeletingProblemId] = useState<string | null>(null)

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

  const form = useForm<ProblemFormData>({
    resolver: zodResolver(problemSchema),
    defaultValues: {
      title: '',
      description: '',
      requirements: '',
      duration: 60,
      workDirTemplate: '/tmp/interview',
      scoringCriteria: {}
    }
  })

  const loadProblems = () => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: pageSize.toString(),
      ...(debouncedSearch && { search: debouncedSearch })
    })

    fetch(`http://localhost:3001/api/admin/problems?${params}`)
      .then(res => res.json())
      .then(response => {
        setProblems(response.data)
        setPagination(response.pagination)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        toast.error('加载失败')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadProblems()
  }, [page, pageSize, debouncedSearch])

  const handleCreate = () => {
    setEditingProblem(null)
    form.reset({
      title: '',
      description: '',
      requirements: '',
      duration: 60,
      workDirTemplate: '/tmp/interview',
      scoringCriteria: {}
    })
    setDialogOpen(true)
  }

  const handleEdit = (problem: Problem) => {
    setEditingProblem(problem)
    form.reset({
      title: problem.title,
      description: problem.description,
      requirements: problem.requirements,
      duration: problem.duration,
      workDirTemplate: problem.workDirTemplate,
      scoringCriteria: {}
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: ProblemFormData) => {
    setSubmitting(true)

    try {
      const url = editingProblem
        ? `http://localhost:3001/api/admin/problems/${editingProblem.id}`
        : 'http://localhost:3001/api/admin/problems'

      const method = editingProblem ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (res.ok) {
        setDialogOpen(false)
        loadProblems()
        toast.success(editingProblem ? '题目更新成功' : '题目创建成功')
      } else {
        toast.error('操作失败')
      }
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
      const res = await fetch(`http://localhost:3001/api/admin/problems/${deletingProblemId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        loadProblems()
        toast.success('题目删除成功')
      } else {
        toast.error('删除失败')
      }
    } catch (err) {
      console.error(err)
      toast.error('删除失败')
    } finally {
      setDeletingProblemId(null)
      setDeleteDialogOpen(false)
    }
  }

  if (loading) return <div>加载中...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">题目管理</h1>
        <Button onClick={handleCreate}>新建题目</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <Input
              placeholder="搜索题目标题或描述..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="max-w-sm"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {search ? '未找到匹配的题目' : '暂无题目，点击"新建题目"创建第一个题目'}
                  </TableCell>
                </TableRow>
              ) : (
                problems.map(problem => (
                  <TableRow key={problem.id}>
                    <TableCell>{problem.title}</TableCell>
                    <TableCell>{problem.duration} 分钟</TableCell>
                    <TableCell>{new Date(problem.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(problem)}>
                        编辑
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(problem.id)}>
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


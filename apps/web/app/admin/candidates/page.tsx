'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import { candidateSchema, type CandidateFormData } from '@vibe/shared-types'
import type { PaginationMeta } from '@vibe/shared-types'
import { apiFetch } from '@/lib/api'

interface Candidate {
  id: string
  name: string
  email: string
  phone?: string
  createdAt: string
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null)

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

  const form = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: ''
    }
  })

  const loadCandidates = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(debouncedSearch && { search: debouncedSearch })
      })

      const response = await apiFetch(`/api/admin/candidates?${params}`)
      setCandidates(response.data || [])
      setPagination(response.pagination)
      setLoading(false)
    } catch (err) {
      console.error(err)
      toast.error('加载失败')
      setCandidates([])
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCandidates()
  }, [page, pageSize, debouncedSearch])

  const handleCreate = () => {
    setEditingCandidate(null)
    form.reset({
      name: '',
      email: '',
      phone: ''
    })
    setDialogOpen(true)
  }

  const handleEdit = (candidate: Candidate) => {
    setEditingCandidate(candidate)
    form.reset({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone || ''
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: CandidateFormData) => {
    setSubmitting(true)

    try {
      const url = editingCandidate
        ? `/api/admin/candidates/${editingCandidate.id}`
        : '/api/admin/candidates'

      const method = editingCandidate ? 'PUT' : 'POST'

      await apiFetch(url, {
        method,
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone || undefined
        })
      })

      setDialogOpen(false)
      loadCandidates()
      toast.success(editingCandidate ? '候选人更新成功' : '候选人创建成功')
    } catch (err) {
      console.error(err)
      toast.error('操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingCandidateId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingCandidateId) return

    try {
      await apiFetch(`/api/admin/candidates/${deletingCandidateId}`, {
        method: 'DELETE'
      })

      loadCandidates()
      toast.success('候选人删除成功')
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || '删除失败')
    } finally {
      setDeletingCandidateId(null)
      setDeleteDialogOpen(false)
    }
  }

  if (loading) return <div>加载中...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">候选人管理</h1>
        <Button onClick={handleCreate}>新建候选人</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <Input
              placeholder="搜索候选人姓名或邮箱..."
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
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {search ? '未找到匹配的候选人' : '暂无候选人，点击"新建候选人"创建第一个候选人'}
                  </TableCell>
                </TableRow>
              ) : (
                candidates.map(candidate => (
                  <TableRow key={candidate.id}>
                    <TableCell>{candidate.name}</TableCell>
                    <TableCell>{candidate.email}</TableCell>
                    <TableCell>{candidate.phone || '-'}</TableCell>
                    <TableCell>{new Date(candidate.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(candidate)}>
                        编辑
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(candidate.id)}>
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
                <DialogTitle>{editingCandidate ? '编辑候选人' : '新建候选人'}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>姓名</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>邮箱</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>手机号（可选）</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="13800138000" />
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
                  {submitting ? '处理中...' : (editingCandidate ? '保存' : '创建')}
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
        description="确定要删除这个候选人吗？此操作无法撤销。"
        onConfirm={confirmDelete}
        confirmText="删除"
        variant="destructive"
      />
    </div>
  )
}


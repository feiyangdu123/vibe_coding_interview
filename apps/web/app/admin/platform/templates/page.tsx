'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/admin/page-header'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/use-debounce'
import type { PaginationMeta, ProblemTemplateResponse } from '@vibe/shared-types'
import { apiFetch } from '@/lib/api'

const PROBLEM_TYPE_LABELS: Record<string, string> = {
  ALGORITHM_MODELING: '算法与建模',
  FEATURE_DEV: '功能开发',
  DEBUG_FIX: '调试修复',
  DATA_PROCESSING: '数据处理与分析',
  AGENT_DEV: '智能体开发',
  ITERATION_REFACTOR: '迭代重构',
  PRODUCT_DESIGN: '产品设计',
}

export default function PlatformTemplatesPage() {
  const [templates, setTemplates] = useState<ProblemTemplateResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ProblemTemplateResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 25, total: 0, totalPages: 1 })
  const debouncedSearch = useDebounce(search, 500)

  const [filters, setFilters] = useState({ problemType: 'all' })

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    requirements: '',
    workDirTemplate: 'templates/default',
    duration: 60,
    problemType: 'FEATURE_DEV',
    difficulty: '',
    tags: '',
    scoringRubric: ''
  })

  const loadTemplates = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filters.problemType !== 'all' && { problemType: filters.problemType })
      })
      const response = await apiFetch(`/api/platform/templates?${params}`)
      setTemplates(response.data || [])
      setPagination(response.pagination)
    } catch (err) {
      console.error(err)
      toast.error('加载失败')
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [page, pageSize, debouncedSearch, filters])

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      requirements: '',
      workDirTemplate: 'templates/default',
      duration: 60,
      problemType: 'FEATURE_DEV',
      difficulty: '',
      tags: '',
      scoringRubric: ''
    })
  }

  const handleCreate = () => {
    setEditingTemplate(null)
    resetForm()
    setDialogOpen(true)
  }

  const handleEdit = (t: ProblemTemplateResponse) => {
    setEditingTemplate(t)
    setForm({
      title: t.title,
      description: t.description,
      requirements: t.requirements,
      workDirTemplate: t.workDirTemplate,
      duration: t.duration,
      problemType: t.problemType,
      difficulty: t.difficulty || '',
      tags: t.tags?.join(', ') || '',
      scoringRubric: t.scoringRubric || '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const body: any = {
        title: form.title,
        description: form.description,
        requirements: form.requirements,
        workDirTemplate: form.workDirTemplate,
        duration: form.duration,
        problemType: form.problemType,
        scoringCriteria: {},
        difficulty: form.difficulty || undefined,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        scoringRubric: form.scoringRubric || undefined
      }

      if (editingTemplate) {
        await apiFetch(`/api/platform/templates/${editingTemplate.id}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        })
        toast.success('模板更新成功')
      } else {
        await apiFetch('/api/platform/templates', {
          method: 'POST',
          body: JSON.stringify(body)
        })
        toast.success('模板创建成功')
      }
      setDialogOpen(false)
      loadTemplates()
    } catch (err) {
      console.error(err)
      toast.error('操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    try {
      await apiFetch(`/api/platform/templates/${deletingId}`, { method: 'DELETE' })
      toast.success('模板已停用')
      loadTemplates()
    } catch (err) {
      console.error(err)
      toast.error('操作失败')
    } finally {
      setDeletingId(null)
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
        meta="Platform Templates"
        title="模板管理"
        description="管理平台级题目模板，供所有组织使用。"
        actions={<Button onClick={handleCreate}>新建模板</Button>}
      />

      <Card>
        <CardContent className="pt-5">
          <div className="flex gap-3 mb-4">
            <Input
              placeholder="搜索模板标题或描述..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="max-w-sm"
            />
            <Select
              value={filters.problemType}
              onValueChange={(v) => setFilters({ ...filters, problemType: v })}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="题目类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(PROBLEM_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>难度</TableHead>
                <TableHead>时长</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    暂无模板
                  </TableCell>
                </TableRow>
              ) : (
                templates.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{t.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{PROBLEM_TYPE_LABELS[t.problemType] || t.problemType}</Badge>
                    </TableCell>
                    <TableCell>{t.difficulty || '-'}</TableCell>
                    <TableCell>{t.duration} 分钟</TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? 'default' : 'secondary'}>
                        {t.isActive ? '启用' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(t)}>编辑</Button>
                      {t.isActive && (
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(t.id)}>停用</Button>
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
              onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? '编辑模板' : '新建模板'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">标题</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div>
              <label className="text-sm font-medium">描述</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>

            <div>
              <label className="text-sm font-medium">要求</label>
              <Textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={3} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">题目类型</label>
                <Select value={form.problemType} onValueChange={(v) => setForm({ ...form, problemType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROBLEM_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">时长（分钟）</label>
                <Input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 60 })} />
              </div>
              <div>
                <label className="text-sm font-medium">工作目录模板</label>
                <Input value={form.workDirTemplate} onChange={(e) => setForm({ ...form, workDirTemplate: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">难度</label>
                <Select value={form.difficulty || 'none'} onValueChange={(v) => setForm({ ...form, difficulty: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="选择难度" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未设置</SelectItem>
                    <SelectItem value="Easy">简单</SelectItem>
                    <SelectItem value="Medium">中等</SelectItem>
                    <SelectItem value="Hard">困难</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">标签（逗号分隔）</label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">评分细则</label>
              <Textarea value={form.scoringRubric} onChange={(e) => setForm({ ...form, scoringRubric: e.target.value })} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '处理中...' : (editingTemplate ? '保存' : '创建')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="确认停用"
        description="确定要停用这个模板吗？停用后组织用户将无法看到此模板。"
        onConfirm={confirmDelete}
        confirmText="停用"
        variant="destructive"
      />
    </div>
  )
}

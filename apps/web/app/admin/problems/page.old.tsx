'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    duration: 60,
    workDirTemplate: '/tmp/interview',
    scoringCriteria: {}
  })

  const loadProblems = () => {
    fetch('http://localhost:3001/api/admin/problems')
      .then(res => res.json())
      .then(data => {
        setProblems(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadProblems()
  }, [])

  const handleCreate = () => {
    setEditingProblem(null)
    setFormData({
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
    setFormData({
      title: problem.title,
      description: problem.description,
      requirements: problem.requirements,
      duration: problem.duration,
      workDirTemplate: problem.workDirTemplate,
      scoringCriteria: {}
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingProblem
        ? `http://localhost:3001/api/admin/problems/${editingProblem.id}`
        : 'http://localhost:3001/api/admin/problems'

      const method = editingProblem ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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
    }
  }

  if (loading) return <div>加载中...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">题目管理</h1>
        <Button onClick={handleCreate}>新建题目</Button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="border-b">
            <tr>
              <th className="text-left p-4">标题</th>
              <th className="text-left p-4">时长</th>
              <th className="text-left p-4">创建时间</th>
              <th className="text-left p-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {problems.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">
                  暂无题目，点击"新建题目"创建第一个题目
                </td>
              </tr>
            ) : (
              problems.map(problem => (
                <tr key={problem.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">{problem.title}</td>
                  <td className="p-4">{problem.duration} 分钟</td>
                  <td className="p-4">{new Date(problem.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(problem)}>
                      编辑
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(problem.id)}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingProblem ? '编辑题目' : '新建题目'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">题目描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="requirements">要求</Label>
                <Textarea
                  id="requirements"
                  value={formData.requirements}
                  onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                  required
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="duration">时长（分钟）</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  required
                  min={1}
                />
              </div>

              <div>
                <Label htmlFor="workDir">工作目录模板</Label>
                <Input
                  id="workDir"
                  value={formData.workDirTemplate}
                  onChange={e => setFormData({ ...formData, workDirTemplate: e.target.value })}
                  required
                  placeholder="/tmp/interview"
                />
              </div>
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

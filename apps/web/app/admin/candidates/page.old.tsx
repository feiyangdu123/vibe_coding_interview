'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

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
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })

  const loadCandidates = () => {
    fetch('http://localhost:3001/api/admin/candidates')
      .then(res => res.json())
      .then(data => {
        setCandidates(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadCandidates()
  }, [])

  const handleCreate = () => {
    setEditingCandidate(null)
    setFormData({ name: '', email: '', phone: '' })
    setDialogOpen(true)
  }

  const handleEdit = (candidate: Candidate) => {
    setEditingCandidate(candidate)
    setFormData({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone || ''
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingCandidate
        ? `http://localhost:3001/api/admin/candidates/${editingCandidate.id}`
        : 'http://localhost:3001/api/admin/candidates'

      const method = editingCandidate ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || undefined
        })
      })

      if (res.ok) {
        setDialogOpen(false)
        loadCandidates()
        toast.success(editingCandidate ? '候选人更新成功' : '候选人创建成功')
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
    setDeletingCandidateId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingCandidateId) return

    try {
      const res = await fetch(`http://localhost:3001/api/admin/candidates/${deletingCandidateId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        loadCandidates()
        toast.success('候选人删除成功')
      } else {
        const error = await res.json()
        toast.error(error.error || '删除失败')
      }
    } catch (err) {
      console.error(err)
      toast.error('删除失败')
    } finally {
      setDeletingCandidateId(null)
    }
  }

  if (loading) return <div>加载中...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">候选人管理</h1>
        <Button onClick={handleCreate}>添加候选人</Button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="border-b">
            <tr>
              <th className="text-left p-4">姓名</th>
              <th className="text-left p-4">邮箱</th>
              <th className="text-left p-4">电话</th>
              <th className="text-left p-4">创建时间</th>
              <th className="text-left p-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  暂无候选人，点击"添加候选人"创建第一个候选人
                </td>
              </tr>
            ) : (
              candidates.map(candidate => (
                <tr key={candidate.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">{candidate.name}</td>
                  <td className="p-4">{candidate.email}</td>
                  <td className="p-4">{candidate.phone || '-'}</td>
                  <td className="p-4">{new Date(candidate.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(candidate)}>
                      编辑
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(candidate.id)}>
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
              <DialogTitle>{editingCandidate ? '编辑候选人' : '添加候选人'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">电话（可选）</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
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
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="确认删除"
        description="确定要删除这个候选人吗？如果该候选人有关联的面试，将无法删除。"
        onConfirm={confirmDelete}
        confirmText="删除"
        variant="destructive"
      />
    </div>
  )
}

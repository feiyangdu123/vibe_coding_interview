'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface Interview {
  id: string
  token: string
  status: string
  createdAt: string
  candidate: {
    name: string
    email: string
  }
  problem: {
    title: string
    duration: number
  }
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

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingInterviewId, setDeletingInterviewId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    candidateId: '',
    problemId: '',
    duration: 60
  })

  const loadInterviews = () => {
    fetch('/api/admin/interviews')
      .then(res => res.json())
      .then(data => {
        setInterviews(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadInterviews()

    // Load candidates and problems for the form
    fetch('/api/admin/candidates')
      .then(res => res.json())
      .then(data => setCandidates(data))
      .catch(err => console.error(err))

    fetch('/api/admin/problems')
      .then(res => res.json())
      .then(data => setProblems(data))
      .catch(err => console.error(err))
  }, [])

  const handleCreate = () => {
    setFormData({
      candidateId: '',
      problemId: '',
      duration: 60
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.candidateId || !formData.problemId) {
      toast.error('请选择候选人和题目')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/admin/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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

  const handleDelete = async (id: string) => {
    setDeletingInterviewId(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingInterviewId) return

    try {
      const res = await fetch(`/api/admin/interviews/${deletingInterviewId}`, {
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
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800'
    }
    const labels = {
      pending: '待开始',
      in_progress: '进行中',
      completed: '已完成',
      expired: '已过期'
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[status as keyof typeof colors]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  if (loading) return <div>加载中...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">面试管理</h1>
        <Button onClick={handleCreate}>创建面试</Button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="border-b">
            <tr>
              <th className="text-left p-4">候选人</th>
              <th className="text-left p-4">题目</th>
              <th className="text-left p-4">状态</th>
              <th className="text-left p-4">创建时间</th>
              <th className="text-left p-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {interviews.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  暂无面试，点击"创建面试"创建第一个面试
                </td>
              </tr>
            ) : (
              interviews.map(interview => (
                <tr key={interview.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">{interview.candidate.name}</td>
                  <td className="p-4">{interview.problem.title}</td>
                  <td className="p-4">{getStatusBadge(interview.status)}</td>
                  <td className="p-4">{new Date(interview.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(interview.token)}
                    >
                      复制链接
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(interview.id)}
                    >
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
              <DialogTitle>创建面试</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="candidate">选择候选人</Label>
                <select
                  id="candidate"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.candidateId}
                  onChange={e => setFormData({ ...formData, candidateId: e.target.value })}
                  required
                >
                  <option value="">请选择候选人</option>
                  {candidates.map(candidate => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} ({candidate.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="problem">选择题目</Label>
                <select
                  id="problem"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.problemId}
                  onChange={e => {
                    const problem = problems.find(p => p.id === e.target.value)
                    setFormData({
                      ...formData,
                      problemId: e.target.value,
                      duration: problem?.duration || 60
                    })
                  }}
                  required
                >
                  <option value="">请选择题目</option>
                  {problems.map(problem => (
                    <option key={problem.id} value={problem.id}>
                      {problem.title} ({problem.duration} 分钟)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>面试时长</Label>
                <div className="text-sm text-gray-600 mt-1">
                  {formData.duration} 分钟（根据题目自动设置）
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '处理中...' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="确认删除"
        description="确定要删除这个面试吗？如果面试正在进行中，OpenCode 进程将被停止。此操作无法撤销。"
        onConfirm={confirmDelete}
        confirmText="删除"
        variant="destructive"
      />
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CandidateWorkspacePanelProps {
  problemTitle: string
  problemDescription: string
  problemRequirements: string
  candidateName: string
  endTime: string
  workspaceUrl?: string
  token: string
  onSubmit: () => void
}

export function CandidateWorkspacePanel({
  problemTitle,
  problemDescription,
  problemRequirements,
  candidateName,
  endTime,
  workspaceUrl,
  token,
  onSubmit
}: CandidateWorkspacePanelProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = new Date(endTime).getTime() - Date.now()
      if (diff <= 0) {
        setTimeRemaining(0)
        clearInterval(interval)
      } else {
        setTimeRemaining(diff)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [endTime])

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/interview/${token}/submit`, {
        method: 'POST'
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`提交失败: ${data.error || '未知错误'}`)
        setSubmitting(false)
        return
      }
      onSubmit()
    } catch (err) {
      console.error('Submit error:', err)
      alert('提交失败，请重试')
      setSubmitting(false)
    }
  }, [token, onSubmit])

  const isTimeWarning = timeRemaining > 0 && timeRemaining < 5 * 60 * 1000 // less than 5 minutes

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-white px-6 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2">
              <Badge variant="info">进行中</Badge>
            </div>
            <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-slate-950">{problemTitle}</h1>
            <p className="mt-2 text-sm text-slate-500">候选人：{candidateName}</p>
          </div>
          <div
            className={`inline-flex items-center rounded-lg border px-4 py-2 font-mono text-2xl font-bold ${
              isTimeWarning
                ? 'border-red-200 bg-red-50 text-red-600'
                : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}
          >
            {timeRemaining > 0 ? formatTime(timeRemaining) : '时间已到'}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>作答说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h2 className="mb-2 text-base font-semibold text-slate-950">题目描述</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{problemDescription}</p>
            </div>

            <div>
              <h2 className="mb-2 text-base font-semibold text-slate-950">要求</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{problemRequirements}</p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {workspaceUrl && (
                <Button
                  size="lg"
                  onClick={() => window.open(workspaceUrl, '_blank', 'noopener,noreferrer')}
                >
                  打开编程环境
                </Button>
              )}
              <Button
                size="lg"
                variant="destructive"
                onClick={() => setShowConfirm(true)}
                disabled={submitting}
              >
                {submitting ? '提交中...' : '提交面试'}
              </Button>
            </div>

              {showConfirm && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-3 font-semibold text-amber-800">确认提交？</p>
                <p className="mb-4 text-sm text-amber-800/80">
                  提交后面试将立即结束，编程环境将关闭，无法再继续作答。
                </p>
                <div className="flex gap-3">
                  <Button variant="destructive" onClick={handleSubmit} disabled={submitting}>
                    确认提交
                  </Button>
                  <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={submitting}>
                    继续作答
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

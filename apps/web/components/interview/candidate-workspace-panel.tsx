'use client'

import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface CandidateWorkspacePanelProps {
  problemTitle: string
  problemDescription: string
  problemRequirements: string
  candidateName: string
  positionName?: string
  endTime: string
  workspaceUrl?: string
  token: string
  workDir?: string
  onSubmit: () => void
}

export function CandidateWorkspacePanel({
  problemTitle,
  candidateName,
  positionName,
  endTime,
  workspaceUrl,
  token,
  workDir,
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
      const res = await fetch(`${API_BASE}/api/interview/${token}/submit`, {
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

  const isTimeWarning = timeRemaining > 0 && timeRemaining < 5 * 60 * 1000

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white">
            面试进行中
          </div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-slate-950">
            {problemTitle}
          </h1>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {candidateName}
            </Badge>
            {positionName && (
              <Badge variant="outline" className="text-sm px-3 py-1">
                {positionName}
              </Badge>
            )}
          </div>
        </div>

        {/* 倒计时 */}
        <div className="flex justify-center">
          <div
            className={`inline-flex items-center rounded-xl border px-8 py-4 font-mono text-4xl font-bold ${
              isTimeWarning
                ? 'border-red-200 bg-red-50 text-red-600'
                : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}
          >
            {timeRemaining > 0 ? formatTime(timeRemaining) : '时间已到'}
          </div>
        </div>

        {/* 提示信息 */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6 space-y-3">
            <ol className="space-y-3 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                <span>题目在编程环境的 <strong className="text-slate-900 font-mono bg-blue-100 px-1.5 py-0.5 rounded">题目与要求.md</strong> 文件中</span>
              </li>
              {workDir && (
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
                  <span>请在工作目录 <code className="font-mono bg-blue-100 px-1.5 py-0.5 rounded text-slate-900 text-xs">{workDir}</code> 下开发</span>
                </li>
              )}
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{workDir ? '3' : '2'}</span>
                <span>完成后回到此页面点击<strong className="text-slate-900">"提交面试"</strong></span>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex justify-center gap-4 pt-4">
          {workspaceUrl && (
            <Button
              size="lg"
              className="px-10 py-6 text-base font-semibold bg-blue-600 hover:bg-blue-700"
              onClick={() => window.open(workspaceUrl, '_blank', 'noopener,noreferrer')}
            >
              打开编程环境
            </Button>
          )}
          <Button
            size="lg"
            variant="destructive"
            className="px-10 py-6 text-base font-semibold"
            onClick={() => setShowConfirm(true)}
            disabled={submitting}
          >
            {submitting ? '提交中...' : '提交面试'}
          </Button>
        </div>

        {/* 确认提交 */}
        {showConfirm && (
          <div className="mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="mb-2 font-semibold text-amber-800">确认提交？</p>
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
      </div>
    </div>
  )
}

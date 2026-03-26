'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InterviewEventsTimeline } from '@/components/interview/interview-events-timeline'
import { PageHeader } from '@/components/admin/page-header'
import { apiFetch, triggerInterviewEvaluation } from '@/lib/api'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/clipboard'
import type { InterviewStatus, InterviewQuotaState } from '@vibe/shared-types'

interface Interview {
  id: string
  token: string
  status: InterviewStatus
  scheduledStartAt?: string
  joinDeadlineAt?: string
  startTime?: string
  endTime?: string
  cancelledAt?: string
  submittedAt?: string
  endReason?: string
  quotaState?: InterviewQuotaState
  duration: number
  port?: number
  processId?: number
  healthStatus?: string
  processError?: string
  candidate: {
    name: string
    email: string
    phone?: string
  }
  problem: {
    title: string
    duration: number
  }
  problemSnapshot?: {
    positionName?: string
    difficulty?: string
  }
  interviewer?: {
    username: string
  }
  aiEvaluationStatus?: string
  aiEvaluationScore?: number | null
}

const statusConfig = {
  PENDING: { label: '待开始', variant: 'warning' as const },
  IN_PROGRESS: { label: '进行中', variant: 'info' as const },
  COMPLETED: { label: '已完成', variant: 'success' as const },
  EXPIRED: { label: '已过期', variant: 'default' as const },
  CANCELLED: { label: '已取消', variant: 'default' as const },
  SUBMITTED: { label: '已提交', variant: 'success' as const }
}

const quotaStateConfig = {
  RESERVED: { label: '预占中', variant: 'warning' as const },
  CONSUMED: { label: '已扣减', variant: 'success' as const },
  RELEASED: { label: '已释放', variant: 'default' as const }
}

const endReasonLabel: Record<string, string> = {
  CANDIDATE_SUBMIT: '候选人提交',
  TIME_UP: '时间到',
  INTERVIEWER_STOP: '面试官结束',
  SYSTEM_ERROR: '系统错误',
  CANCELLED_BY_ORG: '管理员取消',
  CANDIDATE_NO_SHOW: '候选人未到场'
}

export default function InterviewDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [ending, setEnding] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [triggeringEvaluation, setTriggeringEvaluation] = useState(false)

  const fetchInterview = async () => {
    try {
      const data = await apiFetch(`/api/admin/interviews/${id}`)
      setInterview(data)
    } catch (error) {
      console.error('Failed to fetch interview:', error)
      toast.error('加载面试详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInterview()
  }, [id])

  useEffect(() => {
    if (!interview?.endTime || interview.status !== 'IN_PROGRESS') return

    const interval = setInterval(() => {
      const diff = new Date(interview.endTime!).getTime() - Date.now()
      if (diff <= 0) {
        setTimeRemaining(0)
        clearInterval(interval)
      } else {
        setTimeRemaining(diff)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [interview])

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const copyLink = () => {
    const link = `${window.location.origin}/interview/${interview?.token}`
    copyToClipboard(link)
    toast.success('面试链接已复制')
  }

  const handleEndInterview = async () => {
    if (!confirm('确认结束面试？此操作将立即停止候选人的编程环境。')) {
      return
    }

    setEnding(true)
    try {
      const updatedInterview = await apiFetch(`/api/admin/interviews/${id}/end`, { method: 'POST' })
      setInterview({
        ...updatedInterview,
        aiEvaluationStatus: 'running'
      })
      toast.success('面试已结束，AI 评估已开始')
    } catch (error) {
      console.error('Failed to end interview:', error)
      toast.error('结束面试失败')
    } finally {
      setEnding(false)
    }
  }

  const handleTriggerEvaluation = async () => {
    if (!interview || interview.status !== 'COMPLETED') {
      return
    }

    setTriggeringEvaluation(true)
    try {
      await triggerInterviewEvaluation(id)
      setInterview(prev => prev ? { ...prev, aiEvaluationStatus: 'running' } : prev)
      toast.success('AI 评估已开始')
    } catch (error) {
      console.error('Failed to trigger evaluation:', error)
      toast.error(error instanceof Error ? error.message : '触发 AI 评估失败')
    } finally {
      setTriggeringEvaluation(false)
    }
  }

  const handleCancelInterview = async () => {
    if (!confirm('确认取消这场待开始的面试吗？取消后会释放预占的面试配额。')) {
      return
    }

    setCancelling(true)
    try {
      const updatedInterview = await apiFetch(`/api/admin/interviews/${id}/cancel`, { method: 'POST' })
      setInterview(updatedInterview)
      toast.success('面试已取消，预占配额已释放')
    } catch (error) {
      console.error('Failed to cancel interview:', error)
      toast.error(error instanceof Error ? error.message : '取消面试失败')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">面试不存在</div>
      </div>
    )
  }

  const isTimeWarning = timeRemaining > 0 && timeRemaining < 5 * 60 * 1000
  const canTriggerEvaluation = interview.status === 'COMPLETED'
  const isEvaluationRunning = interview.aiEvaluationStatus === 'running'
  const evaluationStatusLabel =
    interview.aiEvaluationStatus === 'completed'
      ? interview.aiEvaluationScore !== null && interview.aiEvaluationScore !== undefined
        ? `已完成 ${interview.aiEvaluationScore.toFixed(1)}/100`
        : '已完成'
      : interview.aiEvaluationStatus === 'running'
        ? '评估中'
        : interview.aiEvaluationStatus === 'failed'
          ? '评估失败'
          : '未评估'

  return (
    <div className="console-page max-w-6xl">
      <PageHeader
        meta="Interview Detail"
        title={interview.problem.title}
        description={`候选人 ${interview.candidate.name} · ${interview.candidate.email}${interview.problemSnapshot?.positionName ? ` · ${interview.problemSnapshot.positionName}` : ''}`}
        actions={
          <>
            <Badge variant={statusConfig[interview.status].variant}>
              {statusConfig[interview.status].label}
            </Badge>
            <Button variant="outline" onClick={() => router.push('/admin/interviews')}>
              返回列表
            </Button>
          </>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="mb-2 text-xl">{interview.problem.title}</CardTitle>
              <div className="space-y-1 text-sm text-gray-600">
                <div>候选人: {interview.candidate.name} ({interview.candidate.email})</div>
                {interview.problemSnapshot?.positionName && (
                  <div>职位: {interview.problemSnapshot.positionName}</div>
                )}
                {interview.interviewer && <div>面试官: {interview.interviewer.username}</div>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {interview.status === 'IN_PROGRESS' && (
                <div
                  className={`text-2xl font-mono font-bold px-4 py-2 rounded-lg ${
                    isTimeWarning
                      ? 'text-red-600 bg-red-50 border border-red-200'
                      : 'text-primary bg-blue-50 border border-blue-200'
                  }`}
                >
                  {timeRemaining > 0 ? formatTime(timeRemaining) : '时间已到'}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-600">时长</div>
              <div className="font-medium">{interview.duration} 分钟</div>
            </div>
            {interview.startTime && (
              <div>
                <div className="text-sm text-gray-600">开始时间</div>
                <div className="font-medium">{new Date(interview.startTime).toLocaleString('zh-CN')}</div>
              </div>
            )}
            {interview.scheduledStartAt && (
              <div>
                <div className="text-sm text-gray-600">预约开始</div>
                <div className="font-medium">{new Date(interview.scheduledStartAt).toLocaleString('zh-CN')}</div>
              </div>
            )}
            {interview.joinDeadlineAt && (
              <div>
                <div className="text-sm text-gray-600">最晚入场</div>
                <div className="font-medium">{new Date(interview.joinDeadlineAt).toLocaleString('zh-CN')}</div>
              </div>
            )}
            {interview.submittedAt && (
              <div>
                <div className="text-sm text-gray-600">提交时间</div>
                <div className="font-medium">{new Date(interview.submittedAt).toLocaleString('zh-CN')}</div>
              </div>
            )}
            {interview.cancelledAt && (
              <div>
                <div className="text-sm text-gray-600">取消时间</div>
                <div className="font-medium">{new Date(interview.cancelledAt).toLocaleString('zh-CN')}</div>
              </div>
            )}
            {interview.endReason && (
              <div>
                <div className="text-sm text-gray-600">结束原因</div>
                <div className="font-medium">{endReasonLabel[interview.endReason] || interview.endReason}</div>
              </div>
            )}
            {interview.quotaState && (
              <div>
                <div className="text-sm text-gray-600">配额结算</div>
                <div className="font-medium">{quotaStateConfig[interview.quotaState].label}</div>
              </div>
            )}
          </div>

          {interview.healthStatus === 'unhealthy' && interview.processError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="text-red-800 font-semibold">进程错误</div>
              <div className="text-red-700 text-sm">{interview.processError}</div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={copyLink}>
              复制面试链接
            </Button>
            {interview.status === 'PENDING' && (
              <Button variant="destructive" onClick={handleCancelInterview} disabled={cancelling}>
                {cancelling ? '取消中...' : '取消面试'}
              </Button>
            )}
            {interview.status === 'IN_PROGRESS' && (
              <Button variant="destructive" onClick={handleEndInterview} disabled={ending}>
                {ending ? '结束中...' : '结束面试'}
              </Button>
            )}
            {canTriggerEvaluation && (
              <Button
                variant="outline"
                onClick={handleTriggerEvaluation}
                disabled={triggeringEvaluation || isEvaluationRunning}
              >
                {triggeringEvaluation || isEvaluationRunning
                  ? 'AI 评估中...'
                  : interview.aiEvaluationStatus === 'completed'
                    ? '重新触发 AI 评估'
                    : '触发 AI 评估'}
              </Button>
            )}
            <div className="flex items-center text-sm text-muted-foreground">
              AI 评估状态: {interview.status === 'COMPLETED' ? evaluationStatusLabel : '面试结束后自动触发'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>面试事件时间线</CardTitle>
        </CardHeader>
        <CardContent>
          <InterviewEventsTimeline interviewId={id} isInProgress={interview.status === 'IN_PROGRESS'} />
        </CardContent>
      </Card>
    </div>
  )
}

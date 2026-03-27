'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/admin/page-header'
import { MetricCard } from '@/components/admin/metric-card'
import { AiEvaluationPanel } from '@/components/review/ai-evaluation-panel'
import { AiRunHistoryPanel } from '@/components/review/ai-run-history-panel'
import { ChatHistoryPanel } from '@/components/review/chat-history-panel'
import { EventTimelinePanel } from '@/components/review/event-timeline-panel'
import { ReviewDecisionForm } from '@/components/review/review-decision-form'
import { apiFetch, triggerInterviewEvaluation } from '@/lib/api'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/clipboard'
import { Star, Clock, Play, AlertTriangle, CheckCircle, Timer, ChevronDown, Loader2 } from 'lucide-react'
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
  aiEvaluationDetails?: string
  currentAiRunId?: string
  manualReviewStatus?: string
  finalDecision?: string
}

interface AiEvaluationRun {
  id: string
  version: number
  status: string
  score?: number
  details?: any
  rawOutput?: string
  startedAt: string
  completedAt?: string
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

function parseDetails(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return { totalScore: 0, dimensions: [], summary: raw }
  }
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

  // AI Evaluation state (ported from review page)
  const [evaluationHistory, setEvaluationHistory] = useState<AiEvaluationRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [rawOutput, setRawOutput] = useState<string | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluatingError, setEvaluatingError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [currentDetails, setCurrentDetails] = useState<string | null>(null)
  const [currentScore, setCurrentScore] = useState<number | undefined>(undefined)

  const loadData = useCallback(async () => {
    try {
      const [interviewData, historyData, evaluationData] = await Promise.all([
        apiFetch(`/api/admin/interviews/${id}`),
        apiFetch(`/api/admin/interviews/${id}/evaluation-history`).catch(() => []),
        apiFetch(`/api/admin/interviews/${id}/evaluation`).catch(() => null)
      ])

      setInterview(interviewData)
      setEvaluationHistory(historyData)
      setSelectedRunId(interviewData.currentAiRunId || null)
      setRawOutput(evaluationData?.rawOutput || null)
      setCurrentDetails(interviewData.aiEvaluationDetails || null)
      setCurrentScore(interviewData.aiEvaluationScore ?? undefined)
      setIsEvaluating(interviewData.aiEvaluationStatus === 'running')
    } catch (error) {
      console.error('Failed to fetch interview:', error)
      toast.error('加载面试详情失败')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Countdown timer for in-progress interviews
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

  // Poll when evaluating
  useEffect(() => {
    if (!isEvaluating) return
    const interval = setInterval(() => {
      loadData()
    }, 5000)
    return () => clearInterval(interval)
  }, [isEvaluating, loadData])

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
    if (!confirm('确认结束面试？此操作将立即停止候选人的编程环境。')) return

    setEnding(true)
    try {
      const updatedInterview = await apiFetch(`/api/admin/interviews/${id}/end`, { method: 'POST' })
      setInterview(prev => prev ? { ...prev, ...updatedInterview, aiEvaluationStatus: 'running' } : prev)
      setIsEvaluating(true)
      toast.success('面试已结束，AI 评估已开始')
    } catch (error) {
      console.error('Failed to end interview:', error)
      toast.error('结束面试失败')
    } finally {
      setEnding(false)
    }
  }

  const handleReEvaluate = useCallback(async () => {
    setEvaluatingError(null)
    try {
      await apiFetch(`/api/admin/interviews/${id}/evaluate`, { method: 'POST' })
      setIsEvaluating(true)
      toast.success('AI 评估已开始')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '触发评估失败'
      setEvaluatingError(msg)
      toast.error(msg)
    }
  }, [id])

  const handleCancelInterview = async () => {
    if (!confirm('确认取消这场待开始的面试吗？取消后会释放预占的面试配额。')) return

    setCancelling(true)
    try {
      const updatedInterview = await apiFetch(`/api/admin/interviews/${id}/cancel`, { method: 'POST' })
      setInterview(prev => prev ? { ...prev, ...updatedInterview } : updatedInterview)
      toast.success('面试已取消，预占配额已释放')
    } catch (error) {
      console.error('Failed to cancel interview:', error)
      toast.error(error instanceof Error ? error.message : '取消面试失败')
    } finally {
      setCancelling(false)
    }
  }

  const handleSelectRun = useCallback((runId: string) => {
    setSelectedRunId(runId)
    const run = evaluationHistory.find(r => r.id === runId)
    if (run) {
      setRawOutput(run.rawOutput || null)
      if (run.details) {
        setCurrentDetails(typeof run.details === 'string' ? run.details : JSON.stringify(run.details))
        setCurrentScore(run.score ?? undefined)
      }
    }
  }, [evaluationHistory])

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
  const canTriggerEvaluation = interview.status === 'COMPLETED' && !isEvaluating
  const hasMultipleRuns = evaluationHistory.length > 1

  // Compute duration display
  const durationDisplay = (() => {
    if (interview.startTime && (interview.submittedAt || interview.endTime)) {
      const start = new Date(interview.startTime).getTime()
      const end = new Date(interview.submittedAt || interview.endTime!).getTime()
      const mins = Math.round((end - start) / 60000)
      return `${mins} 分钟`
    }
    return `${interview.duration} 分钟`
  })()

  const aiScoreDisplay = currentScore ?? interview.aiEvaluationScore

  return (
    <div className="console-page max-w-7xl">
      {/* Page Header */}
      <PageHeader
        meta="Interview Detail"
        title={interview.problem.title}
        description={`${interview.candidate.name} · ${interview.candidate.email}${interview.problemSnapshot?.positionName ? ` · ${interview.problemSnapshot.positionName}` : ''}`}
        actions={
          <>
            <Badge variant={statusConfig[interview.status].variant}>
              {statusConfig[interview.status].label}
            </Badge>
            {interview.finalDecision && (
              <Badge variant={
                interview.finalDecision === 'pass' ? 'success' :
                interview.finalDecision === 'fail' ? 'error' : 'warning'
              }>
                {interview.finalDecision === 'pass' ? '通过' :
                 interview.finalDecision === 'fail' ? '不通过' : '待定'}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={copyLink}>
              复制链接
            </Button>
            {interview.status === 'PENDING' && (
              <Button variant="destructive" size="sm" onClick={handleCancelInterview} disabled={cancelling}>
                {cancelling ? '取消中...' : '取消面试'}
              </Button>
            )}
            {interview.status === 'IN_PROGRESS' && (
              <Button variant="destructive" size="sm" onClick={handleEndInterview} disabled={ending}>
                {ending ? '结束中...' : '结束面试'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push('/admin/interviews')}>
              返回列表
            </Button>
          </>
        }
      />

      {/* Metric Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 mt-6">
        {/* AI Score or Countdown */}
        {interview.status === 'IN_PROGRESS' ? (
          <MetricCard
            label="剩余时间"
            value={timeRemaining > 0 ? formatTime(timeRemaining) : '时间已到'}
            icon={Timer}
            tone={isTimeWarning ? 'warning' : 'default'}
          />
        ) : (
          <MetricCard
            label="AI 评分"
            value={
              isEvaluating ? '评估中...'
              : aiScoreDisplay != null ? `${aiScoreDisplay.toFixed(1)}`
              : interview.aiEvaluationStatus === 'failed' ? '失败'
              : '-'
            }
            description={aiScoreDisplay != null ? '/100' : undefined}
            icon={Star}
            tone={
              aiScoreDisplay != null
                ? (aiScoreDisplay >= 70 ? 'success' : aiScoreDisplay >= 50 ? 'warning' : 'default')
                : 'default'
            }
          />
        )}

        <MetricCard
          label="面试时长"
          value={durationDisplay}
          description={`设定 ${interview.duration} 分钟`}
          icon={Clock}
          tone="default"
        />

        <MetricCard
          label="开始时间"
          value={interview.startTime
            ? new Date(interview.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
            : '未开始'
          }
          description={interview.startTime
            ? new Date(interview.startTime).toLocaleDateString('zh-CN')
            : interview.scheduledStartAt
              ? `预约 ${new Date(interview.scheduledStartAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
              : undefined
          }
          icon={Play}
          tone="default"
        />

        <MetricCard
          label="结束原因"
          value={interview.endReason ? (endReasonLabel[interview.endReason] || interview.endReason) : '-'}
          icon={AlertTriangle}
          tone={interview.endReason === 'SYSTEM_ERROR' ? 'warning' : 'default'}
        />

        <MetricCard
          label="配额状态"
          value={interview.quotaState ? quotaStateConfig[interview.quotaState].label : '-'}
          icon={CheckCircle}
          tone={interview.quotaState === 'CONSUMED' ? 'success' : interview.quotaState === 'RESERVED' ? 'warning' : 'default'}
        />
      </div>

      {/* Two-column Layout */}
      <div className="grid gap-6 xl:grid-cols-5 mt-6">
        {/* Left 3/5 */}
        <div className="space-y-6 xl:col-span-3">
          {/* Candidate Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>候选人信息</CardTitle>
            </CardHeader>
            <CardContent>
              {interview.healthStatus === 'unhealthy' && interview.processError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <div className="text-red-800 font-semibold text-sm">进程错误</div>
                  <div className="text-red-700 text-sm">{interview.processError}</div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <div>
                  <div className="text-slate-500">姓名</div>
                  <div className="font-medium text-slate-900">{interview.candidate.name}</div>
                </div>
                <div>
                  <div className="text-slate-500">邮箱</div>
                  <div className="font-medium text-slate-900">{interview.candidate.email}</div>
                </div>
                {interview.candidate.phone && (
                  <div>
                    <div className="text-slate-500">电话</div>
                    <div className="font-medium text-slate-900">{interview.candidate.phone}</div>
                  </div>
                )}
                {interview.problemSnapshot?.positionName && (
                  <div>
                    <div className="text-slate-500">职位</div>
                    <div className="font-medium text-slate-900">{interview.problemSnapshot.positionName}</div>
                  </div>
                )}
                {interview.interviewer && (
                  <div>
                    <div className="text-slate-500">面试官</div>
                    <div className="font-medium text-slate-900">{interview.interviewer.username}</div>
                  </div>
                )}
                {interview.scheduledStartAt && (
                  <div>
                    <div className="text-slate-500">预约时间</div>
                    <div className="font-medium text-slate-900">{new Date(interview.scheduledStartAt).toLocaleString('zh-CN')}</div>
                  </div>
                )}
                {interview.joinDeadlineAt && (
                  <div>
                    <div className="text-slate-500">最晚入场</div>
                    <div className="font-medium text-slate-900">{new Date(interview.joinDeadlineAt).toLocaleString('zh-CN')}</div>
                  </div>
                )}
                {interview.submittedAt && (
                  <div>
                    <div className="text-slate-500">提交时间</div>
                    <div className="font-medium text-slate-900">{new Date(interview.submittedAt).toLocaleString('zh-CN')}</div>
                  </div>
                )}
                {interview.cancelledAt && (
                  <div>
                    <div className="text-slate-500">取消时间</div>
                    <div className="font-medium text-slate-900">{new Date(interview.cancelledAt).toLocaleString('zh-CN')}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabs: Events + Chat History */}
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="events">
                <TabsList>
                  <TabsTrigger value="events">事件概览</TabsTrigger>
                  <TabsTrigger value="chat">聊天记录</TabsTrigger>
                </TabsList>
                <TabsContent value="events">
                  <EventTimelinePanel interviewId={id} />
                </TabsContent>
                <TabsContent value="chat">
                  <ChatHistoryPanel interviewId={id} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-6 xl:col-span-2">
          {/* AI Evaluation Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>AI 评估结果</CardTitle>
              <div className="flex items-center gap-2">
                {canTriggerEvaluation && (
                  <Button variant="outline" size="sm" onClick={handleReEvaluate}>
                    {interview.aiEvaluationStatus === 'completed' ? '重新评估' : '触发评估'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEvaluating ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">AI 正在评估中，请稍候...</p>
                </div>
              ) : interview.aiEvaluationStatus === 'completed' && currentDetails ? (
                <AiEvaluationPanel details={parseDetails(currentDetails)} score={currentScore} rawOutput={rawOutput} />
              ) : interview.aiEvaluationStatus === 'failed' ? (
                <div className="text-red-600 text-sm">评估失败，请点击"重新评估"重试</div>
              ) : (
                <div className="text-gray-500 text-sm">
                  {interview.status === 'COMPLETED' ? '暂无评估结果' : '面试结束后自动触发'}
                </div>
              )}
              {evaluatingError && (
                <div className="text-red-600 text-sm mt-2">{evaluatingError}</div>
              )}

              {/* Evaluation history */}
              {hasMultipleRuns && (
                <div className="mt-6 pt-4 border-t">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                    查看评估记录 ({evaluationHistory.length})
                  </button>
                  {showHistory && (
                    <div className="mt-3">
                      <AiRunHistoryPanel
                        history={evaluationHistory}
                        selectedRunId={selectedRunId}
                        onSelectRun={handleSelectRun}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Decision Form */}
          {(interview.status === 'COMPLETED' || interview.finalDecision) && (
            <ReviewDecisionForm
              interviewId={id}
              currentDecision={interview.finalDecision}
              onSubmitSuccess={loadData}
            />
          )}
        </div>
      </div>
    </div>
  )
}

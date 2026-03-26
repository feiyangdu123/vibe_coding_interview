'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/admin/page-header'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { AiEvaluationPanel } from '@/components/review/ai-evaluation-panel'
import { AiRunHistoryPanel } from '@/components/review/ai-run-history-panel'
import { ChatHistoryPanel } from '@/components/review/chat-history-panel'
import { EventTimelinePanel } from '@/components/review/event-timeline-panel'
import { ReviewDecisionForm } from '@/components/review/review-decision-form'
import { EvaluationStreamPanel } from '@/components/review/evaluation-stream-panel'
import { ChevronDown, Wrench } from 'lucide-react'

interface Interview {
  id: string
  candidate: { name: string; email: string }
  problem: { title: string }
  status: string
  aiEvaluationStatus?: string
  aiEvaluationScore?: number
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
  startedAt: string
  completedAt?: string
}

function parseDetails(raw: string): any {
  try {
    return JSON.parse(raw)
  } catch {
    return { totalScore: 0, dimensions: [], summary: raw }
  }
}

export default function ReviewPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const interviewId = params.id as string
  const showDevToggle = searchParams.get('dev') === '1'

  const [interview, setInterview] = useState<Interview | null>(null)
  const [evaluationHistory, setEvaluationHistory] = useState<AiEvaluationRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [rawOutput, setRawOutput] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluatingError, setEvaluatingError] = useState<string | null>(null)
  const [devMode, setDevMode] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    loadData()
  }, [interviewId])

  const loadData = async () => {
    try {
      const [interviewData, historyData, evaluationData] = await Promise.all([
        apiFetch(`/api/admin/interviews/${interviewId}`),
        apiFetch(`/api/admin/interviews/${interviewId}/evaluation-history`),
        apiFetch(`/api/admin/interviews/${interviewId}/evaluation`).catch(() => null)
      ])

      setInterview(interviewData)
      setEvaluationHistory(historyData)
      setSelectedRunId(interviewData.currentAiRunId || null)
      setRawOutput(evaluationData?.rawOutput || null)
      setIsEvaluating(interviewData.aiEvaluationStatus === 'running')
      setLoading(false)
    } catch (err) {
      console.error(err)
      toast.error('加载失败')
      setLoading(false)
    }
  }

  const handleReEvaluate = useCallback(async () => {
    setEvaluatingError(null)
    try {
      await apiFetch(`/api/admin/interviews/${interviewId}/evaluate`, { method: 'POST' })
      setIsEvaluating(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '触发评估失败'
      setEvaluatingError(msg)
      toast.error(msg)
    }
  }, [interviewId])

  const handleEvaluationComplete = useCallback(() => {
    setIsEvaluating(false)
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">面试不存在</div>
      </div>
    )
  }

  const hasMultipleRuns = evaluationHistory.length > 1

  return (
    <div className="console-page">
      <PageHeader
        meta="Review Console"
        title="面试复核"
        description={`候选人：${interview.candidate.name} · 题目：${interview.problem.title}`}
        actions={interview.finalDecision ? (
          <Badge variant={
            interview.finalDecision === 'pass' ? 'success' :
            interview.finalDecision === 'fail' ? 'error' : 'warning'
          }>
            {interview.finalDecision === 'pass' ? '通过' :
             interview.finalDecision === 'fail' ? '不通过' : '待定'}
          </Badge>
        ) : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Left 2/3: AI Evaluation + Tabs */}
        <div className="space-y-6 xl:col-span-2">
          {/* Merged AI Evaluation Card (evaluation + history) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>AI 评估结果</CardTitle>
              <div className="flex items-center gap-2">
                {interview.status !== 'PENDING' && interview.status !== 'IN_PROGRESS' && !isEvaluating && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReEvaluate}
                  >
                    重新评估
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEvaluating ? (
                <EvaluationStreamPanel
                  interviewId={interviewId}
                  isRunning={true}
                  onComplete={handleEvaluationComplete}
                />
              ) : interview.aiEvaluationStatus === 'completed' && interview.aiEvaluationDetails ? (
                <AiEvaluationPanel details={parseDetails(interview.aiEvaluationDetails)} score={interview.aiEvaluationScore} rawOutput={rawOutput} />
              ) : interview.aiEvaluationStatus === 'failed' ? (
                <div className="text-red-600 text-sm">评估失败，请点击"重新评估"重试</div>
              ) : (
                <div className="text-gray-500">暂无评估结果</div>
              )}
              {evaluatingError && (
                <div className="text-red-600 text-sm mt-2">{evaluatingError}</div>
              )}

              {/* Inline evaluation history (only when multiple runs) */}
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
                        onSelectRun={setSelectedRunId}
                        devMode={devMode}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs: Event Overview + Chat History */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <div />
                {showDevToggle && (
                  <button
                    onClick={() => setDevMode(!devMode)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      devMode
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Wrench className="h-3 w-3" />
                    开发者模式
                  </button>
                )}
              </div>
              <Tabs defaultValue="events">
                <TabsList>
                  <TabsTrigger value="events">事件概览</TabsTrigger>
                  <TabsTrigger value="chat">聊天记录</TabsTrigger>
                </TabsList>
                <TabsContent value="events">
                  <EventTimelinePanel interviewId={interviewId} devMode={devMode} />
                </TabsContent>
                <TabsContent value="chat">
                  <ChatHistoryPanel interviewId={interviewId} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right 1/3: Review Decision Form */}
        <div className="xl:col-span-1">
          <ReviewDecisionForm
            interviewId={interviewId}
            currentDecision={interview.finalDecision}
            onSubmitSuccess={loadData}
          />
        </div>
      </div>
    </div>
  )
}

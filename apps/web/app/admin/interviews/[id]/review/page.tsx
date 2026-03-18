'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/admin/page-header'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { AiEvaluationPanel } from '@/components/review/ai-evaluation-panel'
import { AiRunHistoryPanel } from '@/components/review/ai-run-history-panel'
import { ChatHistoryPanel } from '@/components/review/chat-history-panel'
import { EventTimelinePanel } from '@/components/review/event-timeline-panel'
import { ReviewDecisionForm } from '@/components/review/review-decision-form'

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
  const interviewId = params.id as string

  const [interview, setInterview] = useState<Interview | null>(null)
  const [evaluationHistory, setEvaluationHistory] = useState<AiEvaluationRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [interviewId])

  const loadData = async () => {
    try {
      const [interviewData, historyData] = await Promise.all([
        apiFetch(`/api/admin/interviews/${interviewId}`),
        apiFetch(`/api/admin/interviews/${interviewId}/evaluation-history`)
      ])

      setInterview(interviewData)
      setEvaluationHistory(historyData)
      setSelectedRunId(interviewData.currentAiRunId || null)
      setLoading(false)
    } catch (err) {
      console.error(err)
      toast.error('加载失败')
      setLoading(false)
    }
  }

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
        {/* Left 2/3: AI Evaluation + History + Tabs */}
        <div className="space-y-6 xl:col-span-2">
          {/* AI Evaluation Panel */}
          <Card>
            <CardHeader>
              <CardTitle>AI 评估结果</CardTitle>
            </CardHeader>
            <CardContent>
              {interview.aiEvaluationStatus === 'completed' && interview.aiEvaluationDetails ? (
                <AiEvaluationPanel details={parseDetails(interview.aiEvaluationDetails)} score={interview.aiEvaluationScore} />
              ) : (
                <div className="text-gray-500">暂无评估结果</div>
              )}
            </CardContent>
          </Card>

          {/* AI Run History Panel */}
          <Card>
            <CardHeader>
              <CardTitle>评估历史版本</CardTitle>
            </CardHeader>
            <CardContent>
              <AiRunHistoryPanel
                history={evaluationHistory}
                selectedRunId={selectedRunId}
                onSelectRun={setSelectedRunId}
              />
            </CardContent>
          </Card>

          {/* Tabs: Chat History + Event Timeline */}
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="chat">
                <TabsList>
                  <TabsTrigger value="chat">聊天记录</TabsTrigger>
                  <TabsTrigger value="events">事件时间线</TabsTrigger>
                </TabsList>
                <TabsContent value="chat">
                  <ChatHistoryPanel interviewId={interviewId} />
                </TabsContent>
                <TabsContent value="events">
                  <EventTimelinePanel interviewId={interviewId} />
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

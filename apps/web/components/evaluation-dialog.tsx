import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import { EvaluationStreamPanel } from '@/components/review/evaluation-stream-panel'

interface EvaluationDimension {
  name: string
  score: number
  reasoning: string
}

interface EvaluationDetails {
  totalScore: number
  dimensions: EvaluationDimension[]
  summary: string
}

interface EvaluationData {
  aiEvaluationStatus: string | null
  aiEvaluationScore: number | null
  aiEvaluationDetails: EvaluationDetails | null
  aiEvaluationError: string | null
  aiEvaluatedAt: string | null
  aiEvaluationRetries: number
  rawOutput?: string | null
}

interface EvaluationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  interviewId: string | null
  interviewStatus?: string
}

export function EvaluationDialog({ open, onOpenChange, interviewId, interviewStatus }: EvaluationDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)

  const loadEvaluation = useCallback(() => {
    if (!interviewId) return
    setLoading(true)
    setError(null)

    apiFetch(`/api/admin/interviews/${interviewId}/evaluation`)
      .then(data => {
        if (data.error) {
          setError(data.error)
          setEvaluation(null)
        } else {
          setEvaluation(data)
          setIsEvaluating(data.aiEvaluationStatus === 'running')
        }
      })
      .catch(err => {
        console.error('Failed to fetch evaluation:', err)
        setError(err instanceof Error ? err.message : '加载评估结果失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [interviewId])

  useEffect(() => {
    if (!open || !interviewId) return
    loadEvaluation()
  }, [open, interviewId, loadEvaluation])

  const handleReEvaluate = useCallback(async () => {
    if (!interviewId) return
    try {
      await apiFetch(`/api/admin/interviews/${interviewId}/evaluate`, { method: 'POST' })
      setIsEvaluating(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '触发评估失败'
      setError(msg)
    }
  }, [interviewId])

  const handleEvaluationComplete = useCallback(() => {
    setIsEvaluating(false)
    loadEvaluation()
  }, [loadEvaluation])

  const getScoreColor = (score: number) => {
    if (score >= 7) return 'text-green-600'
    if (score >= 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDimensionScoreColor = (score: number) => {
    if (score >= 1.5) return 'text-green-600'
    if (score >= 1) return 'text-yellow-600'
    return 'text-red-600'
  }

  const canReEvaluate = interviewStatus && interviewStatus !== 'PENDING' && interviewStatus !== 'IN_PROGRESS' && !isEvaluating

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>AI 评估结果</DialogTitle>
          {canReEvaluate && (
            <Button variant="outline" size="sm" onClick={handleReEvaluate}>
              <RefreshCw className="h-4 w-4 mr-1" />
              重新评估
            </Button>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && !isEvaluating && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-800 rounded-md">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Streaming panel — shown when evaluation is running */}
          {isEvaluating && interviewId && (
            <EvaluationStreamPanel
              interviewId={interviewId}
              isRunning={true}
              onComplete={handleEvaluationComplete}
            />
          )}

          {!loading && !error && !isEvaluating && evaluation && (
            <div className="space-y-6">
              {evaluation.aiEvaluationStatus === 'completed' && evaluation.aiEvaluationScore !== null ? (
                <>
                  {/* 总分卡片 */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        总分
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center">
                        <span className={`text-6xl font-bold ${getScoreColor(evaluation.aiEvaluationScore)}`}>
                          {evaluation.aiEvaluationScore.toFixed(1)}
                        </span>
                        <span className="text-3xl text-muted-foreground ml-2">/10</span>
                      </div>
                      {evaluation.aiEvaluatedAt && (
                        <p className="text-sm text-muted-foreground text-center mt-4">
                          评估时间: {new Date(evaluation.aiEvaluatedAt).toLocaleString()}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* 评估详情 */}
                  {evaluation.aiEvaluationDetails ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>评估详情</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {typeof evaluation.aiEvaluationDetails === 'string' ? (
                          <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                            {evaluation.aiEvaluationDetails}
                          </pre>
                        ) : evaluation.aiEvaluationDetails.dimensions && evaluation.aiEvaluationDetails.dimensions.length > 0 ? (
                          <div className="space-y-4">
                            {/* 各维度评分 */}
                            <div className="space-y-3">
                              {evaluation.aiEvaluationDetails.dimensions.map((dim, idx) => (
                                <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium">{idx + 1}. {dim.name}</span>
                                    <span className={`font-bold ${getDimensionScoreColor(dim.score)}`}>
                                      {dim.score}/2
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{dim.reasoning}</p>
                                </div>
                              ))}
                            </div>

                            {/* 整体评价 */}
                            {evaluation.aiEvaluationDetails.summary && evaluation.aiEvaluationDetails.summary !== '无整体评价' && (
                              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                                <h4 className="font-medium mb-2">整体评价</h4>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {evaluation.aiEvaluationDetails.summary}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : evaluation.rawOutput ? (
                          /* Fallback: show raw AI output when structured parse failed */
                          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {evaluation.rawOutput}
                          </div>
                        ) : (
                          <div className="text-gray-500">暂无详细评估内容</div>
                        )}
                      </CardContent>
                    </Card>
                  ) : evaluation.rawOutput ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>评估详情</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {evaluation.rawOutput}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </>
              ) : evaluation.aiEvaluationStatus === 'failed' ? (
                <Card className="bg-red-50 border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-5 w-5" />
                      评估失败
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-700 mb-2">{evaluation.aiEvaluationError || '未知错误'}</p>
                    <p className="text-sm text-red-600">重试次数: {evaluation.aiEvaluationRetries}</p>
                    {evaluation.rawOutput && (
                      <div className="mt-4 p-3 bg-white rounded border">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">部分输出:</h4>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{evaluation.rawOutput}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <AlertCircle className="h-12 w-12 text-gray-400" />
                  <p className="text-lg text-muted-foreground">尚未进行评估</p>
                  <p className="text-sm text-muted-foreground">面试结束后将自动触发评估</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

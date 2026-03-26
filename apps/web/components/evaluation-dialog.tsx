import { useEffect, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { AiEvaluationPanel } from '@/components/review/ai-evaluation-panel'

interface EvaluationDetails {
  totalScore: number
  report?: string
  dimensions?: { name: string; score: number; reasoning: string }[]
  summary?: string
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

function parseDetails(raw: any): EvaluationDetails {
  if (!raw) return { totalScore: 0, dimensions: [], summary: '' }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return { totalScore: 0, dimensions: [], summary: raw }
    }
  }
  return raw
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

  // Poll for completion when evaluating
  useEffect(() => {
    if (!isEvaluating || !interviewId) return
    const interval = setInterval(() => {
      loadEvaluation()
    }, 5000)
    return () => clearInterval(interval)
  }, [isEvaluating, interviewId, loadEvaluation])

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

          {/* Simple spinner when evaluation is running */}
          {isEvaluating && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">AI 正在评估中，请稍候...</p>
            </div>
          )}

          {!loading && !error && !isEvaluating && evaluation && (
            <div className="space-y-6">
              {evaluation.aiEvaluationStatus === 'completed' && evaluation.aiEvaluationScore !== null ? (
                <AiEvaluationPanel
                  details={parseDetails(evaluation.aiEvaluationDetails)}
                  score={evaluation.aiEvaluationScore}
                  rawOutput={evaluation.rawOutput}
                />
              ) : evaluation.aiEvaluationStatus === 'failed' ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800 mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">评估失败</span>
                  </div>
                  <p className="text-red-700 text-sm mb-1">{evaluation.aiEvaluationError || '未知错误'}</p>
                  <p className="text-xs text-red-600">重试次数: {evaluation.aiEvaluationRetries}</p>
                </div>
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

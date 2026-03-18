'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface AiEvaluationRun {
  id: string
  version: number
  status: string
  score?: number
  details?: any
  triggeredBy?: string
  startedAt: string
  completedAt?: string
  error?: string
}

interface AiRunHistoryPanelProps {
  history: AiEvaluationRun[]
  selectedRunId: string | null
  onSelectRun: (runId: string) => void
}

const statusConfig: Record<string, { label: string; variant: 'success' | 'error' | 'warning' | 'info' | 'default' }> = {
  running: { label: '运行中', variant: 'info' },
  completed: { label: '已完成', variant: 'success' },
  failed: { label: '失败', variant: 'error' },
  timeout: { label: '超时', variant: 'warning' }
}

export function AiRunHistoryPanel({ history, selectedRunId, onSelectRun }: AiRunHistoryPanelProps) {
  if (history.length === 0) {
    return <div className="text-gray-500">暂无评估历史</div>
  }

  return (
    <div className="space-y-2">
      {history.map((run) => {
        const config = statusConfig[run.status] || { label: run.status, variant: 'default' as const }
        const isSelected = run.id === selectedRunId

        return (
          <div
            key={run.id}
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
            onClick={() => onSelectRun(run.id)}
          >
            <div className="flex items-center gap-3">
              <span className="font-medium text-gray-900">v{run.version}</span>
              <Badge variant={config.variant}>{config.label}</Badge>
              {run.score !== null && run.score !== undefined && (
                <Badge
                  variant={run.score >= 7 ? 'success' : run.score >= 5 ? 'warning' : 'error'}
                  className="font-semibold"
                >
                  {run.score.toFixed(1)}/10
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{new Date(run.startedAt).toLocaleString()}</span>
              {run.triggeredBy && <span className="text-xs">手动触发</span>}
              {isSelected && (
                <Button variant="outline" size="sm" disabled>
                  当前版本
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

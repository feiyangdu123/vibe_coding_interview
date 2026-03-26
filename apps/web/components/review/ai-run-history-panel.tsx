'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface AiEvaluationRun {
  id: string
  version: number
  status: string
  score?: number
  details?: any
  rawOutput?: string
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
  failed: { label: '评估未成功', variant: 'error' },
  timeout: { label: '评估超时', variant: 'warning' },
}

function getFailureReason(run: AiEvaluationRun): string {
  if (run.status === 'timeout') return '评估超时'
  if (run.error) {
    const msg = String(run.error)
    return msg.length > 80 ? msg.slice(0, 80) + '...' : msg
  }
  return '评估过程中发生错误'
}

function getOrdinalLabel(index: number): string {
  return `第 ${index + 1} 次评估`
}

export function AiRunHistoryPanel({ history, selectedRunId, onSelectRun }: AiRunHistoryPanelProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  // Don't render if only one run (the main evaluation card already shows it)
  if (history.length <= 1) {
    return null
  }

  const toggleExpand = (run: AiEvaluationRun) => {
    if (expandedRunId === run.id) {
      setExpandedRunId(null)
      return
    }
    setExpandedRunId(run.id)
    onSelectRun(run.id)
  }

  // Find the current (latest completed) run
  const currentRunId = selectedRunId || history[0]?.id

  return (
    <div className="space-y-2">
      {history.map((run, idx) => {
        const config = statusConfig[run.status] || { label: run.status, variant: 'default' as const }
        const isCurrent = run.id === currentRunId
        const isExpanded = run.id === expandedRunId
        const isFailed = run.status === 'failed' || run.status === 'timeout'
        const summary = run.details?.summary

        return (
          <div key={run.id} className="rounded-lg border overflow-hidden">
            <div
              className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => toggleExpand(run)}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900 text-sm">{getOrdinalLabel(idx)}</span>
                {isCurrent && (
                  <Badge variant="default" className="text-[10px]">当前</Badge>
                )}
                <Badge variant={config.variant}>{config.label}</Badge>
                {run.score != null && (
                  <Badge
                    variant={run.score >= 70 ? 'success' : run.score >= 50 ? 'warning' : 'error'}
                    className="font-semibold"
                  >
                    {run.score.toFixed(1)}/100
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="text-xs">{new Date(run.startedAt).toLocaleString()}</span>
                {run.triggeredBy && <span className="text-xs text-gray-400">手动触发</span>}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>

            {/* Expanded: show summary text for completed runs */}
            {isExpanded && !isFailed && summary && (
              <div className="border-t bg-gray-50 p-4">
                <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Expanded: show failure reason for failed runs */}
            {isExpanded && isFailed && (
              <div className="border-t bg-red-50 p-4">
                <p className="text-sm text-red-600">{getFailureReason(run)}</p>
              </div>
            )}

            {/* Raw output - always visible */}
            {isExpanded && run.rawOutput && (
              <div className="border-t">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-800">
                  <span className="text-xs font-medium text-slate-400">评估完整输出</span>
                </div>
                <div className="bg-slate-900 p-4 max-h-64 overflow-y-auto">
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-slate-300">
                    {run.rawOutput}
                  </pre>
                </div>
              </div>
            )}

            {isExpanded && run.error && (
              <div className="border-t bg-red-50 p-4">
                <h4 className="text-xs font-medium text-red-500 mb-2">错误详情</h4>
                <pre className="text-xs whitespace-pre-wrap text-red-500 max-h-40 overflow-y-auto">
                  {run.error}
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

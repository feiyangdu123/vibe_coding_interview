'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { Badge } from '@/components/ui/badge'

interface InterviewEvent {
  id: string
  eventType: string
  metadata?: any
  createdAt: string
}

interface EventTimelinePanelProps {
  interviewId: string
}

const eventTypeConfig: Record<string, { label: string; variant: 'success' | 'error' | 'warning' | 'info' | 'default' }> = {
  STARTED: { label: '面试开始', variant: 'success' },
  WORKSPACE_OPENED: { label: '工作区打开', variant: 'info' },
  HEARTBEAT: { label: '心跳', variant: 'default' },
  SUBMITTED: { label: '候选人提交', variant: 'success' },
  TIMEOUT: { label: '超时', variant: 'warning' },
  INTERVIEWER_ENDED: { label: '面试官终止', variant: 'warning' },
  SYSTEM_ERROR: { label: '系统错误', variant: 'error' },
  CANCELLED: { label: '管理员取消', variant: 'warning' },
  NO_SHOW: { label: '候选人未到场', variant: 'warning' },
  AI_EVALUATION_STARTED: { label: 'AI 评估开始', variant: 'info' },
  AI_EVALUATION_FINISHED: { label: 'AI 评估完成', variant: 'success' }
}

export function EventTimelinePanel({ interviewId }: EventTimelinePanelProps) {
  const [events, setEvents] = useState<InterviewEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEvents()
  }, [interviewId])

  const loadEvents = async () => {
    try {
      const response = await apiFetch(`/api/admin/interviews/${interviewId}/events`)
      setEvents(response.data || [])
    } catch (err) {
      console.error('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-gray-500 py-4">加载事件时间线中...</div>
  }

  if (events.length === 0) {
    return <div className="text-gray-500 py-4">暂无事件记录</div>
  }

  return (
    <div className="space-y-3 max-h-[600px] overflow-y-auto py-4">
      {events.map((event, idx) => {
        const config = eventTypeConfig[event.eventType] || { label: event.eventType, variant: 'default' as const }

        return (
          <div key={event.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${
                config.variant === 'success' ? 'bg-green-500' :
                config.variant === 'error' ? 'bg-red-500' :
                config.variant === 'warning' ? 'bg-yellow-500' :
                config.variant === 'info' ? 'bg-blue-500' : 'bg-gray-400'
              }`} />
              {idx < events.length - 1 && (
                <div className="w-0.5 h-8 bg-gray-300 my-1" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={config.variant}>{config.label}</Badge>
                <span className="text-xs text-gray-500">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1">
                  {JSON.stringify(event.metadata, null, 2)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

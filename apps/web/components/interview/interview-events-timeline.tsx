'use client'

import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Cpu,
  Hand,
  HeartPulse,
  PlayCircle,
  Sparkles
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/api'
import type { InterviewEventType } from '@vibe/shared-types'

interface InterviewEvent {
  id: string
  eventType: InterviewEventType
  metadata?: any
  createdAt: string
}

interface InterviewEventsTimelineProps {
  interviewId: string
  isInProgress: boolean
}

const eventTypeConfig: Record<
  InterviewEventType,
  { label: string; icon: LucideIcon; badge: 'success' | 'error' | 'warning' | 'info' | 'secondary' }
> = {
  STARTED: { label: '面试开始', icon: PlayCircle, badge: 'success' },
  WORKSPACE_OPENED: { label: '打开工作区', icon: Cpu, badge: 'info' },
  HEARTBEAT: { label: '心跳检测', icon: HeartPulse, badge: 'secondary' },
  SUBMITTED: { label: '候选人提交', icon: CheckCircle2, badge: 'success' },
  TIMEOUT: { label: '时间到', icon: Clock3, badge: 'warning' },
  INTERVIEWER_ENDED: { label: '面试官结束', icon: Hand, badge: 'warning' },
  SYSTEM_ERROR: { label: '系统错误', icon: AlertTriangle, badge: 'error' },
  CANCELLED: { label: '管理员取消', icon: Hand, badge: 'warning' },
  NO_SHOW: { label: '候选人未到场', icon: AlertTriangle, badge: 'warning' },
  AI_EVALUATION_STARTED: { label: 'AI 评估开始', icon: Bot, badge: 'info' },
  AI_EVALUATION_FINISHED: { label: 'AI 评估完成', icon: Sparkles, badge: 'success' }
}

export function InterviewEventsTimeline({ interviewId, isInProgress }: InterviewEventsTimelineProps) {
  const [events, setEvents] = useState<InterviewEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = async () => {
    try {
      const data = await apiFetch(`/api/admin/interviews/${interviewId}/events`)
      setEvents(data.data || [])
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [interviewId])

  useEffect(() => {
    if (!isInProgress) return

    const interval = setInterval(() => {
      fetchEvents()
    }, 5000)

    return () => clearInterval(interval)
  }, [isInProgress, interviewId])

  if (loading) {
    return <div className="text-gray-600 text-center py-8">加载事件...</div>
  }

  if (events.length === 0) {
    return <div className="text-gray-600 text-center py-8">暂无事件记录</div>
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => {
        const config = eventTypeConfig[event.eventType] || {
          label: event.eventType,
          icon: Cpu,
          badge: 'secondary' as const
        }
        const Icon = config.icon

        return (
          <div key={event.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-slate-600">
                <Icon className="h-4 w-4" />
              </div>
              {index < events.length - 1 && (
                <div className="mt-2 h-full w-px bg-border"></div>
              )}
            </div>
            <div className="flex-1 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold text-slate-900">{config.label}</div>
                <Badge variant={config.badge}>{event.eventType}</Badge>
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {new Date(event.createdAt).toLocaleString('zh-CN')}
              </div>
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="mt-3 rounded-lg border border-border bg-slate-50 p-3 text-sm text-slate-600">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(event.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

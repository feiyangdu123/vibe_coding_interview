'use client'

import { useEffect, useState } from 'react'
import { Cpu } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import {
  eventTypeConfig,
  metadataToDescription,
  filterMetadata,
  getMetadataKeyLabel,
  formatMetadataValue,
  getColorClasses,
} from '@/lib/event-display'
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

const defaultConfig = {
  icon: Cpu,
  color: 'gray' as const,
  title: '未知事件',
  tier: 1 as const,
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

  // Deduplicate consecutive events of the same type within 5 seconds
  const deduped = events.filter((event, i) => {
    if (i === 0) return true
    const prev = events[i - 1]
    if (prev.eventType !== event.eventType) return true
    const gap = Math.abs(new Date(event.createdAt).getTime() - new Date(prev.createdAt).getTime())
    return gap > 5000
  })

  return (
    <div className="space-y-4">
      {deduped.map((event, index) => {
        const config = eventTypeConfig[event.eventType] || defaultConfig
        const Icon = config.icon
        const colors = getColorClasses(config.color)
        const description = metadataToDescription(event.eventType, event.metadata)
        const filtered = filterMetadata(event.metadata)

        return (
          <div key={event.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${colors.border} ${colors.bg} ${colors.text}`}>
                <Icon className="h-4 w-4" />
              </div>
              {index < deduped.length - 1 && (
                <div className="mt-2 h-full w-px bg-border"></div>
              )}
            </div>
            <div className="flex-1 pb-6">
              <div className="font-semibold text-slate-900">{config.title}</div>
              <div className="mt-1 text-sm text-gray-500">
                {new Date(event.createdAt).toLocaleString('zh-CN')}
              </div>
              {description && (
                <div className={`mt-2 text-sm ${config.highlighted ? 'text-red-600' : 'text-slate-600'}`}>
                  {description}
                </div>
              )}
              {filtered && !description && (
                <div className="mt-3 rounded-lg border border-border bg-slate-50 p-3 text-sm text-slate-600">
                  <dl className="space-y-1">
                    {Object.entries(filtered).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <dt className="text-gray-500 shrink-0">{getMetadataKeyLabel(key)}：</dt>
                        <dd className="text-slate-700">{formatMetadataValue(key, value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

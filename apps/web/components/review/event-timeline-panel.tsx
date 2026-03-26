'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { ChevronDown } from 'lucide-react'
import {
  eventTypeConfig,
  metadataToDescription,
  filterMetadata,
  calcTimelineSummary,
  getColorClasses,
  getMetadataKeyLabel,
  formatMetadataValue,
  type EventTypeDisplayConfig,
} from '@/lib/event-display'

interface InterviewEvent {
  id: string
  eventType: string
  metadata?: any
  createdAt: string
}

interface EventTimelinePanelProps {
  interviewId: string
  devMode?: boolean
}

export function EventTimelinePanel({ interviewId, devMode = false }: EventTimelinePanelProps) {
  const [events, setEvents] = useState<InterviewEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return <div className="text-gray-500 py-4">加载事件时间线中...</div>
  }

  if (events.length === 0) {
    return <div className="text-gray-500 py-4">暂无事件记录</div>
  }

  const summary = calcTimelineSummary(events)

  // Filter events: hide HEARTBEAT, sort tier 3 out unless devMode
  const visibleEvents = events.filter(ev => {
    const config = eventTypeConfig[ev.eventType]
    if (!config) return true
    if (config.aggregate) return false // HEARTBEAT
    return true
  })

  return (
    <div className="py-4 space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2.5 border">
        {summary.durationMinutes != null && (
          <span>面试时长: <strong>{summary.durationMinutes} 分钟</strong></span>
        )}
        {summary.errorCount > 0 && (
          <span className="text-red-600">
            异常: <strong>⚠ {summary.errorCount} 次系统错误</strong>
          </span>
        )}
        <span>共 {summary.eventCount} 个事件</span>
        {summary.heartbeatCount > 0 && (
          <span className="text-gray-400">(共 {summary.heartbeatCount} 次心跳)</span>
        )}
      </div>

      {/* Timeline cards */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {visibleEvents.map((event) => {
          const config: EventTypeDisplayConfig = eventTypeConfig[event.eventType] || {
            icon: ChevronDown,
            color: 'gray' as const,
            title: event.eventType,
            tier: 1,
          }
          const Icon = config.icon
          const colors = getColorClasses(config.color)
          const desc = config.desc
          const metaDesc = metadataToDescription(event.eventType, event.metadata)
          const isExpanded = expandedIds.has(event.id)
          const isTier2 = config.tier === 2
          const isHighlighted = config.highlighted
          const filteredMeta = filterMetadata(event.metadata)
          const time = new Date(event.createdAt).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })

          // Tier 2: compact row
          if (isTier2 && !devMode) {
            return (
              <div key={event.id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{config.title}</span>
                <span className="ml-auto">{time}</span>
              </div>
            )
          }

          // Tier 1 (and tier 2 in devMode): full card
          return (
            <div
              key={event.id}
              className={`rounded-lg border p-3 transition-colors ${
                isHighlighted
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50/50'
              }`}
            >
              {/* Card header */}
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors.bg}`}>
                  <Icon className={`h-4 w-4 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium text-sm ${isHighlighted ? 'text-red-800' : 'text-gray-900'}`}>
                      {config.title}
                      {isHighlighted && ' — 可能影响候选人体验'}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">{time}</span>
                  </div>
                  {/* Description */}
                  {desc && (
                    <p className={`text-xs mt-0.5 ${isHighlighted ? 'text-red-700' : 'text-gray-500'}`}>
                      {desc}
                    </p>
                  )}
                  {/* Metadata description (from metadataToDescription) */}
                  {metaDesc && (
                    <p className={`text-xs mt-1 ${isHighlighted ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {metaDesc}
                    </p>
                  )}
                </div>
              </div>

              {/* Expandable detail (tier 2 info) */}
              {filteredMeta && !devMode && Object.keys(filteredMeta).length > 0 && (
                <button
                  onClick={() => toggleExpand(event.id)}
                  className="mt-2 ml-10 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  {isExpanded ? '收起详情' : '查看详情'}
                </button>
              )}
              {isExpanded && filteredMeta && !devMode && (
                <div className="mt-1.5 ml-10 text-xs text-gray-500 bg-gray-50 rounded p-2">
                  {Object.entries(filteredMeta).map(([k, v]) => (
                    <div key={k}>
                      <span className="font-medium">{getMetadataKeyLabel(k)}:</span> {formatMetadataValue(k, v)}
                    </div>
                  ))}
                </div>
              )}

              {/* Dev mode: raw JSON */}
              {devMode && event.metadata && Object.keys(event.metadata).length > 0 && (
                <pre className="mt-2 ml-10 text-[11px] text-gray-400 bg-gray-100 rounded p-2 overflow-x-auto">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

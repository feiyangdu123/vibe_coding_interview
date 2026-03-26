import {
  Play,
  FolderOpen,
  Heart,
  CheckCircle,
  Clock,
  UserX,
  AlertTriangle,
  XCircle,
  UserMinus,
  Bot,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react'

export interface EventTypeDisplayConfig {
  icon: LucideIcon
  color: 'green' | 'blue' | 'gray' | 'amber' | 'red'
  title: string
  desc?: string
  /** 1 = always visible card, 2 = collapsed small row, 3 = hidden by default */
  tier: 1 | 2 | 3
  /** If true, events of this type are aggregated into a count */
  aggregate?: boolean
  /** If true, render with highlighted/alert styling */
  highlighted?: boolean
}

export const eventTypeConfig: Record<string, EventTypeDisplayConfig> = {
  STARTED: {
    icon: Play,
    color: 'green',
    title: '面试开始',
    desc: '候选人进入面试环境，开始计时',
    tier: 1,
  },
  WORKSPACE_OPENED: {
    icon: FolderOpen,
    color: 'blue',
    title: '开发环境就绪',
    desc: '编码工作区已加载完成',
    tier: 2,
  },
  HEARTBEAT: {
    icon: Heart,
    color: 'gray',
    title: '心跳信号',
    tier: 3,
    aggregate: true,
  },
  SUBMITTED: {
    icon: CheckCircle,
    color: 'green',
    title: '候选人主动提交',
    desc: '候选人完成作答并提交了代码',
    tier: 1,
  },
  TIMEOUT: {
    icon: Clock,
    color: 'amber',
    title: '面试超时结束',
    desc: '面试时间已到，系统自动结束',
    tier: 1,
  },
  INTERVIEWER_ENDED: {
    icon: UserX,
    color: 'amber',
    title: '面试官提前终止',
    desc: '面试官手动结束了本次面试',
    tier: 1,
  },
  SYSTEM_ERROR: {
    icon: AlertTriangle,
    color: 'red',
    title: '系统异常',
    tier: 1,
    highlighted: true,
  },
  CANCELLED: {
    icon: XCircle,
    color: 'gray',
    title: '面试已取消',
    desc: '管理员取消了本次面试',
    tier: 1,
  },
  NO_SHOW: {
    icon: UserMinus,
    color: 'gray',
    title: '候选人未到场',
    desc: '候选人未在规定时间内进入面试',
    tier: 1,
  },
  AI_EVALUATION_STARTED: {
    icon: Bot,
    color: 'blue',
    title: 'AI 评估开始',
    desc: '系统正在对候选人表现进行 AI 评估',
    tier: 2,
  },
  AI_EVALUATION_FINISHED: {
    icon: CheckCircle2,
    color: 'green',
    title: 'AI 评估完成',
    tier: 1,
  },
}

/** Keys to always filter out from metadata display */
const FILTERED_KEYS = new Set([
  'port',
  'processId',
  'version',
  'dataDir',
  'workDir',
  'pid',
  'openCodePort',
  'openCodeProcessId',
  'type',
  'attempt',
  'retryCount',
  'triggeredBy',
  'noInteraction',
  'runId',
])

/** Chinese labels for common metadata keys */
const metadataKeyLabels: Record<string, string> = {
  endedAt: '结束时间',
  startedAt: '开始时间',
  completedAt: '完成时间',
  createdAt: '创建时间',
  score: '评分',
  error: '错误信息',
  reason: '原因',
  status: '状态',
  duration: '耗时',
  openCodeStatus: '环境状态',
  interviewId: '面试ID',
  candidateName: '候选人',
  problemTitle: '题目',
}

/**
 * Get a display-friendly label for a metadata key.
 */
export function getMetadataKeyLabel(key: string): string {
  return metadataKeyLabels[key] || key
}

/**
 * Format a metadata value for display.
 * Detects ISO timestamps and formats them as readable strings.
 */
export function formatMetadataValue(key: string, value: any): string {
  if (value == null) return ''
  const strVal = String(value)

  // Detect ISO timestamp strings
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    try {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      }
    } catch {
      // fall through
    }
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return strVal
}

/**
 * Convert event metadata into a human-readable description.
 * Returns undefined if no meaningful description can be generated.
 */
export function metadataToDescription(
  eventType: string,
  metadata?: Record<string, any>
): string | undefined {
  if (!metadata) return undefined

  if (eventType === 'SYSTEM_ERROR') {
    if (metadata.openCodeStatus === 'error') {
      return '开发环境启动失败，候选人的编码环境可能受到影响。建议在评估时考虑这一因素。'
    }
    if (metadata.type === 'opencode_restart') {
      return '开发环境进行了一次自动恢复，候选人编码体验可能有短暂影响。'
    }
    if (metadata.error) {
      const msg = String(metadata.error)
      return `错误信息：${msg.length > 100 ? msg.slice(0, 100) + '...' : msg}`
    }
    return '面试过程中发生技术故障，候选人的编码环境可能受到影响。建议在评估时考虑这一因素。'
  }

  if (eventType === 'AI_EVALUATION_FINISHED' && metadata.score != null) {
    return `评分：${Number(metadata.score).toFixed(1)}/10`
  }

  if (metadata.error) {
    const msg = String(metadata.error)
    return msg.length > 100 ? msg.slice(0, 100) + '...' : msg
  }

  return undefined
}

/**
 * Filter metadata to remove dev-only keys.
 * Returns null if no displayable keys remain.
 */
export function filterMetadata(
  metadata?: Record<string, any>
): Record<string, any> | null {
  if (!metadata) return null
  const filtered: Record<string, any> = {}
  let hasKeys = false
  for (const [k, v] of Object.entries(metadata)) {
    if (!FILTERED_KEYS.has(k)) {
      filtered[k] = v
      hasKeys = true
    }
  }
  return hasKeys ? filtered : null
}

export interface TimelineSummary {
  /** Duration in minutes, or null if cannot be computed */
  durationMinutes: number | null
  /** Number of SYSTEM_ERROR events */
  errorCount: number
  /** Total events excluding HEARTBEAT */
  eventCount: number
  /** Number of HEARTBEAT events */
  heartbeatCount: number
}

const END_EVENT_TYPES = new Set([
  'SUBMITTED',
  'TIMEOUT',
  'INTERVIEWER_ENDED',
  'SYSTEM_ERROR',
  'CANCELLED',
  'NO_SHOW',
])

export function calcTimelineSummary(
  events: { eventType: string; createdAt: string }[]
): TimelineSummary {
  let startTime: number | null = null
  let endTime: number | null = null
  let errorCount = 0
  let heartbeatCount = 0
  let eventCount = 0

  for (const ev of events) {
    if (ev.eventType === 'HEARTBEAT') {
      heartbeatCount++
      continue
    }
    eventCount++
    const t = new Date(ev.createdAt).getTime()
    if (ev.eventType === 'STARTED') {
      startTime = t
    }
    if (END_EVENT_TYPES.has(ev.eventType)) {
      if (endTime === null || t > endTime) endTime = t
    }
    if (ev.eventType === 'SYSTEM_ERROR') {
      errorCount++
    }
  }

  const durationMinutes =
    startTime != null && endTime != null
      ? Math.round((endTime - startTime) / 60000)
      : null

  return { durationMinutes, errorCount, eventCount, heartbeatCount }
}

/** Color utility for Tailwind classes */
export function getColorClasses(color: EventTypeDisplayConfig['color']) {
  switch (color) {
    case 'green':
      return { dot: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' }
    case 'blue':
      return { dot: 'bg-blue-500', border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' }
    case 'amber':
      return { dot: 'bg-amber-500', border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' }
    case 'red':
      return { dot: 'bg-red-500', border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-700' }
    case 'gray':
    default:
      return { dot: 'bg-gray-400', border: 'border-gray-200', bg: 'bg-gray-50', text: 'text-gray-600' }
  }
}

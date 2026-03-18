import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, FileIcon, WrenchIcon } from 'lucide-react'

interface ChatPart {
  id: string
  type: 'text' | 'tool' | 'file' | 'reasoning'
  content: string
  metadata?: any
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  timestamp: number
  parts: ChatPart[]
}

interface ChatMessageProps {
  message: ChatMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const timestamp = new Date(message.timestamp).toLocaleTimeString()

  // Check if this is an evaluation prompt (contains the evaluation template text)
  const isEvaluationPrompt = isUser && message.parts.some(part =>
    part.type === 'text' && part.content.includes('你是一个评估候选人 vibe coding 能力的专家')
  )

  // Determine the role label
  const roleLabel = isEvaluationPrompt ? 'AI研究员' : (isUser ? '候选人' : 'AI 助手')

  return (
    <div className={`mb-4 ${isUser ? 'ml-0' : 'ml-0'}`}>
      <div className="flex items-center gap-2 mb-1">
        <Badge variant={isUser ? 'default' : 'info'}>
          {roleLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">{timestamp}</span>
      </div>
      <div className={`rounded-lg p-3 ${isUser ? 'bg-blue-50' : 'bg-gray-50'}`}>
        {message.parts.map(part => (
          <ChatPart key={part.id} part={part} />
        ))}
      </div>
    </div>
  )
}

function ChatPart({ part }: { part: ChatPart }) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false)

  switch (part.type) {
    case 'text':
      return (
        <div className="whitespace-pre-wrap text-sm">
          {part.content}
        </div>
      )

    case 'reasoning':
      return (
        <div className="my-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReasoningExpanded(!reasoningExpanded)}
            className="h-auto gap-1 p-0 text-slate-600 hover:text-slate-900"
          >
            {reasoningExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="text-xs font-medium">推理过程</span>
          </Button>
          {reasoningExpanded && (
            <div className="mt-2 whitespace-pre-wrap text-xs text-slate-700">
              {part.content}
            </div>
          )}
        </div>
      )

    case 'tool':
      const status = part.metadata?.status || 'unknown'
      const statusColors = {
        completed: 'bg-green-100 text-green-800 border-green-200',
        error: 'bg-red-100 text-red-800 border-red-200',
        running: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        unknown: 'bg-gray-100 text-gray-800 border-gray-200'
      }

      return (
        <div className={`border rounded p-2 my-2 flex items-center gap-2 ${statusColors[status as keyof typeof statusColors]}`}>
          <WrenchIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{part.content}</span>
        </div>
      )

    case 'file':
      return (
        <div className="border border-blue-200 rounded p-2 my-2 bg-blue-50 flex items-center gap-2">
          <FileIcon className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-900">{part.content}</span>
        </div>
      )

    default:
      return null
  }
}

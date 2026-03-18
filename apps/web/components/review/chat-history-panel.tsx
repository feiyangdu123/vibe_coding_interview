'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

interface ChatHistoryPanelProps {
  interviewId: string
}

export function ChatHistoryPanel({ interviewId }: ChatHistoryPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadChatHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch(`/api/admin/interviews/${interviewId}/chat-history`)
      if (response.error) {
        setError(response.error)
        setMessages([])
      } else {
        setMessages(response.messages || [])
      }
    } catch (err) {
      console.error('Failed to load chat history:', err)
      setError('加载聊天记录失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChatHistory()
  }, [interviewId])

  if (loading) {
    return <div className="text-gray-500 py-4">加载聊天记录中...</div>
  }

  if (error) {
    return (
      <div className="py-4 space-y-2">
        <div className="text-red-500 bg-red-50 p-4 rounded-lg">
          <p className="font-medium">加载失败</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadChatHistory}>
          重试
        </Button>
      </div>
    )
  }

  if (messages.length === 0) {
    return <div className="text-gray-500 py-4">暂无聊天记录</div>
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto py-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg p-3 ${
              msg.role === 'user'
                ? 'bg-blue-100 text-blue-900'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={msg.role === 'user' ? 'info' : 'default'} className="text-xs">
                {msg.role === 'user' ? '候选人' : 'AI'}
              </Badge>
              <span className="text-xs text-gray-500">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            {msg.parts.map((part) => (
              <div key={part.id} className="mt-1">
                {part.type === 'text' && (
                  <p className="text-sm whitespace-pre-wrap">{part.content}</p>
                )}
                {part.type === 'reasoning' && (
                  <p className="text-sm text-gray-500 italic whitespace-pre-wrap">{part.content}</p>
                )}
                {part.type === 'tool' && (
                  <div className="text-xs bg-gray-200 rounded px-2 py-1 inline-block">
                    {part.content}
                  </div>
                )}
                {part.type === 'file' && (
                  <div className="text-xs text-blue-600">{part.content}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

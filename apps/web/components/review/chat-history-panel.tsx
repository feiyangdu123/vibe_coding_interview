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

interface SessionInfo {
  title: string
  directory: string
}

interface SessionWithMessages {
  sessionInfo: SessionInfo
  messages: ChatMessage[]
}

interface ChatHistoryPanelProps {
  interviewId: string
}

export function ChatHistoryPanel({ interviewId }: ChatHistoryPanelProps) {
  const [sessions, setSessions] = useState<SessionWithMessages[]>([])
  const [activeSessionIndex, setActiveSessionIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadChatHistory = async () => {
    setLoading(true)
    setError(null)
    setActiveSessionIndex(0)
    try {
      const response = await apiFetch(`/api/admin/interviews/${interviewId}/chat-history`)
      if (response.error) {
        setError(response.error)
        setSessions([])
      } else if (response.sessions && response.sessions.length > 0) {
        setSessions(response.sessions)
      } else if (response.messages) {
        setSessions([{
          sessionInfo: response.sessionInfo || { title: 'Interview Session', directory: '' },
          messages: response.messages
        }])
      } else {
        setSessions([])
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

  const currentSession = sessions[activeSessionIndex]
  const messages = currentSession?.messages || []
  const isMultiSession = sessions.length > 1

  if (sessions.length === 0 || messages.length === 0) {
    return <div className="text-gray-500 py-4">暂无聊天记录</div>
  }

  return (
    <div className="py-4">
      {isMultiSession && (
        <div className="flex flex-wrap gap-1.5 pb-3 mb-3 border-b">
          {sessions.map((session, idx) => (
            <Button
              key={idx}
              variant={idx === activeSessionIndex ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSessionIndex(idx)}
            >
              会话 {idx + 1}
              {session.messages.length > 0 && (
                <span className="ml-1 text-xs opacity-70">({session.messages.length})</span>
              )}
            </Button>
          ))}
        </div>
      )}

      <div className="space-y-4 max-h-[600px] overflow-y-auto">
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
    </div>
  )
}

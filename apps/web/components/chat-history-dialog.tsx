import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChatMessage } from './chat-message'
import { apiFetch } from '@/lib/api'
import { Loader2, AlertCircle } from 'lucide-react'

interface ChatPart {
  id: string
  type: 'text' | 'tool' | 'file' | 'reasoning'
  content: string
  metadata?: any
}

interface ChatMessageType {
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
  messages: ChatMessageType[]
}

interface ChatHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  interviewId: string | null
}

export function ChatHistoryDialog({ open, onOpenChange, interviewId }: ChatHistoryDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionWithMessages[]>([])
  const [activeSessionIndex, setActiveSessionIndex] = useState(0)

  useEffect(() => {
    if (!open || !interviewId) {
      return
    }

    setLoading(true)
    setError(null)
    setActiveSessionIndex(0)

    apiFetch(`/api/admin/interviews/${interviewId}/chat-history`)
      .then(data => {
        if (data.error) {
          setError(data.error)
          setSessions([])
        } else if (data.sessions && data.sessions.length > 0) {
          setSessions(data.sessions)
        } else if (data.messages) {
          // Fallback: wrap legacy single-session response
          setSessions([{
            sessionInfo: data.sessionInfo || { title: 'Interview Session', directory: '' },
            messages: data.messages
          }])
        } else {
          setSessions([])
        }
      })
      .catch(err => {
        console.error('Failed to fetch chat history:', err)
        setError(err instanceof Error ? err.message : '加载聊天记录失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [open, interviewId])

  const currentSession = sessions[activeSessionIndex]
  const messages = currentSession?.messages || []
  const isMultiSession = sessions.length > 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>聊天记录</DialogTitle>
          {currentSession?.sessionInfo && (
            <p className="text-sm text-muted-foreground">
              {currentSession.sessionInfo.title}
            </p>
          )}
        </DialogHeader>

        {isMultiSession && (
          <div className="flex flex-wrap gap-1.5 pb-2 border-b">
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

        <div className="flex-1 overflow-y-auto px-1">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}

          {!loading && !error && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">暂无聊天记录</p>
            </div>
          )}

          {!loading && !error && messages.length > 0 && (
            <div className="space-y-2">
              {messages.map(message => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

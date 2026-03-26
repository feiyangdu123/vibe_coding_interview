'use client'

import { useEffect, useRef, useState } from 'react'
import { connectEvaluationStream } from '@/lib/api'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface EvaluationStreamPanelProps {
  interviewId: string
  isRunning: boolean
  onComplete?: () => void
}

export function EvaluationStreamPanel({ interviewId, isRunning, onComplete }: EvaluationStreamPanelProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isRunning) return

    setText('')
    setError(null)
    setDone(false)

    const abort = connectEvaluationStream(
      interviewId,
      (chunk) => {
        setText(prev => prev + chunk)
      },
      () => {
        setDone(true)
        onComplete?.()
      },
      (errMsg) => {
        setError(errMsg)
        setDone(true)
      }
    )

    abortRef.current = abort

    return () => {
      abort()
    }
  }, [interviewId, isRunning])

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [text])

  if (!isRunning && !text) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {!done && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-blue-600 font-medium">AI 正在评估中...</span>
          </>
        )}
        {done && !error && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />
            评估完成
          </span>
        )}
        {error && (
          <span className="text-sm text-red-600 font-medium">评估出错: {error}</span>
        )}
      </div>

      <div
        ref={containerRef}
        className="bg-gray-50 border rounded-lg p-4 max-h-96 overflow-y-auto text-sm whitespace-pre-wrap leading-relaxed"
      >
        {text || (
          <span className="text-gray-400">等待评估输出...</span>
        )}
        {!done && text && (
          <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  )
}

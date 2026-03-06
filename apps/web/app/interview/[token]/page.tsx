'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Interview {
  id: string
  status: string
  startTime?: string
  endTime?: string
  port?: number
  workDir?: string
  candidate: {
    name: string
    email: string
  }
  problem: {
    title: string
    description: string
    requirements: string
    scoringCriteria: any
  }
}

export default function InterviewPage() {
  const params = useParams()
  const token = params.token as string
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  useEffect(() => {
    fetch(`http://localhost:3001/api/interview/${token}`)
      .then(res => res.json())
      .then(data => {
        setInterview(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [token])

  useEffect(() => {
    if (!interview?.endTime) return

    const interval = setInterval(() => {
      const diff = new Date(interview.endTime!).getTime() - Date.now()
      if (diff <= 0) {
        setTimeRemaining(0)
        clearInterval(interval)
      } else {
        setTimeRemaining(diff)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [interview])

  const handleStart = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/interview/${token}/start`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`启动失败: ${data.error || '未知错误'}`)
        console.error('Start interview error:', data)
        return
      }
      setInterview(data)
      if (data.port) {
        window.open(`http://localhost:${data.port}`, '_blank')
      }
    } catch (err) {
      console.error('Start interview exception:', err)
      alert('启动失败，请查看控制台')
    }
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">加载中...</div>
  if (!interview || !interview.problem || !interview.candidate) {
    return <div className="min-h-screen flex items-center justify-center">面试数据加载失败</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{interview.problem.title}</h1>
              <p className="text-gray-600">候选人: {interview.candidate.name}</p>
            </div>
            {interview.status === 'in_progress' && (
              <div className="text-2xl font-mono font-bold text-primary">
                {formatTime(timeRemaining)}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">题目描述</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{interview.problem.description}</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-2">要求</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{interview.problem.requirements}</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                点击下方按钮启动编程环境，OpenCode 将在新标签页中打开
              </p>
              {interview.workDir && (
                <p className="text-sm text-blue-800 mt-2">
                  <strong>工作目录:</strong> <code className="bg-blue-100 px-2 py-1 rounded">{interview.workDir}</code>
                  <br />
                  {interview.status === 'pending'
                    ? '面试开始后，请在 OpenCode 中打开此目录完成任务'
                    : '请在 OpenCode 中打开此目录完成任务'
                  }
                </p>
              )}
            </div>

            <div className="flex gap-4">
              {interview.status === 'pending' && (
                <Button size="lg" onClick={handleStart}>
                  开始面试
                </Button>
              )}
              {interview.status === 'in_progress' && interview.port && (
                <Button
                  size="lg"
                  onClick={() => window.open(`http://localhost:${interview.port}`, '_blank')}
                >
                  打开编程环境
                </Button>
              )}
              {interview.status === 'completed' && (
                <div className="text-gray-600 font-semibold">面试已结束</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

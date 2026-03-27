'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { API_BASE } from '@/lib/api'
import { CandidateLaunchPanel } from '@/components/interview/candidate-launch-panel'
import { CandidateWorkspacePanel } from '@/components/interview/candidate-workspace-panel'
import { CandidateCompletePanel } from '@/components/interview/candidate-complete-panel'

function rewriteWorkspaceUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hostname = window.location.hostname
    return parsed.toString()
  } catch {
    return url
  }
}

interface Interview {
  id: string
  status: string
  scheduledStartAt?: string
  joinWindowOpensAt?: string
  joinDeadlineAt?: string
  startTime?: string
  endTime?: string
  submittedAt?: string
  endReason?: string
  port?: number
  workspaceUrl?: string
  duration: number
  workDir?: string
  positionName?: string
  candidate: {
    name: string
    email: string
  }
  problem: {
    title: string
    description: string
    requirements: string
    scoringCriteria?: any
  }
}

export default function InterviewPage() {
  const params = useParams()
  const token = params.token as string
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchInterview = () => {
    fetch(`${API_BASE}/api/interview/${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.workspaceUrl) {
          data.workspaceUrl = rewriteWorkspaceUrl(data.workspaceUrl)
        }
        setInterview(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchInterview()
  }, [token])

  const handleStart = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/interview/${token}/start`, {
        method: 'POST'
      })
      const data = await res.json()
      if (!res.ok) {
        alert(`启动失败: ${data.error || '未知错误'}`)
        console.error('Start interview error:', data)
        return
      }
      const rewritten = data.workspaceUrl ? rewriteWorkspaceUrl(data.workspaceUrl) : undefined
      setInterview({ ...data, workspaceUrl: rewritten })
      if (rewritten) {
        window.open(rewritten, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      console.error('Start interview exception:', err)
      alert('启动失败，请查看控制台')
    }
  }

  const handleSubmit = () => {
    fetchInterview()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="rounded-xl border border-border bg-white px-8 py-7 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="text-base font-semibold text-slate-950">加载面试数据</div>
          <div className="mt-2 text-sm text-slate-500">正在获取题目、候选人与作答状态...</div>
        </div>
      </div>
    )
  }

  if (!interview || !interview.problem || !interview.candidate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="rounded-xl border border-red-200 bg-white px-8 py-7 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="text-base font-semibold text-slate-950">面试数据加载失败</div>
          <div className="mt-2 text-sm text-slate-500">链接可能无效，或面试记录暂不可用。</div>
        </div>
      </div>
    )
  }

  // PENDING status - show launch panel
  if (interview.status === 'PENDING') {
    return (
      <CandidateLaunchPanel
        problemTitle={interview.problem.title}
        duration={interview.duration}
        candidateName={interview.candidate.name}
        positionName={interview.positionName}
        scheduledStartAt={interview.scheduledStartAt}
        joinWindowOpensAt={interview.joinWindowOpensAt}
        joinDeadlineAt={interview.joinDeadlineAt}
        workDir={interview.workDir}
        onStart={handleStart}
      />
    )
  }

  // IN_PROGRESS status - show workspace panel
  if (interview.status === 'IN_PROGRESS' && interview.endTime) {
    return (
      <CandidateWorkspacePanel
        problemTitle={interview.problem.title}
        problemDescription={interview.problem.description}
        problemRequirements={interview.problem.requirements}
        candidateName={interview.candidate.name}
        positionName={interview.positionName}
        endTime={interview.endTime}
        workspaceUrl={interview.workspaceUrl}
        token={token}
        workDir={interview.workDir}
        onSubmit={handleSubmit}
      />
    )
  }

  // COMPLETED, EXPIRED, CANCELLED, SUBMITTED - show complete panel
  return (
    <CandidateCompletePanel
      problemTitle={interview.problem.title}
      candidateName={interview.candidate.name}
      positionName={interview.positionName}
      status={interview.status}
      submittedAt={interview.submittedAt}
      endReason={interview.endReason}
    />
  )
}

'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CandidateLaunchPanelProps {
  problemTitle: string
  problemDescription: string
  duration: number
  candidateName: string
  scheduledStartAt?: string
  joinWindowOpensAt?: string
  joinDeadlineAt?: string
  onStart: () => void
}

export function CandidateLaunchPanel({
  problemTitle,
  problemDescription,
  duration,
  candidateName,
  scheduledStartAt,
  joinWindowOpensAt,
  joinDeadlineAt,
  onStart
}: CandidateLaunchPanelProps) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3">
          <Badge variant="outline">Interview Workspace</Badge>
          <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-slate-950">{problemTitle}</h1>
          <p className="text-sm text-slate-500">候选人：{candidateName}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>开始前确认</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
              <h2 className="text-base font-semibold text-blue-900">面试规则</h2>
              <ul className="mt-3 space-y-2 text-sm text-blue-900/80">
                <li>• 面试时长: {duration} 分钟</li>
                {scheduledStartAt && (
                  <li>• 预约开始: {new Date(scheduledStartAt).toLocaleString('zh-CN')}</li>
                )}
                {joinWindowOpensAt && (
                  <li>• 最早可开始: {new Date(joinWindowOpensAt).toLocaleString('zh-CN')}</li>
                )}
                {joinDeadlineAt && (
                  <li>• 最晚入场: {new Date(joinDeadlineAt).toLocaleString('zh-CN')}</li>
                )}
                <li>• 点击"开始面试"后，计时器将开始倒计时</li>
                <li>• OpenCode 编程环境将在新标签页中自动打开</li>
                <li>• 请在规定时间内完成编程任务</li>
                <li>• 完成后点击"提交面试"按钮结束面试</li>
                <li>• 时间到后系统将自动结束面试</li>
              </ul>
            </div>

            <div>
              <h2 className="mb-2 text-base font-semibold text-slate-950">题目描述</h2>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{problemDescription}</p>
            </div>

            <div className="flex justify-center pt-2">
              <Button size="lg" onClick={onStart} className="px-12">
                开始面试
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

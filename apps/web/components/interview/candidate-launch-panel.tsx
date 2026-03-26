'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface CandidateLaunchPanelProps {
  problemTitle: string
  duration: number
  candidateName: string
  positionName?: string
  scheduledStartAt?: string
  joinWindowOpensAt?: string
  joinDeadlineAt?: string
  workDir?: string
  onStart: () => void
}

export function CandidateLaunchPanel({
  problemTitle,
  duration,
  candidateName,
  positionName,
  workDir,
  onStart
}: CandidateLaunchPanelProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white">
            编程面试
          </div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-slate-950">
            欢迎参加面试
          </h1>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              {candidateName}
            </Badge>
            {positionName && (
              <Badge variant="outline" className="text-sm px-3 py-1">
                {positionName}
              </Badge>
            )}
          </div>
        </div>

        {/* 面试必读卡片 */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">📋</span>
              <h2 className="text-lg font-bold text-slate-900">
                面试必读 — 请仔细阅读以下事项
              </h2>
            </div>

            <ol className="space-y-4 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">1</span>
                <span>点击下方按钮将打开编程环境，<strong className="text-slate-900">面试正式开始计时</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">2</span>
                <span>进入编程环境后，题目在 <strong className="text-slate-900 font-mono bg-blue-100 px-1.5 py-0.5 rounded">题目与要求.md</strong> 文件中，请先查看题目</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">3</span>
                <span><strong className="text-slate-900">务必确认打开目标项目目录</strong>{workDir && <>：<code className="font-mono bg-blue-100 px-1.5 py-0.5 rounded text-slate-900 text-xs">{workDir}</code></>}，且只在该目录下完成开发，否则可能影响 AI 评分</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">4</span>
                <span>面试时长为 <strong className="text-slate-900">{duration} 分钟</strong>，超时将自动结束</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">5</span>
                <span>完成后请<strong className="text-slate-900">回到此页面</strong>点击"提交面试"按钮</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* 面试信息卡片 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <div className="text-slate-500">
                题目名称：<span className="font-medium text-slate-900">{problemTitle}</span>
              </div>
              <Badge variant="secondary">{duration} 分钟</Badge>
            </div>
          </CardContent>
        </Card>

        {/* 开始面试按钮 */}
        <div className="flex justify-center pt-4">
          <Button
            size="lg"
            onClick={onStart}
            className="px-16 py-6 text-base font-semibold bg-blue-600 hover:bg-blue-700"
          >
            开始面试
          </Button>
        </div>
      </div>
    </div>
  )
}

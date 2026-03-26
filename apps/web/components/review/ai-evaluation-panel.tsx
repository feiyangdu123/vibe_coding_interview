'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface EvaluationDimension {
  name: string
  score: number
  reasoning: string
}

interface EvaluationDetails {
  totalScore: number
  dimensions: EvaluationDimension[]
  summary: string
}

interface AiEvaluationPanelProps {
  details: EvaluationDetails
  score?: number
  rawOutput?: string | null
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function getScoreRingColor(score: number): string {
  if (score >= 70) return 'stroke-emerald-500'
  if (score >= 50) return 'stroke-amber-500'
  return 'stroke-red-500'
}

function getScoreTrackColor(score: number): string {
  if (score >= 70) return 'stroke-emerald-100'
  if (score >= 50) return 'stroke-amber-100'
  return 'stroke-red-100'
}

function getDimBarColor(score: number, maxScore: number = 20): string {
  const ratio = score / maxScore
  if (ratio >= 0.75) return 'bg-emerald-500'
  if (ratio >= 0.5) return 'bg-amber-500'
  return 'bg-red-500'
}

function getDimBorderColor(score: number, maxScore: number = 20): string {
  const ratio = score / maxScore
  if (ratio >= 0.75) return 'border-emerald-500'
  if (ratio >= 0.5) return 'border-amber-500'
  return 'border-red-500'
}

function ScoreRing({ score }: { score: number }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="6"
          className={getScoreTrackColor(score)}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={getScoreRingColor(score)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${getScoreColor(score)}`}>
          {score.toFixed(1)}
        </span>
        <span className="text-xs text-gray-400">/100</span>
      </div>
    </div>
  )
}

function RawOutputViewer({ rawOutput }: { rawOutput: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-medium text-slate-400">AI 评估完整输出</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <div className="bg-slate-900 p-4 max-h-[600px] overflow-y-auto">
        <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-slate-300">
          {rawOutput}
        </pre>
      </div>
    </div>
  )
}

export function AiEvaluationPanel({ details, score, rawOutput }: AiEvaluationPanelProps) {
  const displayScore = score ?? details.totalScore
  const hasDimensions = details.dimensions && details.dimensions.length > 0
  const hasRawOutput = !!rawOutput

  // Fallback: no structured data, show rawOutput
  if (!hasDimensions && !details.summary && rawOutput) {
    return (
      <div className="space-y-4">
        {displayScore > 0 && (
          <div className="flex justify-center py-2">
            <ScoreRing score={displayScore} />
          </div>
        )}
        <RawOutputViewer rawOutput={rawOutput} />
      </div>
    )
  }

  const scoreOverviewContent = (
    <div className="space-y-5">
      {/* Hero score + summary */}
      <div className="flex items-center gap-6">
        <ScoreRing score={displayScore} />
        {details.summary && (
          <p className="text-sm text-gray-700 leading-relaxed flex-1">{details.summary}</p>
        )}
      </div>

      {/* Dimensions - all expanded with color bands */}
      {hasDimensions && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 mb-2">各维度评分</h3>
          {details.dimensions.map((dim, idx) => (
            <div key={idx} className={`border rounded-lg overflow-hidden border-l-4 ${getDimBorderColor(dim.score)}`}>
              <div className="flex items-center gap-3 p-3">
                <span className="text-sm font-medium text-gray-800 flex-1">{dim.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getDimBarColor(dim.score)}`}
                      style={{ width: `${(dim.score / 20) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 w-10 text-right">
                    {dim.score.toFixed(1)}/20
                  </span>
                </div>
              </div>
              {dim.reasoning && (
                <div className="px-4 pb-3">
                  <p className="text-sm text-gray-600 leading-relaxed">{dim.reasoning}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // If there's rawOutput, show Tabs layout; otherwise just show the score overview
  if (!hasRawOutput) {
    return scoreOverviewContent
  }

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList>
        <TabsTrigger value="overview">评分概览</TabsTrigger>
        <TabsTrigger value="process">评估过程</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="mt-4">
        {scoreOverviewContent}
      </TabsContent>
      <TabsContent value="process" className="mt-4">
        <RawOutputViewer rawOutput={rawOutput!} />
      </TabsContent>
    </Tabs>
  )
}

'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

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
  if (score >= 7) return 'text-emerald-600'
  if (score >= 5) return 'text-amber-600'
  return 'text-red-600'
}

function getScoreRingColor(score: number): string {
  if (score >= 7) return 'stroke-emerald-500'
  if (score >= 5) return 'stroke-amber-500'
  return 'stroke-red-500'
}

function getScoreTrackColor(score: number): string {
  if (score >= 7) return 'stroke-emerald-100'
  if (score >= 5) return 'stroke-amber-100'
  return 'stroke-red-100'
}

function getDimBarColor(score: number): string {
  if (score >= 1.5) return 'bg-emerald-500'
  if (score >= 1) return 'bg-amber-500'
  return 'bg-red-500'
}

function ScoreRing({ score }: { score: number }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const progress = (score / 10) * circumference

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
        <span className="text-xs text-gray-400">/10</span>
      </div>
    </div>
  )
}

export function AiEvaluationPanel({ details, score, rawOutput }: AiEvaluationPanelProps) {
  const [expandedDim, setExpandedDim] = useState<number | null>(null)
  const displayScore = score ?? details.totalScore
  const hasDimensions = details.dimensions && details.dimensions.length > 0

  // Fallback: no structured data, show rawOutput
  if (!hasDimensions && !details.summary && rawOutput) {
    return (
      <div className="space-y-4">
        {displayScore > 0 && (
          <div className="flex justify-center py-2">
            <ScoreRing score={displayScore} />
          </div>
        )}
        <div className="bg-gray-50 border rounded-lg p-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{rawOutput}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Hero score + summary */}
      <div className="flex items-center gap-6">
        <ScoreRing score={displayScore} />
        {details.summary && (
          <p className="text-sm text-gray-700 leading-relaxed flex-1">{details.summary}</p>
        )}
      </div>

      {/* Dimensions accordion */}
      {hasDimensions && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-gray-500 mb-2">各维度评分</h3>
          {details.dimensions.map((dim, idx) => {
            const isExpanded = expandedDim === idx
            return (
              <div key={idx} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedDim(isExpanded ? null : idx)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                  <span className="text-sm font-medium text-gray-800 flex-1">{dim.name}</span>
                  {/* Score bar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getDimBarColor(dim.score)}`}
                        style={{ width: `${(dim.score / 2) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 w-8 text-right">
                      {dim.score.toFixed(1)}/2
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-10 pb-3">
                    <p className="text-sm text-gray-600 leading-relaxed">{dim.reasoning}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

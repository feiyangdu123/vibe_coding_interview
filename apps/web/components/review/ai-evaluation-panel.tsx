'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

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
}

export function AiEvaluationPanel({ details, score }: AiEvaluationPanelProps) {
  const displayScore = score ?? details.totalScore

  return (
    <div className="space-y-4">
      {/* Total Score */}
      <div className="flex items-center gap-4">
        <span className="text-lg font-semibold">总分:</span>
        <Badge
          variant={
            displayScore >= 7 ? 'success' :
            displayScore >= 5 ? 'warning' : 'error'
          }
          className="text-2xl font-bold px-4 py-2"
        >
          {displayScore.toFixed(1)}/10
        </Badge>
      </div>

      {/* Dimensions */}
      {details.dimensions && details.dimensions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">各维度评分:</h3>
          {details.dimensions.map((dim, idx) => (
            <Card key={idx} className="p-4 bg-gray-50">
              <div className="flex items-start justify-between mb-2">
                <span className="font-medium text-gray-900">{dim.name}</span>
                <Badge
                  variant={dim.score >= 1.5 ? 'success' : dim.score >= 1 ? 'warning' : 'error'}
                  className="font-semibold"
                >
                  {dim.score.toFixed(1)}/2
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{dim.reasoning}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {details.summary && (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900">整体评价:</h3>
          <p className="text-gray-700 bg-blue-50 p-4 rounded-lg">{details.summary}</p>
        </div>
      )}
    </div>
  )
}

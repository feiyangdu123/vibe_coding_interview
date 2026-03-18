'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface CandidateCompletePanelProps {
  problemTitle: string
  candidateName: string
  status: string
  submittedAt?: string
  endReason?: string
}

export function CandidateCompletePanel({
  problemTitle,
  candidateName,
  status,
  submittedAt,
  endReason
}: CandidateCompletePanelProps) {
  const getStatusMessage = () => {
    if (endReason === 'CANDIDATE_SUBMIT') {
      return '您已成功提交面试'
    }
    if (endReason === 'TIME_UP') {
      return '面试时间已到，系统已自动结束'
    }
    if (endReason === 'INTERVIEWER_STOP') {
      return '面试官已结束面试'
    }
    if (endReason === 'SYSTEM_ERROR') {
      return '面试因系统错误已结束'
    }
    if (endReason === 'CANDIDATE_NO_SHOW') {
      return '面试已因未到场关闭'
    }
    if (endReason === 'CANCELLED_BY_ORG') {
      return '面试已被面试官取消'
    }
    if (status === 'CANCELLED') {
      return '面试已取消'
    }
    return '面试已结束'
  }

  const getStatusColor = () => {
    if (endReason === 'CANDIDATE_SUBMIT') return 'text-green-600'
    if (endReason === 'TIME_UP') return 'text-blue-600'
    if (endReason === 'INTERVIEWER_STOP') return 'text-orange-600'
    if (endReason === 'SYSTEM_ERROR') return 'text-red-600'
    if (endReason === 'CANDIDATE_NO_SHOW') return 'text-gray-600'
    if (endReason === 'CANCELLED_BY_ORG') return 'text-gray-600'
    return 'text-gray-600'
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <Badge variant="outline">Interview Result</Badge>
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-slate-950">{problemTitle}</h1>
          <p className="text-sm text-slate-500">候选人：{candidateName}</p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <div className={`mb-4 text-4xl font-bold ${getStatusColor()}`}>
                {getStatusMessage()}
            </div>

            {submittedAt && (
              <p className="mb-6 text-sm text-slate-500">
                提交时间：{new Date(submittedAt).toLocaleString('zh-CN')}
              </p>
            )}

            <div className="mx-auto max-w-2xl rounded-xl border border-blue-100 bg-blue-50 p-6">
              <p className="mb-3 font-medium text-blue-900">感谢您参加本次面试。</p>
              <p className="text-sm leading-7 text-blue-900/80">
                您的代码已保存，面试官将结合运行记录与评估结果进行审阅，并在后续通知您面试结论。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

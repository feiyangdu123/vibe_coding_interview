'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface ReviewDecisionFormProps {
  interviewId: string
  currentDecision?: string
  onSubmitSuccess: () => void
}

export function ReviewDecisionForm({ interviewId, currentDecision, onSubmitSuccess }: ReviewDecisionFormProps) {
  const [decision, setDecision] = useState<'pass' | 'fail' | 'pending'>(
    (currentDecision as 'pass' | 'fail' | 'pending') || 'pending'
  )
  const [notes, setNotes] = useState('')
  const [score, setScore] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast.error('请填写复核备注')
      return
    }

    setSubmitting(true)
    try {
      await apiFetch(`/api/admin/interviews/${interviewId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          notes: notes.trim(),
          score: score ? parseFloat(score) : undefined
        })
      })

      toast.success('复核结论提交成功')
      onSubmitSuccess()
    } catch (err) {
      console.error('Failed to submit review:', err)
      toast.error('提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle>提交最终结论</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Decision Radio Group */}
        <div className="space-y-2">
          <Label>最终结论</Label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="decision"
                value="pass"
                checked={decision === 'pass'}
                onChange={(e) => setDecision(e.target.value as 'pass')}
                className="w-4 h-4"
              />
              <span className="text-green-600 font-medium">通过</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="decision"
                value="fail"
                checked={decision === 'fail'}
                onChange={(e) => setDecision(e.target.value as 'fail')}
                className="w-4 h-4"
              />
              <span className="text-red-600 font-medium">不通过</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="decision"
                value="pending"
                checked={decision === 'pending'}
                onChange={(e) => setDecision(e.target.value as 'pending')}
                className="w-4 h-4"
              />
              <span className="text-yellow-600 font-medium">待定</span>
            </label>
          </div>
        </div>

        {/* Optional Score */}
        <div className="space-y-2">
          <Label htmlFor="score">人工评分（可选，0-100）</Label>
          <Input
            id="score"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="例如: 75"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">复核备注 *</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="请输入复核意见和理由..."
            rows={6}
            required
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full"
        >
          {submitting ? '提交中...' : '提交复核结论'}
        </Button>

        {currentDecision && (
          <div className="text-xs text-gray-500 text-center">
            当前结论: {
              currentDecision === 'pass' ? '通过' :
              currentDecision === 'fail' ? '不通过' : '待定'
            }
          </div>
        )}
      </CardContent>
    </Card>
  )
}

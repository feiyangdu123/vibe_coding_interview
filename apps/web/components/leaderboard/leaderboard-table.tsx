'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'

interface LeaderboardEntry {
  rank: number
  interviewId: string
  candidateName: string
  candidateEmail: string
  aiScore: number | null
  durationMinutes: number | null
  completedAt: string | null
  aiEvaluationDetails: any
  status: string
  endReason: string | null
}

interface LeaderboardTableProps {
  data: LeaderboardEntry[]
}

function scoreBadgeVariant(score: number | null): 'default' | 'secondary' | 'destructive' {
  if (score == null) return 'secondary'
  if (score >= 70) return 'default'
  if (score >= 40) return 'secondary'
  return 'destructive'
}

export function LeaderboardTable({ data }: LeaderboardTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">排名</TableHead>
          <TableHead>候选人</TableHead>
          <TableHead>AI 评分</TableHead>
          <TableHead>用时</TableHead>
          <TableHead>完成时间</TableHead>
          <TableHead className="w-12">详情</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              暂无已评估的面试记录
            </TableCell>
          </TableRow>
        ) : (
          data.map(entry => {
            const isExpanded = expandedId === entry.interviewId
            const report = entry.aiEvaluationDetails?.report || entry.aiEvaluationDetails

            return (
              <Fragment key={entry.interviewId}>
                <TableRow className="group cursor-pointer" onClick={() => report && toggleExpand(entry.interviewId)}>
                  <TableCell className="font-medium">
                    {entry.rank <= 3 ? (
                      <span className="text-lg">{entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}</span>
                    ) : (
                      <span className="text-muted-foreground">{entry.rank}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{entry.candidateName}</div>
                    <div className="text-xs text-muted-foreground">{entry.candidateEmail}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={scoreBadgeVariant(entry.aiScore)}>
                      {entry.aiScore ?? '--'} 分
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.durationMinutes != null ? `${entry.durationMinutes} 分钟` : '--'}
                  </TableCell>
                  <TableCell>
                    {entry.completedAt
                      ? new Date(entry.completedAt).toLocaleString('zh-CN', {
                          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                        })
                      : '--'}
                  </TableCell>
                  <TableCell>
                    {report && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(entry.interviewId) }}
                        className="p-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-slate-500" />
                          : <ChevronRight className="h-4 w-4 text-slate-500" />}
                      </button>
                    )}
                  </TableCell>
                </TableRow>
                {isExpanded && report && (
                  <TableRow>
                    <TableCell colSpan={6} className="!p-0">
                      <div className="border-t bg-slate-50 px-6 py-4">
                        <div className="text-sm font-medium mb-2">AI 评估报告</div>
                        <div className="prose prose-sm max-w-none">
                          <MarkdownRenderer content={typeof report === 'string' ? report : JSON.stringify(report, null, 2)} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

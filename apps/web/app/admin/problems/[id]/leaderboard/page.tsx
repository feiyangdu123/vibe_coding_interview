'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { PageHeader } from '@/components/admin/page-header'
import { PodiumCard } from '@/components/leaderboard/podium-card'
import { LeaderboardTable } from '@/components/leaderboard/leaderboard-table'
import { apiFetch } from '@/lib/api'
import type { PaginationMeta } from '@vibe/shared-types'

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

interface ProblemInfo {
  id: string
  title: string
  difficulty: string | null
  problemType: string | null
  duration: number
}

const difficultyLabel: Record<string, string> = {
  Easy: '简单',
  Medium: '中等',
  Hard: '困难',
}

const typeLabel: Record<string, string> = {
  ALGORITHM_MODELING: '算法与建模',
  FEATURE_DEV: '功能开发',
  DEBUG_FIX: '调试修复',
  DATA_PROCESSING: '数据处理与分析',
  AGENT_DEV: '智能体开发',
  ITERATION_REFACTOR: '迭代重构',
  PRODUCT_DESIGN: '产品设计',
}

export default function LeaderboardPage() {
  const params = useParams()
  const router = useRouter()
  const problemId = params.id as string

  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState<ProblemInfo | null>(null)
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1, limit: 20, total: 0, totalPages: 1
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(
          `/api/admin/problems/${problemId}/leaderboard?page=${page}&limit=${pageSize}`
        )
        setProblem(res.problem)
        setData(res.data)
        setPagination(res.pagination)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [problemId, page, pageSize])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!problem) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">题目未找到</div>
      </div>
    )
  }

  // First page top 3 for podium
  const podiumEntries = page === 1 ? data.filter(d => d.rank <= 3) : []

  return (
    <div className="console-page">
      <PageHeader
        meta="Leaderboard"
        title={`${problem.title} - 排行榜`}
        actions={
          <Button variant="outline" onClick={() => router.push('/admin/problems')}>
            <ArrowLeft className="h-4 w-4" />
            返回题目列表
          </Button>
        }
      />

      <div className="flex items-center gap-2 -mt-4 mb-4">
        <Trophy className="h-5 w-5 text-amber-500" />
        {problem.difficulty && (
          <Badge variant={
            problem.difficulty === 'Easy' ? 'default' :
            problem.difficulty === 'Medium' ? 'secondary' : 'destructive'
          }>
            {difficultyLabel[problem.difficulty] || problem.difficulty}
          </Badge>
        )}
        {problem.problemType && (
          <Badge variant="outline">
            {typeLabel[problem.problemType] || problem.problemType}
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">{problem.duration} 分钟</span>
      </div>

      {podiumEntries.length > 0 && (
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
          {/* Render in order: 2nd, 1st, 3rd for visual podium effect */}
          {[2, 1, 3].map(rank => {
            const entry = podiumEntries.find(e => e.rank === rank)
            if (!entry) return <div key={rank} />
            return (
              <PodiumCard
                key={entry.interviewId}
                rank={rank as 1 | 2 | 3}
                candidateName={entry.candidateName}
                aiScore={entry.aiScore}
                durationMinutes={entry.durationMinutes}
              />
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>完整排名</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaderboardTable data={data} />

          {pagination.total > 0 && (
            <Pagination
              page={pagination.page}
              pageSize={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

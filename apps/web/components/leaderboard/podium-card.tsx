import { cn } from '@/lib/utils'

interface PodiumCardProps {
  rank: 1 | 2 | 3
  candidateName: string
  aiScore: number | null
  durationMinutes: number | null
}

const rankConfig = {
  1: { medal: '🥇', border: 'border-amber-400', bg: 'bg-amber-50', text: 'text-amber-700', scoreSize: 'text-3xl' },
  2: { medal: '🥈', border: 'border-slate-300', bg: 'bg-slate-50', text: 'text-slate-600', scoreSize: 'text-2xl' },
  3: { medal: '🥉', border: 'border-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', scoreSize: 'text-2xl' },
}

export function PodiumCard({ rank, candidateName, aiScore, durationMinutes }: PodiumCardProps) {
  const config = rankConfig[rank]

  return (
    <div className={cn(
      'flex flex-col items-center rounded-xl border-2 p-5 transition-shadow hover:shadow-md',
      config.border, config.bg
    )}>
      <span className="text-3xl">{config.medal}</span>
      <div className={cn('mt-2 font-bold', config.scoreSize, config.text)}>
        {aiScore ?? '--'}
      </div>
      <div className="text-xs text-muted-foreground mt-1">分</div>
      <div className="mt-3 text-sm font-medium text-slate-900 truncate max-w-[140px]" title={candidateName}>
        {candidateName}
      </div>
      {durationMinutes != null && (
        <div className="mt-1 text-xs text-muted-foreground">
          用时 {durationMinutes} 分钟
        </div>
      )}
    </div>
  )
}

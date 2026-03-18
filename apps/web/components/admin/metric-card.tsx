import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string
  description?: string
  icon: LucideIcon
  tone?: 'default' | 'success' | 'warning'
}

const toneStyles = {
  default: 'border-blue-100 bg-blue-50 text-blue-700',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-100 bg-amber-50 text-amber-700'
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = 'default'
}: MetricCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="text-[28px] font-semibold tracking-[-0.03em] text-slate-950">{value}</div>
          {description ? <div className="text-sm leading-6 text-slate-500">{description}</div> : null}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg border',
            toneStyles[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}

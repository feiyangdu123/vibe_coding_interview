import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  meta?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  meta,
  actions,
  className
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-start md:justify-between',
        className
      )}
    >
      <div className="min-w-0 space-y-2">
        {meta ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {meta}
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

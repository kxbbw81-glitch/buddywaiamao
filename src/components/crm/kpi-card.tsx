'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  changeType?: 'increase' | 'decrease'
  icon: React.ReactNode
  variant?: 'emerald' | 'amber' | 'rose' | 'sky' | 'violet'
  isLoading?: boolean
}

const variantClasses: Record<string, string> = {
  emerald: 'kpi-emerald',
  amber: 'kpi-amber',
  rose: 'kpi-rose',
  sky: 'kpi-sky',
  violet: 'kpi-violet',
}

const iconColorClasses: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  rose: 'text-rose-600 dark:text-rose-400',
  sky: 'text-sky-600 dark:text-sky-400',
  violet: 'text-violet-600 dark:text-violet-400',
}

const borderGradientMap: Record<string, string> = {
  emerald: 'kpi-border-emerald',
  amber: 'kpi-border-amber',
  rose: 'kpi-border-rose',
  sky: 'kpi-border-sky',
  violet: 'kpi-border-violet',
}

export function KPICard({
  title,
  value,
  change,
  changeType = 'increase',
  icon,
  variant = 'emerald',
  isLoading = false,
}: KPICardProps) {
  if (isLoading) {
    return (
      <Card className="p-4 lg:p-6">
        <div className="flex items-start justify-between">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-4 w-20" />
      </Card>
    )
  }

  const isPositive = changeType === 'increase'

  return (
    <Card className={cn(
      'p-4 lg:p-6 relative overflow-hidden kpi-card-hover animate-fade-in-up',
      variantClasses[variant],
      borderGradientMap[variant],
    )}>
      {/* Subtle dot pattern overlay */}
      <div className="kpi-pattern-overlay pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <div className={cn('p-2 rounded-lg bg-white/50 dark:bg-black/20', iconColorClasses[variant])}>
            {icon}
          </div>
        </div>
        <p className="text-2xl lg:text-3xl font-bold tabular-nums crm-number tracking-tight">{value}</p>
        {change !== undefined && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5',
              isPositive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
            )}>
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {change > 0 ? '+' : ''}{change}%
            </span>
            <span className="text-xs text-muted-foreground">较上月</span>
          </div>
        )}
      </div>
    </Card>
  )
}

import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeTone = 'blue' | 'red' | 'amber' | 'purple' | 'gray'
const tones: Record<BadgeTone, string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  purple: 'bg-[#eeedfe] text-[#534ab7] ring-[#d9d7fb]',
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function Badge({ className, tone = 'gray', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset', tones[tone], className)} {...props} />
}

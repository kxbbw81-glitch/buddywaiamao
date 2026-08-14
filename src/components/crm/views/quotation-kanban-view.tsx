'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, CheckCircle, XCircle, Clock, AlertTriangle, Send } from 'lucide-react'
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { useCRMStore } from '@/store/use-crm-store'
import { QUOTATION_STATUS_LABELS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface QuotationRow {
  id: string
  quoteNo: string
  totalAmount: number
  profitRate: number
  tradeTerm: string
  currency: string
  status: string
  createdAt: string
  customer?: { id: string; companyName: string; country?: string } | null
  creator?: { name: string } | null
}

const COLUMN_CONFIG = [
  {
    key: 'draft_pending',
    label: '草稿/待审批',
    statuses: ['draft', 'pending'],
    icon: Clock,
    headerBg: 'bg-emerald-500',
    headerText: 'text-white',
    countBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
  },
  {
    key: 'sent',
    label: '已发送',
    statuses: ['sent'],
    icon: Send,
    headerBg: 'bg-amber-500',
    headerText: 'text-white',
    countBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dotColor: 'bg-amber-500',
  },
  {
    key: 'accepted',
    label: '已接受',
    statuses: ['accepted'],
    icon: CheckCircle,
    headerBg: 'bg-sky-500',
    headerText: 'text-white',
    countBg: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    dotColor: 'bg-sky-500',
  },
  {
    key: 'closed',
    label: '已结束',
    statuses: ['rejected', 'expired', 'cancelled'],
    icon: XCircle,
    headerBg: 'bg-rose-500',
    headerText: 'text-white',
    countBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    dotColor: 'bg-rose-500',
  },
]

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const mins = differenceInMinutes(now, d)
  const hours = differenceInHours(now, d)
  const days = differenceInDays(now, d)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 30) return `${days}天前`
  return `${Math.floor(days / 30)}个月前`
}

function getProfitColor(rate: number) {
  if (rate >= 20) return 'text-emerald-600 font-medium'
  if (rate >= 10) return 'text-amber-600'
  return 'text-red-600 font-bold'
}

function getProfitBarColor(rate: number) {
  if (rate >= 20) return 'bg-emerald-500'
  if (rate >= 10) return 'bg-amber-500'
  return 'bg-red-500'
}

export function QuotationKanbanView() {
  const { selectQuotation } = useCRMStore()
  const { data, isLoading } = useQuery({
    queryKey: ['quotations-kanban'],
    queryFn: () => fetch('/api/quotations?pageSize=100').then(r => r.json()),
 })

  const columns = useMemo(() => {
    const items = (data?.data || []) as QuotationRow[]
    return COLUMN_CONFIG.map(col => ({
      ...col,
      items: items.filter((q: QuotationRow) => col.statuses.includes(q.status)),
    }))
  }, [data])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-emerald-600 border-t-transparent animate-spin rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop: horizontal scroll */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-2">
        {columns.map((col) => {
          const Icon = col.icon
          return (
            <div key={col.key} className="kanban-column min-w-[280px] max-w-[320px] flex-shrink-0">
              {/* Column Header */}
              <div className={cn('rounded-t-lg px-3 py-2.5 flex items-center gap-2', col.headerBg, col.headerText)}>
                <Icon className="h-4 w-4" />
                <span className="font-medium text-sm">{col.label}</span>
                <Badge variant="secondary" className="ml-auto text-xs bg-white/20 text-white border-white/30 h-5 min-w-[24px] px-1.5">
                  {col.items.length}
                </Badge>
              </div>
              {/* Cards */}
              <div className="space-y-2 p-2 bg-muted/30 rounded-b-lg min-h-[120px]">
                <ScrollArea className="max-h-[60vh]">
                  {col.items.length > 0 ? (
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {col.items.map((item: QuotationRow) => (
                          <motion.div
                            key={item.id}
                            layoutId={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -5 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          >
                            <div
                              role="button"
                              tabIndex={0}
                              className={cn(
                                'kanban-card rounded-lg p-3 bg-card border cursor-pointer',
                                'hover:shadow-sm'
                              )}
                              onClick={() => selectQuotation(item.id)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectQuotation(item.id) }}
                              aria-label={`查看报价 ${item.quoteNo} 的详情`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className="font-mono text-xs font-medium">{item.quoteNo}</span>
                                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', col.countBg)}>{item.tradeTerm}</span>
                              </div>
                              <p className="text-sm font-medium truncate mb-1">{item.customer?.companyName || '未关联客户'}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-bold crm-number">{formatCurrency(item.totalAmount)}</span>
                                <div className="flex items-center gap-1">
                                  <div className="h-1.5 w-8 rounded-full overflow-hidden bg-muted">
                                    <div className={cn('h-full rounded-full transition-all', getProfitBarColor(item.profitRate))} style={{ width: `${Math.min(Math.max(item.profitRate, 0), 50) * 2}%` }} />
                                  </div>
                                  <span className={cn('text-[10px] crm-number', getProfitColor(item.profitRate))}>{item.profitRate.toFixed(1)}%</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(item.createdAt)}</p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Icon className="h-6 w-6 mb-1.5 opacity-30" />
                      <p className="text-xs">暂无{col.label.replace('/', '/')}的报价</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile: vertical stack */}
      <div className="md:hidden space-y-3">
        {columns.map((col) => {
          const Icon = col.icon
          return (
            <div key={col.key}>
              <div className={cn('rounded-lg px-3 py-2 flex items-center gap-2', col.headerBg, col.headerText)}>
                <Icon className="h-4 w-4" />
                <span className="font-medium text-sm">{col.label}</span>
                <Badge variant="secondary" className="ml-auto text-xs bg-white/20 text-white border-white/30 h-5 min-w-[24px] px-1.5">
                  {col.items.length}
                </Badge>
              </div>
              <ScrollArea className="max-h-64">
                <div className="flex gap-2 pb-2">
                  {col.items.map((item: QuotationRow) => (
                    <motion.div
                      key={item.id}
                      layoutId={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="min-w-[240px] shrink-0"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="kanban-card rounded-lg p-3 bg-card border cursor-pointer hover:shadow-sm"
                        onClick={() => selectQuotation(item.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') selectQuotation(item.id) }}
                        aria-label={`查看报价 ${item.quoteNo} 的详情`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-mono text-xs font-medium">{item.quoteNo}</span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', col.countBg)}>{item.tradeTerm}</span>
                        </div>
                        <p className="text-sm font-medium truncate mb-1">{item.customer?.companyName || '未关联客户'}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold crm-number">{formatCurrency(item.totalAmount)}</span>
                          <span className={cn('text-[10px] crm-number', getProfitColor(item.profitRate))}>{item.profitRate.toFixed(1)}%</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, CheckCircle2, AlertTriangle, DollarSign } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface PaymentRow {
  id: string
  amount: number
  paymentMethod: string
  status: string
  dueDate: string | null
  createdAt: string
  currency?: string
  order?: { id: string; orderNo: string; customer?: { id: string; companyName: string } | null } | null
}

const COLUMN_CONFIG = [
  {
    key: 'pending',
    label: '待付款',
    statuses: ['pending', 'partial'],
    icon: Clock,
    headerBg: 'bg-amber-500',
    headerText: 'text-white',
    countBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    key: 'overdue',
    label: '已逾期',
    statuses: ['overdue'],
    icon: AlertTriangle,
    headerBg: 'bg-rose-500',
    headerText: 'text-white',
    countBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  {
    key: 'completed',
    label: '已付清',
    statuses: ['completed'],
    icon: CheckCircle2,
    headerBg: 'bg-emerald-500',
    headerText: 'text-white',
    countBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
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

export function PaymentKanbanView() {
  const { selectOrder } = useCRMStore()
  const { data, isLoading } = useQuery({
    queryKey: ['payments-kanban'],
    queryFn: () => fetch('/api/payments?pageSize=100').then(r => r.json()),
  })

  const columns = useMemo(() => {
    const items = (data?.data || []) as PaymentRow[]
    return COLUMN_CONFIG.map(col => ({
      ...col,
      items: items.filter((p: PaymentRow) => col.statuses.includes(p.status)),
      totalAmount: items.filter((p: PaymentRow) => col.statuses.includes(p.status)).reduce((s, p) => s + (p.amount || 0), 0),
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
              {/* Column Amount Summary */}
              <div className="px-3 py-1.5 bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
                <span>合计</span>
                <span className="font-medium crm-number text-foreground">{formatCurrency(col.totalAmount)}</span>
              </div>
              {/* Cards */}
              <div className="space-y-2 p-2 bg-muted/30 rounded-b-lg min-h-[120px]">
                <ScrollArea className="max-h-[60vh]">
                  {col.items.length > 0 ? (
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {col.items.map((item: PaymentRow) => {
                          const isOverdue = item.status === 'overdue'
                          const daysOverdue = item.dueDate ? differenceInDays(new Date(), new Date(item.dueDate)) : 0
                          return (
                            <motion.div
                              key={item.id}
                              layoutId={item.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: isOverdue ? 0.85 : 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -5 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            >
                              <div
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  'kanban-card rounded-lg p-3 bg-card border cursor-pointer',
                                  'hover:shadow-sm',
                                  isOverdue && 'border-l-[3px] border-l-rose-500',
                                )}
                                onClick={() => item.order?.id && selectOrder(item.order.id)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') item.order?.id && selectOrder(item.order.id) }}
                                aria-label={`查看付款 ${item.order?.orderNo || ''} 的详情`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <span className="font-mono text-xs font-medium">{item.order?.orderNo || '-'}</span>
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', col.countBg)}>{item.paymentMethod}</span>
                                </div>
                                <p className="text-sm font-medium truncate mb-1.5">{item.order?.customer?.companyName || '未关联客户'}</p>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold crm-number">{formatCurrency(item.amount)}</span>
                                  {isOverdue && daysOverdue > 0 ? (
                                    <span className="text-[10px] text-rose-500 font-medium">逾期 {daysOverdue} 天</span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Icon className="h-6 w-6 mb-1.5 opacity-30" />
                      <p className="text-xs">暂无{col.label}的记录</p>
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
              <div className="px-3 py-1 bg-muted/50 text-xs text-muted-foreground flex items-center justify-between">
                <span>合计</span>
                <span className="font-medium crm-number text-foreground">{formatCurrency(col.totalAmount)}</span>
              </div>
              <ScrollArea className="max-h-64" horizontal>
                <div className="flex gap-2 pb-2">
                  {col.items.map((item: PaymentRow) => {
                    const isOverdue = item.status === 'overdue'
                    const daysOverdue = item.dueDate ? differenceInDays(new Date(), new Date(item.dueDate)) : 0
                    return (
                      <motion.div
                        key={item.id}
                        layoutId={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: isOverdue ? 0.85 : 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="min-w-[240px] shrink-0"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          className={cn(
                            'kanban-card rounded-lg p-3 bg-card border cursor-pointer hover:shadow-sm',
                            isOverdue && 'border-l-[3px] border-l-rose-500',
                          )}
                          onClick={() => item.order?.id && selectOrder(item.order.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') item.order?.id && selectOrder(item.order.id) }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-mono text-xs font-medium">{item.order?.orderNo || '-'}</span>
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', col.countBg)}>{item.paymentMethod}</span>
                          </div>
                          <p className="text-sm font-medium truncate mb-1">{item.order?.customer?.companyName || '未关联客户'}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold crm-number">{formatCurrency(item.amount)}</span>
                            {isOverdue && daysOverdue > 0 ? (
                              <span className="text-[10px] text-rose-500 font-medium">逾期 {daysOverdue} 天</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>
    </div>
  )
}

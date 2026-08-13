'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Factory, Truck, CheckCircle, LayoutGrid } from 'lucide-react'
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { useCRMStore } from '@/store/use-crm-store'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/types'
import { StatusBadge } from '@/components/crm/status-badge'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, formatCurrency } from '@/lib/utils'

interface OrderRow {
  id: string
  orderNo: string
  totalAmount: number
  currency: string
  paymentTerm: string
  status: string
  createdAt: string
  customer?: { companyName: string } | null
}

type KanbanColumnKey = 'pending_confirmed' | 'in_production' | 'shipped' | 'closed'

interface ColumnConfig {
  key: KanbanColumnKey
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  statuses: string[]
  headerBg: string
  headerText: string
  accentBorder: string
  cardBorder: string
  countBg: string
}

const COLUMN_CONFIG: ColumnConfig[] = [
  {
    key: 'pending_confirmed',
    label: '待确认',
    icon: ClipboardCheck,
    statuses: ['pending', 'confirmed'],
    headerBg: 'bg-emerald-500',
    headerText: 'text-white',
    accentBorder: 'border-t-emerald-500',
    cardBorder: 'hover:border-emerald-300 dark:hover:border-emerald-700',
    countBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    key: 'in_production',
    label: '生产中',
    icon: Factory,
    statuses: ['in_production'],
    headerBg: 'bg-teal-500',
    headerText: 'text-white',
    accentBorder: 'border-t-teal-500',
    cardBorder: 'hover:border-teal-300 dark:hover:border-teal-700',
    countBg: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  },
  {
    key: 'shipped',
    label: '已发货',
    icon: Truck,
    statuses: ['shipped', 'ready'],
    headerBg: 'bg-cyan-600',
    headerText: 'text-white',
    accentBorder: 'border-t-cyan-600',
    cardBorder: 'hover:border-cyan-300 dark:hover:border-cyan-700',
    countBg: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  },
  {
    key: 'closed',
    label: '已完成/已取消',
    icon: CheckCircle,
    statuses: ['completed', 'cancelled'],
    headerBg: 'bg-emerald-700',
    headerText: 'text-white',
    accentBorder: 'border-t-emerald-700',
    cardBorder: 'hover:border-emerald-400 dark:hover:border-emerald-600',
    countBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
]

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const minutes = differenceInMinutes(now, date)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = differenceInHours(now, date)
  if (hours < 24) return `${hours}小时前`
  const days = differenceInDays(now, date)
  if (days < 30) return `${days}天前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

function OrderCard({ order, config }: { order: OrderRow; config: ColumnConfig }) {
  const { selectOrder } = useCRMStore()
  const isCancelled = order.status === 'cancelled'

  return (
    <motion.div
      layoutId={`order-${order.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isCancelled ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={() => selectOrder(order.id)}
      className={cn(
        'p-3 rounded-lg border bg-card cursor-pointer transition-colors duration-150 hover:shadow-md active:scale-[0.98]',
        config.cardBorder,
        isCancelled && 'opacity-60'
      )}
      role="button"
      tabIndex={0}
      aria-label={`查看订单 ${order.orderNo} 的详情`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          selectOrder(order.id)
        }
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-xs font-medium text-muted-foreground">
          {order.orderNo}
        </span>
        <StatusBadge status={order.status} type="order" />
      </div>

      <p className="font-semibold text-sm leading-tight mb-2 line-clamp-1">
        {order.customer?.companyName || '未关联客户'}
      </p>

      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium crm-number">
          {formatCurrency(order.totalAmount, order.currency)}
        </span>
        {order.status === 'cancelled' && (
          <CheckCircle className="h-3.5 w-3.5 text-rose-500" />
        )}
        {order.status === 'completed' && (
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        )}
      </div>

      {order.paymentTerm && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <span className="line-clamp-1">{order.paymentTerm}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
        <span className="text-[10px] text-muted-foreground">
          {ORDER_STATUS_LABELS[order.status as OrderStatus] || order.status}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatRelativeDate(order.createdAt)}
        </span>
      </div>
    </motion.div>
  )
}

function EmptyColumnState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <LayoutGrid className="h-8 w-8 mb-2 opacity-30" />
      <p className="text-xs">暂无{label}</p>
    </div>
  )
}

export function OrderKanbanView() {
  const { searchQuery, filters } = useCRMStore()

  const { data, isLoading } = useQuery({
    queryKey: ['orders-kanban', searchQuery, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.orderStatus) params.set('status', filters.orderStatus)
      params.set('page', '1')
      params.set('pageSize', '100')
      return fetch(`/api/orders?${params}`).then((r) => r.json())
    },
  })

  const orders: OrderRow[] = data?.data || []

  const grouped = useMemo(() => {
    const groups: Record<KanbanColumnKey, OrderRow[]> = {
      pending_confirmed: [],
      in_production: [],
      shipped: [],
      closed: [],
    }
    for (const order of orders) {
      for (const col of COLUMN_CONFIG) {
        if (col.statuses.includes(order.status)) {
          groups[col.key].push(order)
          break
        }
      }
    }
    return groups
  }, [orders])

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-0">
      <div className="hidden md:block overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          {COLUMN_CONFIG.map((config) => {
            const Icon = config.icon
            const items = grouped[config.key] || []
            return (
              <div
                key={config.key}
                className={cn('w-72 flex-shrink-0 flex flex-col rounded-xl border bg-muted/30 border-t-2', config.accentBorder)}
              >
                <div className={cn('flex items-center gap-2 px-4 py-3 rounded-t-[10px]', config.headerBg)}>
                  <Icon className={cn('h-4 w-4', config.headerText)} />
                  <span className={cn('text-sm font-semibold', config.headerText)}>{config.label}</span>
                  <Badge className={cn('ml-auto h-5 text-[10px] px-1.5 border-0', config.countBg)}>
                    {items.length}
                  </Badge>
                </div>

                <ScrollArea className="flex-1 max-h-[calc(100vh-320px)]">
                  <div className="p-3 space-y-2.5">
                    <AnimatePresence mode="popLayout">
                      {items.length === 0 ? (
                        <EmptyColumnState label={config.label} />
                      ) : (
                        items.map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            config={config}
                          />
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </div>
            )
          })}
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {COLUMN_CONFIG.map((config) => {
          const Icon = config.icon
          const items = grouped[config.key] || []
          return (
            <div
              key={config.key}
              className={cn('rounded-xl border bg-muted/30 border-t-2', config.accentBorder)}
            >
              <div className={cn('flex items-center gap-2 px-4 py-2.5 rounded-t-[10px]', config.headerBg)}>
                <Icon className={cn('h-4 w-4', config.headerText)} />
                <span className={cn('text-sm font-semibold', config.headerText)}>{config.label}</span>
                <Badge className={cn('ml-auto h-5 text-[10px] px-1.5 border-0', config.countBg)}>
                  {items.length}
                </Badge>
              </div>

              {items.length === 0 ? (
                <div className="py-4">
                  <EmptyColumnState label={config.label} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex gap-2.5 p-3">
                    <AnimatePresence mode="popLayout">
                      {items.map((order) => (
                        <div key={order.id} className="w-64 flex-shrink-0">
                          <OrderCard
                            order={order}
                            config={config}
                          />
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

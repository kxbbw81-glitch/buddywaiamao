'use client'

import { useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, CheckCircle, XCircle, Clock, Send, LayoutGrid } from 'lucide-react'
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { useCRMStore } from '@/store/use-crm-store'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  useKanbanDnd,
  DndContext,
  SortableContext,
  DragOverlay,
  verticalListSortingStrategy,
  useSortableCard,
  getColumnHighlightClass,
  getColumnIndicatorClass,
  getInsertionIndicatorClass,
  type KanbanColumn,
} from '@/hooks/use-kanban-dnd'

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
  },
  {
    key: 'sent',
    label: '已发送',
    statuses: ['sent'],
    icon: Send,
    headerBg: 'bg-amber-500',
    headerText: 'text-white',
    countBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    key: 'accepted',
    label: '已接受',
    statuses: ['accepted'],
    icon: CheckCircle,
    headerBg: 'bg-teal-500',
    headerText: 'text-white',
    countBg: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  },
  {
    key: 'closed',
    label: '已结束',
    statuses: ['rejected', 'expired', 'cancelled'],
    icon: XCircle,
    headerBg: 'bg-rose-500',
    headerText: 'text-white',
    countBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
]

/** Map column key to target status when dropped */
function getColumnTargetStatus(columnKey: string, currentStatus: string): string {
  switch (columnKey) {
    case 'draft_pending': return currentStatus === 'pending' ? 'pending' : 'draft'
    case 'sent': return 'sent'
    case 'accepted': return 'accepted'
    case 'closed': {
      const closedStatuses = ['rejected', 'expired', 'cancelled']
      return closedStatuses.includes(currentStatus) ? currentStatus : 'cancelled'
    }
    default: return currentStatus
  }
}

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

function QuotationCardContent({ item, col }: { item: QuotationRow; col: typeof COLUMN_CONFIG[number] }) {
  return (
    <>
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
    </>
  )
}

function SortableQuotationCard({ item, col, isGlobalDragging, overId }: {
  item: QuotationRow; col: typeof COLUMN_CONFIG[number]; isGlobalDragging: boolean; overId: string | null
}) {
  const { selectQuotation } = useCRMStore()
  const { attributes, listeners, setNodeRef, style } = useSortableCard(item.id)
  const insertionClass = getInsertionIndicatorClass(item.id, overId, null, isGlobalDragging)

  return (
    <div ref={setNodeRef} style={style} className={insertionClass}>
      <motion.div
        layoutId={item.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <div
          role="button"
          tabIndex={0}
          className="kanban-card rounded-lg p-3 bg-card border cursor-grab active:cursor-grabbing hover:shadow-sm"
          onClick={() => !isGlobalDragging && selectQuotation(item.id)}
          onKeyDown={(e) => { if (!isGlobalDragging && (e.key === 'Enter' || e.key === ' ')) selectQuotation(item.id) }}
          aria-label={`查看报价 ${item.quoteNo} 的详情`}
          {...attributes}
          {...listeners}
        >
          <QuotationCardContent item={item} col={col} />
        </div>
      </motion.div>
    </div>
  )
}

export function QuotationKanbanView() {
  const queryClient = useQueryClient()

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

  const kanbanColumns: KanbanColumn[] = useMemo(() =>
    columns.map(col => ({
      key: col.key,
      ids: col.items.map((item: QuotationRow) => item.id),
    })),
    [columns]
  )

  const allItems = useMemo(() => (data?.data || []) as QuotationRow[], [data])

  const handleDrop = useCallback(async (itemId: string, columnKey: string) => {
    const item = allItems.find((q: QuotationRow) => q.id === itemId)
    if (!item) return
    const targetStatus = getColumnTargetStatus(columnKey, item.status)
    const res = await fetch('/api/bulk-update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'quotation', id: itemId, status: targetStatus }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || '更新失败')
    }
    queryClient.invalidateQueries({ queryKey: ['quotations-kanban'] })
  }, [allItems, queryClient])

  const {
    sensors, activeId, overId, isDragging,
    activeColumnKey, overColumnKey,
    handleDragStart, handleDragOver, handleDragEnd, handleDragCancel,
  } = useKanbanDnd({
    columns: kanbanColumns,
    onDrop: handleDrop,
  })

  const activeItem = useMemo(() =>
    allItems.find((q: QuotationRow) => q.id === activeId),
    [allItems, activeId]
  )

  const activeCol = useMemo(() =>
    activeItem ? COLUMN_CONFIG.find(col => col.statuses.includes(activeItem.status)) || COLUMN_CONFIG[0] : null,
    [activeItem]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-emerald-600 border-t-transparent animate-spin rounded-full" />
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DragOverlay>
        {activeItem && activeCol && (
          <div
            className="rounded-lg p-3 bg-card border-2 border-dashed border-emerald-400 shadow-xl"
            style={{ transform: 'scale(1.05)' }}
          >
            <QuotationCardContent item={activeItem} col={activeCol} />
          </div>
        )}
      </DragOverlay>

      <div className="space-y-4">
        {/* Desktop */}
        <div className="hidden md:flex gap-4 overflow-x-auto pb-2">
          {columns.map((col) => {
            const Icon = col.icon
            const highlightClass = getColumnHighlightClass(col.key, activeColumnKey, overColumnKey, isDragging)
            const indicatorClass = getColumnIndicatorClass(col.key, overColumnKey, activeColumnKey, isDragging)
            return (
              <div key={col.key} className={cn('kanban-column min-w-[280px] max-w-[320px] flex-shrink-0 transition-all duration-200', highlightClass, indicatorClass)}>
                <div className={cn('rounded-t-lg px-3 py-2.5 flex items-center gap-2', col.headerBg, col.headerText)}>
                  <Icon className="h-4 w-4" />
                  <span className="font-medium text-sm">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs bg-white/20 text-white border-white/30 h-5 min-w-[24px] px-1.5">
                    {col.items.length}
                  </Badge>
                </div>
                <div className="space-y-2 p-2 bg-muted/30 rounded-b-lg min-h-[120px]">
                  <ScrollArea className="max-h-[60vh]">
                    {col.items.length > 0 ? (
                      <div className="space-y-2">
                        <SortableContext items={col.items.map((item: QuotationRow) => item.id)} strategy={verticalListSortingStrategy}>
                          <AnimatePresence mode="popLayout">
                            {col.items.map((item: QuotationRow) => (
                              <SortableQuotationCard key={item.id} item={item} col={col} isGlobalDragging={isDragging} overId={overId} />
                            ))}
                          </AnimatePresence>
                        </SortableContext>
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

        {/* Mobile */}
        <div className="md:hidden space-y-3">
          {columns.map((col) => {
            const Icon = col.icon
            const highlightClass = getColumnHighlightClass(col.key, activeColumnKey, overColumnKey, isDragging)
            const indicatorClass = getColumnIndicatorClass(col.key, overColumnKey, activeColumnKey, isDragging)
            return (
              <div key={col.key} className={cn('transition-all duration-200', highlightClass, indicatorClass)}>
                <div className={cn('rounded-lg px-3 py-2 flex items-center gap-2', col.headerBg, col.headerText)}>
                  <Icon className="h-4 w-4" />
                  <span className="font-medium text-sm">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs bg-white/20 text-white border-white/30 h-5 min-w-[24px] px-1.5">
                    {col.items.length}
                  </Badge>
                </div>
                <ScrollArea className="max-h-64">
                  <div className="flex gap-2 pb-2">
                    <SortableContext items={col.items.map((item: QuotationRow) => item.id)} strategy={verticalListSortingStrategy}>
                      {col.items.map((item: QuotationRow) => (
                        <SortableQuotationCard key={item.id} item={item} col={col} isGlobalDragging={isDragging} overId={overId} />
                      ))}
                    </SortableContext>
                  </div>
                </ScrollArea>
              </div>
            )
          })}
        </div>
      </div>
    </DndContext>
  )
}
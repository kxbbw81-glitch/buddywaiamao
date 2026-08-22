'use client'

import { useMemo, useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Handshake, ClipboardCheck, FileText, MessageSquare, Trophy, XCircle,
  Plus, TrendingUp, Target, BarChart3, LayoutGrid,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCRMStore } from '@/store/use-crm-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { OpportunityFormDialog, OPPORTUNITY_STAGE_LABELS } from './opportunity-form-dialog'
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

interface OpportunityRow {
  id: string
  title: string
  stage: string
  amount: number
  currency: string
  probability: number
  expectedCloseDate: string | null
  lostReason: string | null
  createdAt: string
  customer?: { companyName: string } | null
  owner?: { name: string } | null
}

interface ColumnConfig {
  key: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  headerBg: string
  headerText: string
  accentBorder: string
  cardBorder: string
  countBg: string
}

const COLUMN_CONFIG: ColumnConfig[] = [
  {
    key: 'prospect', label: OPPORTUNITY_STAGE_LABELS.prospect, icon: Handshake,
    headerBg: 'bg-sky-500', headerText: 'text-white',
    accentBorder: 'border-t-sky-500',
    cardBorder: 'hover:border-sky-300 dark:hover:border-sky-700',
    countBg: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  },
  {
    key: 'qualified', label: OPPORTUNITY_STAGE_LABELS.qualified, icon: ClipboardCheck,
    headerBg: 'bg-cyan-500', headerText: 'text-white',
    accentBorder: 'border-t-cyan-500',
    cardBorder: 'hover:border-cyan-300 dark:hover:border-cyan-700',
    countBg: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  },
  {
    key: 'proposal', label: OPPORTUNITY_STAGE_LABELS.proposal, icon: FileText,
    headerBg: 'bg-amber-500', headerText: 'text-white',
    accentBorder: 'border-t-amber-500',
    cardBorder: 'hover:border-amber-300 dark:hover:border-amber-700',
    countBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    key: 'negotiation', label: OPPORTUNITY_STAGE_LABELS.negotiation, icon: MessageSquare,
    headerBg: 'bg-orange-500', headerText: 'text-white',
    accentBorder: 'border-t-orange-500',
    cardBorder: 'hover:border-orange-300 dark:hover:border-orange-700',
    countBg: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  {
    key: 'won', label: OPPORTUNITY_STAGE_LABELS.won, icon: Trophy,
    headerBg: 'bg-emerald-500', headerText: 'text-white',
    accentBorder: 'border-t-emerald-500',
    cardBorder: 'hover:border-emerald-300 dark:hover:border-emerald-700',
    countBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    key: 'lost', label: OPPORTUNITY_STAGE_LABELS.lost, icon: XCircle,
    headerBg: 'bg-rose-500', headerText: 'text-white',
    accentBorder: 'border-t-rose-500',
    cardBorder: 'hover:border-rose-300 dark:hover:border-rose-700',
    countBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
]

const LOST_REASON_LABELS: Record<string, string> = {
  price: '价格因素',
  competitor: '竞争对手',
  no_budget: '预算不足',
  no_response: '客户失联',
  product: '产品不匹配',
  other: '其他',
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`
  }
}

function OpportunityCardContent({ opportunity, isLost }: { opportunity: OpportunityRow; isLost: boolean }) {
  const closeDate = opportunity.expectedCloseDate ? new Date(opportunity.expectedCloseDate) : null
  const overdue = closeDate && !isLost && closeDate < new Date()

  return (
    <>
      <p className="font-semibold text-sm leading-tight mb-2 line-clamp-1">
        {opportunity.title}
      </p>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <span className="line-clamp-1">{opportunity.customer?.companyName || '未关联客户'}</span>
      </div>

      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
          {formatMoney(opportunity.amount, opportunity.currency)}
        </span>
        {!isLost && opportunity.stage !== 'won' && (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
            {opportunity.probability}%
          </Badge>
        )}
        {opportunity.stage === 'won' && (
          <Trophy className="h-3.5 w-3.5 text-emerald-500" />
        )}
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {opportunity.owner?.name || '未分配'}
        </span>
        {closeDate && (
          <span className={cn(
            'text-[10px] whitespace-nowrap',
            overdue ? 'text-rose-500 font-medium' : 'text-muted-foreground',
          )}>
            {overdue ? '逾期 ' : ''}{closeDate.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
          </span>
        )}
      </div>

      {isLost && opportunity.lostReason && (
        <p className="text-[10px] text-rose-500 mt-1">
          输单原因：{LOST_REASON_LABELS[opportunity.lostReason] || opportunity.lostReason}
        </p>
      )}
    </>
  )
}

function OpportunityCard({ opportunity, config, isLost, onEdit, isGlobalDragging, overId }: {
  opportunity: OpportunityRow
  config: ColumnConfig
  isLost: boolean
  onEdit: (id: string) => void
  isGlobalDragging: boolean
  overId: string | null
}) {
  const { attributes, listeners, setNodeRef, style, isDragging } = useSortableCard(opportunity.id)
  const showInsertion = getInsertionIndicatorClass(opportunity.id, overId, null, isGlobalDragging)

  return (
    <div ref={setNodeRef} style={style} className={showInsertion}>
      <motion.div
        layoutId={`opportunity-${opportunity.id}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: isLost ? 0.6 : 1, y: 0 }}
        exit={{ opacity: 0, y: -12, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        onClick={() => !isGlobalDragging && onEdit(opportunity.id)}
        className={cn(
          'p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-colors duration-150 hover:shadow-md active:scale-[0.98]',
          config.cardBorder,
          isLost && 'opacity-60'
        )}
        onKeyDown={(e) => {
          if (!isGlobalDragging && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onEdit(opportunity.id)
          }
        }}
        aria-label={`编辑商机 ${opportunity.title}`}
        {...attributes}
        {...listeners}
      >
        <OpportunityCardContent opportunity={opportunity} isLost={isLost} />
      </motion.div>
    </div>
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

export function OpportunityKanbanView() {
  const { searchQuery } = useCRMStore()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['opportunities', searchQuery],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      params.set('page', '1')
      params.set('pageSize', '200')
      return fetch(`/api/opportunities?${params}`).then((r) => r.json())
    },
  })

  const opportunities: OpportunityRow[] = data?.data || []

  const grouped = useMemo(() => {
    const groups: Record<string, OpportunityRow[]> = {}
    for (const col of COLUMN_CONFIG) groups[col.key] = []
    for (const o of opportunities) {
      if (groups[o.stage]) groups[o.stage].push(o)
    }
    return groups
  }, [opportunities])

  // 管道统计
  const stats = useMemo(() => {
    const open = opportunities.filter((o) => o.stage !== 'won' && o.stage !== 'lost')
    const won = opportunities.filter((o) => o.stage === 'won')
    const lost = opportunities.filter((o) => o.stage === 'lost')
    const openAmount = open.reduce((s, o) => s + o.amount, 0)
    const weighted = open.reduce((s, o) => s + (o.amount * o.probability) / 100, 0)
    const wonAmount = won.reduce((s, o) => s + o.amount, 0)
    const winRate = won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0
    return { openCount: open.length, openAmount, weighted, wonCount: won.length, wonAmount, winRate }
  }, [opportunities])

  const kanbanColumns: KanbanColumn[] = useMemo(
    () => COLUMN_CONFIG.map((config) => ({
      key: config.key,
      ids: (grouped[config.key] || []).map((o) => o.id),
    })),
    [grouped]
  )

  const openCreate = useCallback(() => {
    setEditId(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((id: string) => {
    setEditId(id)
    setFormOpen(true)
  }, [])

  const handleDrop = useCallback(async (itemId: string, columnKey: string) => {
    const opportunity = opportunities.find((o) => o.id === itemId)
    if (!opportunity || opportunity.stage === columnKey) return
    const res = await fetch(`/api/opportunities/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: columnKey }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error || '更新失败')
      throw new Error(err.error || '更新失败')
    }
    queryClient.invalidateQueries({ queryKey: ['opportunities'] })
  }, [opportunities, queryClient])

  const {
    sensors, activeId, overId, isDragging,
    activeColumnKey, overColumnKey,
    handleDragStart, handleDragOver, handleDragEnd, handleDragCancel,
  } = useKanbanDnd({
    columns: kanbanColumns,
    onDrop: handleDrop,
  })

  const activeOpportunity = useMemo(
    () => opportunities.find((o) => o.id === activeId),
    [opportunities, activeId]
  )

  const activeConfig = useMemo(
    () => (activeOpportunity ? COLUMN_CONFIG.find((c) => c.key === activeOpportunity.stage) || COLUMN_CONFIG[0] : null),
    [activeOpportunity]
  )

  const statsCards = [
    { label: '进行中商机', value: String(stats.openCount), icon: Target, color: 'text-sky-600 dark:text-sky-400' },
    { label: '管道总金额', value: formatMoney(stats.openAmount, 'USD'), icon: BarChart3, color: 'text-amber-600 dark:text-amber-400' },
    { label: '加权金额', value: formatMoney(Math.round(stats.weighted), 'USD'), icon: TrendingUp, color: 'text-teal-600 dark:text-teal-400' },
    { label: '赢单 / 赢单率', value: `${stats.wonCount} · ${stats.winRate.toFixed(0)}%`, icon: Trophy, color: 'text-emerald-600 dark:text-emerald-400' },
  ]

  const renderColumn = (config: ColumnConfig, items: OpportunityRow[], isMobile: boolean) => {
    const Icon = config.icon
    const highlightClass = getColumnHighlightClass(config.key, activeColumnKey, overColumnKey, isDragging)
    const indicatorClass = getColumnIndicatorClass(config.key, overColumnKey, activeColumnKey, isDragging)
    const columnAmount = items.reduce((s, o) => s + o.amount, 0)

    return (
      <div
        key={config.key}
        className={cn(
          isMobile
            ? 'rounded-xl border bg-muted/30 border-t-2 transition-all duration-200'
            : 'w-72 flex-shrink-0 flex flex-col rounded-xl border bg-muted/30 border-t-2 transition-all duration-200',
          config.accentBorder, highlightClass, indicatorClass
        )}
      >
        <div className={cn('flex items-center gap-2 px-4 py-3 rounded-t-[10px]', config.headerBg)}>
          <Icon className={cn('h-4 w-4 shrink-0', config.headerText)} />
          <span className={cn('text-sm font-semibold truncate', config.headerText)}>{config.label}</span>
          <Badge className={cn('ml-auto h-5 text-[10px] px-1.5 border-0 shrink-0', config.countBg)}>
            {items.length}
          </Badge>
        </div>

        {items.length > 0 && (
          <div className="px-3 pt-2">
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {formatMoney(columnAmount, 'USD')}
            </span>
          </div>
        )}

        {isMobile ? (
          <div className="overflow-x-auto">
            <div className="flex gap-2.5 p-3">
              <SortableContext items={items.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                <AnimatePresence mode="popLayout">
                  {items.map((o) => (
                    <div key={o.id} className="w-64 flex-shrink-0">
                      <OpportunityCard
                        opportunity={o}
                        config={config}
                        isLost={o.stage === 'lost'}
                        onEdit={openEdit}
                        isGlobalDragging={isDragging}
                        overId={overId}
                      />
                    </div>
                  ))}
                </AnimatePresence>
              </SortableContext>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 max-h-[calc(100vh-380px)]">
            <div className="p-3 space-y-2.5">
              <SortableContext items={items.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                <AnimatePresence mode="popLayout">
                  {items.length === 0 ? (
                    <EmptyColumnState label={config.label} />
                  ) : (
                    items.map((o) => (
                      <OpportunityCard
                        key={o.id}
                        opportunity={o}
                        config={config}
                        isLost={o.stage === 'lost'}
                        onEdit={openEdit}
                        isGlobalDragging={isDragging}
                        overId={overId}
                      />
                    ))
                  )}
                </AnimatePresence>
              </SortableContext>
            </div>
          </ScrollArea>
        )}
      </div>
    )
  }

  if (isLoading && opportunities.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 统计栏 + 新建入口 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid flex-1 grid-cols-2 md:grid-cols-4 gap-3">
          {statsCards.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <Icon className={cn('h-5 w-5 shrink-0', s.color)} />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className={cn('text-sm font-semibold tabular-nums truncate', s.color)}>{s.value}</p>
                </div>
              </div>
            )
          })}
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />新建商机
        </Button>
      </div>

      {/* 看板 */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <DragOverlay>
          {activeOpportunity && activeConfig && (
            <div
              className="p-3 rounded-lg border bg-card border-2 border-dashed border-emerald-400 shadow-xl"
              style={{ transform: 'scale(1.05)' }}
            >
              <OpportunityCardContent opportunity={activeOpportunity} isLost={activeOpportunity.stage === 'lost'} />
            </div>
          )}
        </DragOverlay>

        <div className="space-y-0">
          <div className="hidden md:block overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-2">
              {COLUMN_CONFIG.map((config) => {
                const items = grouped[config.key] || []
                return renderColumn(config, items, false)
              })}
            </div>
          </div>

          <div className="md:hidden space-y-4">
            {COLUMN_CONFIG.map((config) => {
              const items = grouped[config.key] || []
              return renderColumn(config, items, true)
            })}
          </div>
        </div>
      </DndContext>

      {/* 新建 / 编辑弹窗 */}
      <OpportunityFormDialog open={formOpen} editId={editId} onClose={() => setFormOpen(false)} />
    </div>
  )
}

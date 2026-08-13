'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Inbox, Phone, FileText, CheckCircle, XCircle, LayoutGrid } from 'lucide-react'
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { useCRMStore } from '@/store/use-crm-store'
import { INQUIRY_SOURCE_LABELS } from '@/lib/types'
import { StatusBadge } from '@/components/crm/status-badge'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface InquiryRow {
  id: string
  inquiryNo: string
  subject: string
  status: string
  priority: string
  source: string
  createdAt: string
  customer?: { companyName: string } | null
  assignee?: { name: string } | null
}

type StatusCategory = 'new' | 'following' | 'quoted' | 'closed'

interface ColumnConfig {
  key: StatusCategory
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
    key: 'new',
    label: '新询盘',
    icon: Inbox,
    statuses: ['new', 'assigned'],
    headerBg: 'bg-emerald-500',
    headerText: 'text-white',
    accentBorder: 'border-t-emerald-500',
    cardBorder: 'hover:border-emerald-300 dark:hover:border-emerald-700',
    countBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    key: 'following',
    label: '跟进中',
    icon: Phone,
    statuses: ['following'],
    headerBg: 'bg-amber-500',
    headerText: 'text-white',
    accentBorder: 'border-t-amber-500',
    cardBorder: 'hover:border-amber-300 dark:hover:border-amber-700',
    countBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    key: 'quoted',
    label: '已报价',
    icon: FileText,
    statuses: ['quoted'],
    headerBg: 'bg-sky-500',
    headerText: 'text-white',
    accentBorder: 'border-t-sky-500',
    cardBorder: 'hover:border-sky-300 dark:hover:border-sky-700',
    countBg: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  },
  {
    key: 'closed',
    label: '已成交/流失',
    icon: CheckCircle,
    statuses: ['won', 'lost'],
    headerBg: 'bg-rose-500',
    headerText: 'text-white',
    accentBorder: 'border-t-rose-500',
    cardBorder: 'hover:border-rose-300 dark:hover:border-rose-700',
    countBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
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

function InquiryCard({ inquiry, config, isLost }: { inquiry: InquiryRow; config: ColumnConfig; isLost: boolean }) {
  const { selectInquiry } = useCRMStore()

  return (
    <motion.div
      layoutId={`inquiry-${inquiry.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isLost ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={() => selectInquiry(inquiry.id)}
      className={cn(
        'p-3 rounded-lg border bg-card cursor-pointer transition-colors duration-150 hover:shadow-md active:scale-[0.98]',
        config.cardBorder,
        isLost && 'opacity-60'
      )}
      role="button"
      tabIndex={0}
      aria-label={`查看询盘 ${inquiry.inquiryNo} 的详情`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          selectInquiry(inquiry.id)
        }
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-xs font-medium text-muted-foreground">
          {inquiry.inquiryNo}
        </span>
        <StatusBadge status={inquiry.priority} type="priority" />
      </div>

      <p className="font-semibold text-sm leading-tight mb-2 line-clamp-1">
        {inquiry.subject || '无主题'}
      </p>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        <span className="line-clamp-1">
          {inquiry.customer?.companyName || '未关联客户'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground">
          {INQUIRY_SOURCE_LABELS[inquiry.source] || inquiry.source}
        </span>
        {inquiry.status === 'lost' && (
          <XCircle className="h-3.5 w-3.5 text-rose-500" />
        )}
        {inquiry.status === 'won' && (
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
        )}
      </div>

      <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {inquiry.assignee?.name || '未分配'}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatRelativeDate(inquiry.createdAt)}
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

export function InquiryKanbanView() {
  const { searchQuery, filters } = useCRMStore()

  const { data, isLoading } = useQuery({
    queryKey: ['inquiries-kanban', searchQuery, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.priority) params.set('priority', filters.priority)
      if (filters.source) params.set('source', filters.source)
      params.set('page', '1')
      params.set('pageSize', '100')
      return fetch(`/api/inquiries?${params}`).then((r) => r.json())
    },
  })

  const inquiries: InquiryRow[] = data?.data || []

  const grouped = useMemo(() => {
    const groups: Record<StatusCategory, InquiryRow[]> = {
      new: [],
      following: [],
      quoted: [],
      closed: [],
    }
    for (const inquiry of inquiries) {
      for (const col of COLUMN_CONFIG) {
        if (col.statuses.includes(inquiry.status)) {
          groups[col.key].push(inquiry)
          break
        }
      }
    }
    return groups
  }, [inquiries])

  if (isLoading && inquiries.length === 0) {
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
                        items.map((inquiry) => (
                          <InquiryCard
                            key={inquiry.id}
                            inquiry={inquiry}
                            config={config}
                            isLost={inquiry.status === 'lost'}
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
                      {items.map((inquiry) => (
                        <div key={inquiry.id} className="w-64 flex-shrink-0">
                          <InquiryCard
                            inquiry={inquiry}
                            config={config}
                            isLost={inquiry.status === 'lost'}
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

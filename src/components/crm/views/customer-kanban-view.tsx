'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, Star, Award, UserCircle, Users, Inbox } from 'lucide-react'
import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { useCRMStore } from '@/store/use-crm-store'
import { INQUIRY_SOURCE_LABELS } from '@/lib/types'
import { getCountryFlag } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface CustomerRow {
  id: string
  companyName: string
  companyNameEn?: string
  country?: string
  customerLevel: string
  source: string
  lastContactAt?: string
  owner?: { name: string } | null
  _count?: { inquiries: number }
}

const LEVEL_CONFIG = [
  {
    level: 'A',
    label: 'A级客户',
    icon: Star,
    headerBg: 'bg-emerald-500',
    headerText: 'text-white',
    accentBorder: 'border-t-emerald-500',
    cardBorder: 'hover:border-emerald-300 dark:hover:border-emerald-700',
    countBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
  },
  {
    level: 'B',
    label: 'B级客户',
    icon: Award,
    headerBg: 'bg-amber-500',
    headerText: 'text-white',
    accentBorder: 'border-t-amber-500',
    cardBorder: 'hover:border-amber-300 dark:hover:border-amber-700',
    countBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dotColor: 'bg-amber-500',
  },
  {
    level: 'C',
    label: 'C级客户',
    icon: UserCircle,
    headerBg: 'bg-sky-500',
    headerText: 'text-white',
    accentBorder: 'border-t-sky-500',
    cardBorder: 'hover:border-sky-300 dark:hover:border-sky-700',
    countBg: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    dotColor: 'bg-sky-500',
  },
  {
    level: 'D',
    label: 'D级客户',
    icon: Users,
    headerBg: 'bg-rose-500',
    headerText: 'text-white',
    accentBorder: 'border-t-rose-500',
    cardBorder: 'hover:border-rose-300 dark:hover:border-rose-700',
    countBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    dotColor: 'bg-rose-500',
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

function CustomerCard({ customer, levelConfig }: { customer: CustomerRow; levelConfig: typeof LEVEL_CONFIG[number] }) {
  const { selectCustomer } = useCRMStore()
  const inquiryCount = customer._count?.inquiries || 0

  return (
    <motion.div
      layoutId={`customer-${customer.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={() => selectCustomer(customer.id)}
      className={`
        p-3 rounded-lg border bg-card cursor-pointer
        transition-colors duration-150 ${levelConfig.cardBorder}
        hover:shadow-md active:scale-[0.98]
      `}
      role="button"
      tabIndex={0}
      aria-label={`查看客户 ${customer.companyName} 的详情`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCustomer(customer.id) } }}
    >
      {/* Company Name */}
      <p className="font-semibold text-sm leading-tight mb-2 line-clamp-1">
        {customer.companyName}
      </p>

      {/* Country */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        <span>{getCountryFlag(customer.country || '')}</span>
        <span className="line-clamp-1">{customer.country || '-'}</span>
      </div>

      {/* Source & Owner */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground line-clamp-1">
          {INQUIRY_SOURCE_LABELS[customer.source as keyof typeof INQUIRY_SOURCE_LABELS] || customer.source}
        </span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {customer.owner?.name || '-'}
        </span>
      </div>

      {/* Bottom Row: Inquiry Count & Last Contact */}
      <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
        {inquiryCount > 0 ? (
          <Badge variant="secondary" className="h-5 text-[10px] px-1.5 font-medium">
            <Inbox className="h-3 w-3 mr-0.5" />
            {inquiryCount}个询盘
          </Badge>
        ) : (
          <span />
        )}
        {customer.lastContactAt && (
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeDate(customer.lastContactAt)}
          </span>
        )}
      </div>
    </motion.div>
  )
}

function EmptyColumnState({ level }: { level: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <LayoutGrid className="h-8 w-8 mb-2 opacity-30" />
      <p className="text-xs">暂无{level}级客户</p>
    </div>
  )
}

export function CustomerKanbanView() {
  const { searchQuery, filters } = useCRMStore()

  const { data, isLoading } = useQuery({
    queryKey: ['customers-kanban', searchQuery, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.customerStatus) params.set('status', filters.customerStatus)
      // Fetch all customers for kanban (no level filter, we group client-side)
      params.set('page', '1')
      params.set('pageSize', '100')
      return fetch(`/api/customers?${params}`).then((r) => r.json())
    },
  })

  const customers: CustomerRow[] = data?.data || []

  const grouped = useMemo(() => {
    const groups: Record<string, CustomerRow[]> = { A: [], B: [], C: [], D: [] }
    for (const c of customers) {
      const level = c.customerLevel || 'D'
      if (groups[level]) {
        groups[level].push(c)
      }
    }
    return groups
  }, [customers])

  if (isLoading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* Desktop: horizontal scrollable kanban */}
      <div className="hidden md:block overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          {LEVEL_CONFIG.map((config) => {
            const Icon = config.icon
            const items = grouped[config.level] || []
            return (
              <div
                key={config.level}
                className={`w-72 flex-shrink-0 flex flex-col rounded-xl border bg-muted/30 ${config.accentBorder} border-t-2`}
              >
                {/* Column Header */}
                <div className={`flex items-center gap-2 px-4 py-3 rounded-t-[10px] ${config.headerBg}`}>
                  <Icon className={`h-4 w-4 ${config.headerText}`} />
                  <span className={`text-sm font-semibold ${config.headerText}`}>{config.label}</span>
                  <Badge className={`ml-auto h-5 text-[10px] px-1.5 border-0 ${config.countBg}`}>
                    {items.length}
                  </Badge>
                </div>

                {/* Cards */}
                <ScrollArea className="flex-1 max-h-[calc(100vh-320px)]">
                  <div className="p-3 space-y-2.5">
                    <AnimatePresence mode="popLayout">
                      {items.length === 0 ? (
                        <EmptyColumnState level={config.level} />
                      ) : (
                        items.map((customer) => (
                          <CustomerCard
                            key={customer.id}
                            customer={customer}
                            levelConfig={config}
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

      {/* Mobile: vertically stacked columns */}
      <div className="md:hidden space-y-4">
        {LEVEL_CONFIG.map((config) => {
          const Icon = config.icon
          const items = grouped[config.level] || []
          return (
            <div
              key={config.level}
              className={`rounded-xl border bg-muted/30 ${config.accentBorder} border-t-2`}
            >
              {/* Column Header */}
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-t-[10px] ${config.headerBg}`}>
                <Icon className={`h-4 w-4 ${config.headerText}`} />
                <span className={`text-sm font-semibold ${config.headerText}`}>{config.label}</span>
                <Badge className={`ml-auto h-5 text-[10px] px-1.5 border-0 ${config.countBg}`}>
                  {items.length}
                </Badge>
              </div>

              {/* Cards - horizontal scroll on mobile */}
              {items.length === 0 ? (
                <div className="py-4">
                  <EmptyColumnState level={config.level} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex gap-2.5 p-3">
                    <AnimatePresence mode="popLayout">
                      {items.map((customer) => (
                        <div key={customer.id} className="w-64 flex-shrink-0">
                          <CustomerCard
                            customer={customer}
                            levelConfig={config}
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

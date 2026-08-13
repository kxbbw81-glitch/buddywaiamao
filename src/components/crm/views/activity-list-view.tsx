'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock, Phone, Mail, Users, FileText, Info,
  Search, ChevronLeft, ChevronRight, ArrowLeft,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCRMStore } from '@/store/use-crm-store'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ============ Types ============
interface ActivityItem {
  id: string
  type: string
  subject: string | null
  content: string | null
  entityType: string | null
  entityId: string | null
  userId: string | null
  user: { name: string } | null
  readAt: string | null
  createdAt: string
}

// ============ Constants ============
const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  follow_up: { label: '跟进', icon: Clock, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30' },
  call: { label: '电话', icon: Phone, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30' },
  email: { label: '邮件', icon: Mail, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-900/30' },
  meeting: { label: '会议', icon: Users, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-900/30' },
  note: { label: '备注', icon: FileText, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  system: { label: '系统', icon: Info, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/30' },
  quote_sent: { label: '报价', icon: FileText, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30' },
  order_placed: { label: '订单', icon: FileText, color: 'text-teal-600 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-900/30' },
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  customer: '客户',
  inquiry: '询盘',
  quotation: '报价',
  order: '订单',
}

const TYPE_FILTER_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'follow_up', label: '跟进' },
  { value: 'call', label: '电话' },
  { value: 'email', label: '邮件' },
  { value: 'meeting', label: '会议' },
  { value: 'note', label: '备注' },
  { value: 'system', label: '系统' },
]

const DATE_RANGE_OPTIONS = [
  { value: '', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
]

const PAGE_SIZE = 20

// ============ Relative Time Helper ============
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`
  return `${Math.floor(diffDays / 365)}年前`
}

// ============ Component ============
export function ActivityListView() {
   const { setCurrentModule } = useCRMStore()

  // Filter state
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateRange, setDateRange] = useState('')
  const [page, setPage] = useState(1)

  // Debounced search for query
  const searchQuery = useMemo(() => search, [search])

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('search', searchQuery)
    if (typeFilter) params.set('type', typeFilter)
    if (dateRange) params.set('dateRange', dateRange)
    params.set('page', String(page))
    params.set('pageSize', String(PAGE_SIZE))
    return params.toString()
  }, [searchQuery, typeFilter, dateRange, page])

  // Fetch activities
  const { data, isLoading } = useQuery({
    queryKey: ['activities', searchQuery, typeFilter, dateRange, page],
    queryFn: () => fetch(`/api/activities?${queryParams}`).then((r) => r.json()),
  })

  const activities: ActivityItem[] = data?.data || []
  const total: number = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Reset page when filters change
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1) }
  const handleTypeChange = (v: string) => { setTypeFilter(v === '' ? '' : v); setPage(1) }
  const handleDateRangeChange = (v: string) => { setDateRange(v === '' ? '' : v); setPage(1) }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -ml-1"
          onClick={() => setCurrentModule('workbench')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">活动记录</h1>
          <p className="text-xs text-muted-foreground">查看所有操作记录和系统动态</p>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索活动内容..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={handleDateRangeChange}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder="全部时间" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <Card className="overflow-hidden">
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-xs font-medium text-muted-foreground text-left px-4 py-2.5 w-28">类型</th>
                <th className="text-xs font-medium text-muted-foreground text-left px-4 py-2.5">内容</th>
                <th className="text-xs font-medium text-muted-foreground text-left px-4 py-2.5 w-40 hidden md:table-cell">关联对象</th>
                <th className="text-xs font-medium text-muted-foreground text-left px-4 py-2.5 w-24 hidden sm:table-cell">操作人</th>
                <th className="text-xs font-medium text-muted-foreground text-left px-4 py-2.5 w-32">时间</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                // Skeleton loading
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t animate-pulse">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-7 w-7 rounded-full bg-muted" /><div className="h-4 bg-muted rounded w-12" /></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-3/4" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-muted rounded w-24" /></td>
                    <td className="px-4 py-3 hidden sm:table-cell"><div className="h-4 bg-muted rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20" /></td>
                  </tr>
                ))
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Clock className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm">暂无活动记录</p>
                    </div>
                  </td>
                </tr>
              ) : (
                activities.map((item, i) => {
                  const config = TYPE_CONFIG[item.type] || { label: item.type, icon: Info, color: 'text-muted-foreground', bgColor: 'bg-muted' }
                  const IconComp = config.icon
                  return (
                    <tr
                      key={item.id || i}
                      className={cn(
                        'border-t crm-table-row transition-colors',
                        i % 2 === 1 && 'crm-table-row-odd',
                      )}
                    >
                      {/* Type */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={cn('flex h-7 w-7 items-center justify-center rounded-full shrink-0', config.bgColor)}>
                            <IconComp className={cn('h-3.5 w-3.5', config.color)} />
                          </div>
                          <span className="text-xs font-medium whitespace-nowrap">{config.label}</span>
                        </div>
                      </td>

                      {/* Content */}
                      <td className="px-4 py-3">
                        <p className="text-sm truncate max-w-xs">{item.subject || item.content || '-'}</p>
                      </td>

                      {/* Entity */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        {item.entityType ? (
                          <Badge variant="secondary" className="text-xs font-normal">
                            {ENTITY_TYPE_LABELS[item.entityType] || item.entityType}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Operator */}
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {item.user?.name || '系统'}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && activities.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">
              共 <span className="font-medium text-foreground">{total}</span> 条
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
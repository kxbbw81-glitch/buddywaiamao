'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Plus, Download, List, LayoutGrid } from 'lucide-react'
import { toast } from 'sonner'
import { useCRMStore } from '@/store/use-crm-store'
import { DataTable } from '@/components/crm/data-table'
import { QuotationKanbanView } from './quotation-kanban-view'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { StatusBadge } from '@/components/crm/status-badge'
import { QUOTATION_STATUS_LABELS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { exportToCSV } from '@/lib/export-csv'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function QuotationListView() {
  const { searchQuery, filters, setFilters, openQuotationForm, selectQuotation } = useCRMStore()
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', searchQuery, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.quotationStatus) params.set('status', filters.quotationStatus)
      params.set('page', '1')
      params.set('pageSize', '50')
      return fetch(`/api/quotations?${params}`).then((r) => r.json())
    },
  })

  const quotations = data?.data || []

  const columns = [
    {
      key: 'quoteNo',
      header: '报价编号',
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-xs font-medium">{item.quoteNo as string}</span>
      ),
    },
    {
      key: 'customer',
      header: '客户',
      render: (item: Record<string, unknown>) => {
        const customer = item.customer as Record<string, unknown> | null
        return <span className="text-sm">{customer?.companyName as string || '-'}</span>
      },
    },
    {
      key: 'tradeTerm',
      header: '贸易条款',
      render: (item: Record<string, unknown>) => (
        <Badge variant="outline" className="text-xs">{item.tradeTerm as string}</Badge>
      ),
    },
    {
      key: 'totalAmount',
      header: '总金额',
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="text-sm font-medium crm-number">{formatCurrency(item.totalAmount as number)}</span>
      ),
    },
    {
      key: 'profitRate',
      header: '利润率',
      render: (item: Record<string, unknown>) => {
        const rate = item.profitRate as number
        const barWidth = Math.min(Math.max(rate, 0), 50) / 50 * 100
        const colorClass = rate >= 20
          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
          : rate >= 10
            ? 'text-amber-600 dark:text-amber-400'
            : rate > 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-red-500 font-bold'
        const barColor = rate >= 20 ? 'bg-emerald-500' : rate >= 10 ? 'bg-amber-500' : 'bg-red-500'
        return (
          <div className="flex items-center gap-2">
            <span className={cn('text-sm crm-number', colorClass)}>{rate.toFixed(1)}%</span>
            <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full', barColor)} style={{ width: `${barWidth}%` }} />
            </div>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: '状态',
      render: (item: Record<string, unknown>) => <StatusBadge status={item.status as string} type="quotation" />,
    },
    {
      key: 'validUntil',
      header: '有效期',
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-muted-foreground">
          {item.validUntil ? format(new Date(item.validUntil as string), 'yyyy-MM-dd', { locale: zhCN }) : '-'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Input placeholder="搜索报价编号..." className="h-9" value={searchQuery} onChange={(e) => useCRMStore.getState().setSearchQuery(e.target.value)} />
        </div>
        <Select value={filters.quotationStatus || 'all'} onValueChange={(v) => setFilters({ quotationStatus: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-28"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="pending">待审批</SelectItem>
            <SelectItem value="sent">已发送</SelectItem>
            <SelectItem value="accepted">已接受</SelectItem>
            <SelectItem value="rejected">已拒绝</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => { if (v) setViewMode(v as 'list' | 'kanban') }} className="bg-muted p-0.5 h-9">
            <ToggleGroupItem value="list" className="h-8 text-xs px-3 gap-1.5" aria-label="列表视图"><List className="h-3.5 w-3.5" /></ToggleGroupItem>
            <ToggleGroupItem value="kanban" className="h-8 text-xs px-3 gap-1.5" aria-label="看板视图"><LayoutGrid className="h-3.5 w-3.5" /></ToggleGroupItem>
          </ToggleGroup>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" /> 导出
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  if (!quotations.length) { toast.info('暂无数据可导出'); return }
                  const csvData = quotations.map((item: Record<string, unknown>) => {
                    const customer = item.customer as Record<string, unknown> | null
                    return {
                      quoteNo: item.quoteNo as string,
                      customerName: customer?.companyName as string || '',
                      tradeTerm: item.tradeTerm as string || '',
                      totalAmount: item.totalAmount as number,
                      profitRate: `${(item.profitRate as number).toFixed(1)}%`,
                      status: QUOTATION_STATUS_LABELS[item.status as keyof typeof QUOTATION_STATUS_LABELS] || (item.status as string),
                      createdAt: item.createdAt ? format(new Date(item.createdAt as string), 'yyyy-MM-dd') : '',
                    }
                  })
                  exportToCSV(csvData, '报价列表', [
                    { key: 'quoteNo', label: '报价编号' },
                    { key: 'customerName', label: '客户' },
                    { key: 'tradeTerm', label: '贸易条款' },
                    { key: 'totalAmount', label: '金额' },
                    { key: 'profitRate', label: '利润率' },
                    { key: 'status', label: '状态' },
                    { key: 'createdAt', label: '创建日期' },
                  ])
                  toast.success(`导出成功，共 ${quotations.length} 条数据`)
                }}
              >
                <Download className="h-4 w-4 mr-2 text-emerald-600" /> 导出CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => openQuotationForm()}>
            <Plus className="h-4 w-4 mr-1" /> 新建报价
          </Button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <QuotationKanbanView />
      ) : (
        <DataTable
          columns={columns}
          data={quotations}
          onRowClick={(item) => selectQuotation(item.id as string)}
          isLoading={isLoading && quotations.length === 0}
          emptyMessage="暂无报价数据"
          searchValue=""
          onSearchChange={() => {}}
        />
      )}
    </div>
  )
}

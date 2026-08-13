'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { toast } from 'sonner'
import { useCRMStore } from '@/store/use-crm-store'
import { DataTable } from '@/components/crm/data-table'
import { StatusBadge } from '@/components/crm/status-badge'
import { ORDER_STATUS_LABELS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn, formatCurrency } from '@/lib/utils'
import { exportToCSV } from '@/lib/export-csv'
import { Plus, Download } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ORDER_STAGES = ['pending', 'confirmed', 'in_production', 'ready', 'shipped', 'completed'] as const
const ORDER_STAGE_LABELS: Record<string, string> = {
  pending: '待确认', confirmed: '已确认', in_production: '生产中', ready: '待发货', shipped: '已发货', completed: '已完成',
}

function OrderStatusStepper({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-1.5" aria-label="已取消">
        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-red-100 dark:bg-red-900/50">
          <span className="text-[10px] text-red-600 dark:text-red-400 font-bold leading-none">×</span>
        </div>
        <span className="text-xs text-red-600 dark:text-red-400 font-medium">已取消</span>
      </div>
    )
  }
  const currentIdx = ORDER_STAGES.indexOf(status as typeof ORDER_STAGES[number])
  return (
    <div className="flex items-center gap-0.5" aria-label={ORDER_STAGE_LABELS[status] || status}>
      {ORDER_STAGES.map((stage, i) => {
        const isPast = i < currentIdx
        const isCurrent = i === currentIdx
        const isFuture = i > currentIdx
        return (
          <div
            key={stage}
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              isCurrent && 'bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800',
              isPast && 'bg-gray-400 dark:bg-gray-500',
              isFuture && 'bg-gray-200 dark:bg-gray-700',
            )}
            title={ORDER_STAGE_LABELS[stage]}
          />
        )
      })}
    </div>
  )
}

export function OrderListView() {
  const { searchQuery, filters, setFilters, selectOrder, openOrderForm } = useCRMStore()
  

  

  const { data, isLoading } = useQuery({
    queryKey: ['orders', searchQuery, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.orderStatus) params.set('status', filters.orderStatus)
      params.set('page', '1')
      params.set('pageSize', '50')
      return fetch(`/api/orders?${params}`).then((r) => r.json())
    },
  })

  const orders = data?.data || []

  const columns = [
    {
      key: 'orderNo',
      header: '订单号',
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-xs font-medium">{item.orderNo as string}</span>
      ),
    },
    {
      key: 'piNo',
      header: 'PI号',
      render: (item: Record<string, unknown>) => (
        <span className="text-xs font-mono">{item.piNo as string || '-'}</span>
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
      key: 'totalAmount',
      header: '总金额',
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="text-sm font-medium crm-number">{formatCurrency(item.totalAmount as number)}</span>
      ),
    },
    {
      key: 'paymentTerm',
      header: '付款条款',
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-muted-foreground truncate max-w-[120px] block">{item.paymentTerm as string || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: '状态',
      render: (item: Record<string, unknown>) => (
        <div className="flex flex-col gap-1">
          <OrderStatusStepper status={item.status as string} />
          <StatusBadge status={item.status as string} type="order" />
        </div>
      ),
    },
    {
      key: 'deliveryDate',
      header: '交货日期',
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-muted-foreground">
          {item.deliveryDate ? format(new Date(item.deliveryDate as string), 'yyyy-MM-dd', { locale: zhCN }) : '-'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Input placeholder="搜索订单号、PI号..." className="h-9" value={searchQuery} onChange={(e) => useCRMStore.getState().setSearchQuery(e.target.value)} />
        </div>
        <Select value={filters.orderStatus || 'all'} onValueChange={(v) => setFilters({ orderStatus: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-28"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待确认</SelectItem>
            <SelectItem value="confirmed">已确认</SelectItem>
            <SelectItem value="in_production">生产中</SelectItem>
            <SelectItem value="ready">待发货</SelectItem>
            <SelectItem value="shipped">已发货</SelectItem>
            <SelectItem value="completed">已完成</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" /> 导出
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  if (!orders.length) { toast.info('暂无数据可导出'); return }
                  const csvData = orders.map((item: Record<string, unknown>) => {
                    const customer = item.customer as Record<string, unknown> | null
                    return {
                      orderNo: item.orderNo as string,
                      customerName: customer?.companyName as string || '',
                      totalAmount: item.totalAmount as number,
                      paymentTerm: item.paymentTerm as string || '',
                      status: ORDER_STATUS_LABELS[item.status as keyof typeof ORDER_STATUS_LABELS] || (item.status as string),
                      createdAt: item.createdAt ? format(new Date(item.createdAt as string), 'yyyy-MM-dd') : '',
                    }
                  })
                  exportToCSV(csvData, '订单列表', [
                    { key: 'orderNo', label: '订单编号' },
                    { key: 'customerName', label: '客户' },
                    { key: 'totalAmount', label: '金额' },
                    { key: 'paymentTerm', label: '付款条款' },
                    { key: 'status', label: '状态' },
                    { key: 'createdAt', label: '创建日期' },
                  ])
                  toast.success(`导出成功，共 ${orders.length} 条数据`)
                }}
              >
                <Download className="h-4 w-4 mr-2 text-emerald-600" /> 导出CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => openOrderForm()}>
            <Plus className="h-4 w-4 mr-1" /> 新建订单
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        onRowClick={(item) => selectOrder(item.id as string)}
        isLoading={isLoading && orders.length === 0}
        emptyMessage="暂无订单数据"
        searchValue=""
        onSearchChange={() => {}}
      />
    </div>
  )
}

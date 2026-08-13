'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { DataTable } from '@/components/crm/data-table'
import { StatusBadge } from '@/components/crm/status-badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)
}

export function OrderListView() {
  const { searchQuery, filters, setFilters, selectOrder } = useCRMStore()
  

  

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
        <StatusBadge status={item.status as string} type="order" />
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

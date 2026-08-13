'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { StatusBadge } from '@/components/crm/status-badge'
import { DataTable } from '@/components/crm/data-table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)
}

export function PaymentListView() {
  const { filters, setFilters } = useCRMStore()
  

  

  const { data, isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const ordersRes = await fetch('/api/orders').then((r) => r.json())
      const orders = ordersRes.data || []
      const allPayments: Array<Record<string, unknown>> = []
      for (const order of orders) {
        const payments = await fetch(`/api/orders/${order.id}`).then((r) => r.json()).then((d) => d.data?.payments || [])
        for (const p of payments) {
          allPayments.push({ ...p, orderNo: order.orderNo, customerName: order.customer?.companyName })
        }
      }
      return allPayments
    },
  })

  const columns = [
    { key: 'orderNo', header: '订单号', render: (item: Record<string, unknown>) => <span className="font-mono text-xs">{item.orderNo as string}</span> },
    { key: 'customerName', header: '客户', render: (item: Record<string, unknown>) => <span className="text-sm">{item.customerName as string || '-'}</span> },
    { key: 'amount', header: '金额', sortable: true, render: (item: Record<string, unknown>) => <span className="text-sm font-medium crm-number">{formatCurrency(item.amount as number)}</span> },
    { key: 'paymentMethod', header: '付款方式', render: (item: Record<string, unknown>) => <span className="text-xs">{item.paymentMethod as string || '-'}</span> },
    { key: 'dueDate', header: '到期日', render: (item: Record<string, unknown>) => <span className={`text-xs ${item.status === 'overdue' ? 'text-rose-600 font-medium' : 'text-muted-foreground'}`}>{item.dueDate ? format(new Date(item.dueDate as string), 'yyyy-MM-dd', { locale: zhCN }) : '-'}</span> },
    { key: 'paymentDate', header: '付款日', render: (item: Record<string, unknown>) => <span className="text-xs text-muted-foreground">{item.paymentDate ? format(new Date(item.paymentDate as string), 'yyyy-MM-dd', { locale: zhCN }) : '-'}</span> },
    { key: 'status', header: '状态', render: (item: Record<string, unknown>) => <StatusBadge status={item.status as string} type="payment" /> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="搜索付款记录..." className="h-9 max-w-sm" />
        <Select value={filters.paymentStatus || 'all'} onValueChange={(v) => setFilters({ paymentStatus: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-28"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待付款</SelectItem>
            <SelectItem value="partial">部分付款</SelectItem>
            <SelectItem value="completed">已付清</SelectItem>
            <SelectItem value="overdue">逾期</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="暂无付款数据" searchValue="" onSearchChange={() => {}} />
    </div>
  )
}

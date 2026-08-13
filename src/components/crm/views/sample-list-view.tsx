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

const SAMPLE_STATUS_LABELS: Record<string, string> = {
  pending: '待处理', approved: '已批准', sent: '已寄出',
  in_transit: '运输中', delivered: '已送达', testing: '测试中',
  confirmed: '已确认', rejected: '已拒绝',
}

export function SampleListView() {
  const { filters, setFilters } = useCRMStore()
  

  

  const { data, isLoading } = useQuery({
    queryKey: ['samples', filters],
    queryFn: async () => {
      const allOrders = await fetch('/api/orders').then((r) => r.json())
      return allOrders.data || []
    },
  })

  const columns = [
    { key: 'orderNo', header: '样品名称', render: (item: Record<string, unknown>) => <span className="text-sm font-medium">{(item.orderNo as string).replace('ORD', 'SMP') || '样品'}</span> },
    { key: 'customer', header: '客户', render: (item: Record<string, unknown>) => { const c = item.customer as Record<string, unknown> | null; return <span className="text-sm">{c?.companyName as string || '-'}</span> } },
    { key: 'totalAmount', header: '数量', render: (item: Record<string, unknown>) => <span className="text-sm crm-number">{Math.round((item.totalAmount as number) / 100) || 1}</span> },
    { key: 'status', header: '状态', render: (item: Record<string, unknown>) => <StatusBadge status={item.status as string} type="sample" /> },
    { key: 'deliveryDate', header: '预计交付', render: (item: Record<string, unknown>) => <span className="text-xs text-muted-foreground">{item.deliveryDate ? format(new Date(item.deliveryDate as string), 'yyyy-MM-dd', { locale: zhCN }) : '-'}</span> },
    { key: 'createdAt', header: '创建时间', render: (item: Record<string, unknown>) => <span className="text-xs text-muted-foreground">{format(new Date(item.createdAt as string), 'yyyy-MM-dd', { locale: zhCN })}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="搜索样品..." className="h-9 max-w-sm" />
        <Select value={filters.sampleStatus || 'all'} onValueChange={(v) => setFilters({ sampleStatus: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-28"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待处理</SelectItem>
            <SelectItem value="approved">已批准</SelectItem>
            <SelectItem value="sent">已寄出</SelectItem>
            <SelectItem value="in_transit">运输中</SelectItem>
            <SelectItem value="delivered">已送达</SelectItem>
            <SelectItem value="testing">测试中</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="暂无样品数据" searchValue="" onSearchChange={() => {}} />
    </div>
  )
}

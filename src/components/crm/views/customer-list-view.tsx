'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { DataTable } from '@/components/crm/data-table'
import { StatusBadge } from '@/components/crm/status-badge'
import { INQUIRY_SOURCE_LABELS } from '@/lib/types'
import { getCountryFlag } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

export function CustomerListView() {
  const { searchQuery, filters, setFilters, openCustomerForm, selectCustomer } = useCRMStore()
  const queryClient = useQueryClient()
  

  

  const { data, isLoading } = useQuery({
    queryKey: ['customers', searchQuery, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.customerLevel) params.set('level', filters.customerLevel)
      if (filters.customerStatus) params.set('status', filters.customerStatus)
      params.set('page', '1')
      params.set('pageSize', '50')
      return fetch(`/api/customers?${params}`).then((r) => r.json())
    },
  })

  const customers = data?.data || []

  const columns = [
    {
      key: 'companyName',
      header: '公司名称',
      sortable: true,
      render: (item: Record<string, unknown>) => {
        const name = item.companyName as string
        const nameEn = item.companyNameEn as string
        const showEn = nameEn && nameEn !== name && !nameEn.startsWith(name + ' ') && !name.startsWith(nameEn + ' ')
        return (
          <div>
            <p className="font-medium">{showEn ? name : name}</p>
            {showEn && <p className="text-xs text-muted-foreground">{nameEn}</p>}
          </div>
        )
      },
    },
    {
      key: 'country',
      header: '国家',
      render: (item: Record<string, unknown>) => (
        <span className="text-sm">{getCountryFlag(item.country as string)} {item.country as string || '-'}</span>
      ),
    },
    {
      key: 'customerLevel',
      header: '级别',
      render: (item: Record<string, unknown>) => (
        <StatusBadge status={item.customerLevel as string} type="customer_level" />
      ),
    },
    {
      key: 'source',
      header: '来源',
      render: (item: Record<string, unknown>) => (
        <span className="text-sm text-muted-foreground">{INQUIRY_SOURCE_LABELS[item.source as keyof typeof INQUIRY_SOURCE_LABELS] || (item.source as string)}</span>
      ),
    },
    {
      key: 'owner',
      header: '负责人',
      render: (item: Record<string, unknown>) => {
        const owner = item.owner as Record<string, unknown> | null
        return <span className="text-sm">{owner?.name as string || '-'}</span>
      },
    },
    {
      key: 'lastContactAt',
      header: '最后联系',
      render: (item: Record<string, unknown>) => (
        <span className="text-sm text-muted-foreground">
          {item.lastContactAt ? format(new Date(item.lastContactAt as string), 'yyyy-MM-dd', { locale: zhCN }) : '-'}
        </span>
      ),
    },
    {
      key: '_count',
      header: '询盘数',
      render: (item: Record<string, unknown>) => {
        const count = item._count as Record<string, number> | undefined
        return <span className="text-sm font-medium crm-number">{count?.inquiries || 0}</span>
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索公司名称、国家..." className="pl-8 h-9" value={searchQuery} onChange={(e) => useCRMStore.getState().setSearchQuery(e.target.value)} />
        </div>
        <Select value={filters.customerLevel || 'all'} onValueChange={(v) => setFilters({ customerLevel: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-24">
            <SelectValue placeholder="级别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部级别</SelectItem>
            <SelectItem value="A">A级</SelectItem>
            <SelectItem value="B">B级</SelectItem>
            <SelectItem value="C">C级</SelectItem>
            <SelectItem value="D">D级</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.customerStatus || 'all'} onValueChange={(v) => setFilters({ customerStatus: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-24">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">活跃</SelectItem>
            <SelectItem value="inactive">不活跃</SelectItem>
            <SelectItem value="lost">流失</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => openCustomerForm()} className="ml-auto">
          <Plus className="h-4 w-4 mr-1" /> 新建客户
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={customers}
        onRowClick={(item) => selectCustomer(item.id as string)}
        isLoading={isLoading && customers.length === 0}
        emptyMessage="暂无客户数据"
        searchValue=""
        onSearchChange={() => {}}
      />
    </div>
  )
}

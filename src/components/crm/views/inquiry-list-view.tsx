'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Plus, Download, LayoutGrid, List } from 'lucide-react'
import { toast } from 'sonner'
import { useCRMStore } from '@/store/use-crm-store'
import { DataTable } from '@/components/crm/data-table'
import { StatusBadge } from '@/components/crm/status-badge'
import { INQUIRY_STATUS_LABELS, PRIORITY_LABELS } from '@/lib/types'
import { getCountryFlag } from '@/lib/utils'
import { exportToCSV } from '@/lib/export-csv'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { InquiryKanbanView } from './inquiry-kanban-view'

const INQUIRY_SOURCE_LABELS: Record<string, string> = {
  email: '邮件', website: '官网', whatsapp: 'WhatsApp', exhibition: '展会',
  b2b_alibaba: 'B2B平台', linkedin: 'LinkedIn', social_media: '社交媒体',
  manual: '手动录入', referral: '客户介绍',
}

export function InquiryListView() {
  const { searchQuery, filters, setFilters, openInquiryForm, selectInquiry } = useCRMStore()
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  const { data, isLoading } = useQuery({
    queryKey: ['inquiries', searchQuery, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.inquiryStatus) params.set('status', filters.inquiryStatus)
      if (filters.priority) params.set('priority', filters.priority)
      if (filters.source) params.set('source', filters.source)
      params.set('page', '1')
      params.set('pageSize', '50')
      return fetch(`/api/inquiries?${params}`).then((r) => r.json())
    },
  })

  const inquiries = data?.data || []

  const columns = [
    {
      key: 'inquiryNo',
      header: '询盘编号',
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="font-mono text-xs font-medium">{item.inquiryNo as string}</span>
      ),
    },
    {
      key: 'subject',
      header: '主题',
      render: (item: Record<string, unknown>) => (
        <div className="max-w-[200px]">
          <p className="font-medium text-sm truncate">{item.subject as string || '-'}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: '客户',
      render: (item: Record<string, unknown>) => {
        const customer = item.customer as Record<string, unknown> | null
        return (
          <div>
            <p className="text-sm">{customer?.companyName as string || '未关联'}</p>
            {customer?.country && <p className="text-xs text-muted-foreground">{getCountryFlag(customer.country as string)} {customer.country as string}</p>}
          </div>
        )
      },
    },
    {
      key: 'source',
      header: '来源',
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-muted-foreground">{INQUIRY_SOURCE_LABELS[item.source as string] || item.source}</span>
      ),
    },
    {
      key: 'status',
      header: '状态',
      render: (item: Record<string, unknown>) => (
        <StatusBadge status={item.status as string} type="inquiry" />
      ),
    },
    {
      key: 'priority',
      header: '优先级',
      render: (item: Record<string, unknown>) => (
        <StatusBadge status={item.priority as string} type="priority" />
      ),
    },
    {
      key: 'assignee',
      header: '负责人',
      render: (item: Record<string, unknown>) => {
        const assignee = item.assignee as Record<string, unknown> | null
        return <span className="text-sm">{assignee?.name as string || '-'}</span>
      },
    },
    {
      key: 'createdAt',
      header: '创建时间',
      sortable: true,
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(item.createdAt as string), 'yyyy-MM-dd', { locale: zhCN })}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Input placeholder="搜索询盘编号、主题..." className="h-9" value={searchQuery} onChange={(e) => useCRMStore.getState().setSearchQuery(e.target.value)} />
        </div>
        <Select value={filters.inquiryStatus || 'all'} onValueChange={(v) => setFilters({ inquiryStatus: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-24"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="new">新询盘</SelectItem>
            <SelectItem value="assigned">已分配</SelectItem>
            <SelectItem value="following">跟进中</SelectItem>
            <SelectItem value="quoted">已报价</SelectItem>
            <SelectItem value="won">已成交</SelectItem>
            <SelectItem value="lost">已流失</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.priority || 'all'} onValueChange={(v) => setFilters({ priority: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-24"><SelectValue placeholder="优先级" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="urgent">紧急</SelectItem>
            <SelectItem value="high">高</SelectItem>
            <SelectItem value="normal">普通</SelectItem>
            <SelectItem value="low">低</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.source || 'all'} onValueChange={(v) => setFilters({ source: v === 'all' ? undefined : v })}>
          <SelectTrigger className="h-9 w-28"><SelectValue placeholder="来源" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            <SelectItem value="email">邮件</SelectItem>
            <SelectItem value="website">官网</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="exhibition">展会</SelectItem>
            <SelectItem value="b2b_alibaba">B2B平台</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="social_media">社交媒体</SelectItem>
            <SelectItem value="manual">手动录入</SelectItem>
            <SelectItem value="referral">客户介绍</SelectItem>
          </SelectContent>
        </Select>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => { if (v) setViewMode(v as 'list' | 'kanban') }}>
          <ToggleGroupItem value="list" aria-label="列表视图">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="kanban" aria-label="看板视图">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
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
                  if (!inquiries.length) { toast.info('暂无数据可导出'); return }
                  const csvData = inquiries.map((item: Record<string, unknown>) => {
                    const customer = item.customer as Record<string, unknown> | null
                    const assignee = item.assignee as Record<string, unknown> | null
                    return {
                      inquiryNo: item.inquiryNo as string,
                      subject: item.subject as string,
                      customerName: customer?.companyName as string || '',
                      source: INQUIRY_SOURCE_LABELS[item.source as string] || (item.source as string),
                      status: INQUIRY_STATUS_LABELS[item.status as keyof typeof INQUIRY_STATUS_LABELS] || (item.status as string),
                      priority: PRIORITY_LABELS[item.priority as keyof typeof PRIORITY_LABELS] || (item.priority as string),
                      assigneeName: assignee?.name as string || '',
                      createdAt: item.createdAt ? format(new Date(item.createdAt as string), 'yyyy-MM-dd') : '',
                    }
                  })
                  exportToCSV(csvData, '询盘列表', [
                    { key: 'inquiryNo', label: '询盘编号' },
                    { key: 'subject', label: '主题' },
                    { key: 'customerName', label: '客户' },
                    { key: 'source', label: '来源' },
                    { key: 'status', label: '状态' },
                    { key: 'priority', label: '优先级' },
                    { key: 'assigneeName', label: '负责人' },
                    { key: 'createdAt', label: '创建时间' },
                  ])
                  toast.success(`导出成功，共 ${inquiries.length} 条数据`)
                }}
              >
                <Download className="h-4 w-4 mr-2 text-emerald-600" /> 导出CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => openInquiryForm()}>
            <Plus className="h-4 w-4 mr-1" /> 新建询盘
          </Button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <InquiryKanbanView />
      ) : (
        <DataTable
          columns={columns}
          data={inquiries}
          onRowClick={(item) => selectInquiry(item.id as string)}
          isLoading={isLoading && inquiries.length === 0}
          emptyMessage="暂无询盘数据"
          searchValue=""
          onSearchChange={() => {}}
        />
      )}
    </div>
  )
}

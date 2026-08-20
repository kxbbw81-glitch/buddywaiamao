'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Plus, Search, Package } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { DataTable } from '@/components/crm/data-table'
import { StatusBadge } from '@/components/crm/status-badge'
import { getCountryFlag } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface SampleForm {
  customerId: string
  inquiryId: string
  productName: string
  quantity: number
  status: string
  trackingNo: string
  shippingMethod: string
  notes: string
}

const DEFAULT_SAMPLE_FORM: SampleForm = {
  customerId: '',
  inquiryId: '',
  productName: '',
  quantity: 1,
  status: 'pending',
  trackingNo: '',
  shippingMethod: 'DHL',
  notes: '',
}

const SHIPPING_METHODS = ['DHL', 'FedEx', 'UPS', 'TNT', 'EMS', '顺丰', '海运']

export function SampleListView() {
  const { searchQuery, filters, setFilters, selectSample } = useCRMStore()
  const queryClient = useQueryClient()
  const [sampleFormOpen, setSampleFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState<SampleForm>({ ...DEFAULT_SAMPLE_FORM })
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['samples', searchQuery, filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.sampleStatus) params.set('status', filters.sampleStatus)
      params.set('page', '1')
      params.set('pageSize', '50')
      return fetch(`/api/samples?${params}`).then((r) => r.json())
    },
  })

  const samples = data?.data || []

  // Customer search for form dialog
  const { data: customersData } = useQuery({
    queryKey: ['customers-select-sample', customerSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      if (customerSearch) params.set('search', customerSearch)
      params.set('page', '1')
      params.set('pageSize', '20')
      return fetch(`/api/customers?${params}`).then((r) => r.json())
    },
    enabled: sampleFormOpen,
  })

  const customers = customersData?.data || []
  const selectedCustomer = customers.find((c: Record<string, unknown>) => c.id === form.customerId)

  const handleCreateSample = async () => {
    if (!form.productName) {
      toast.error('请填写样品名称')
      return
    }
    setFormLoading(true)
    try {
      const res = await fetch('/api/samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          customerId: form.customerId || undefined,
          inquiryId: form.inquiryId || undefined,
          quantity: Number(form.quantity),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('样品已创建')
        setSampleFormOpen(false)
        setForm({ ...DEFAULT_SAMPLE_FORM })
        queryClient.invalidateQueries({ queryKey: ['samples'] })
      } else {
        toast.error(data.error || '创建失败')
      }
    } catch {
      toast.error('创建失败')
    } finally {
      setFormLoading(false)
    }
  }

  const columns = [
    {
      key: 'productName',
      header: '样品名称',
      render: (item: Record<string, unknown>) => (
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-muted">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium">{item.productName as string}</span>
        </div>
      ),
    },
    {
      key: 'customer',
      header: '客户',
      render: (item: Record<string, unknown>) => {
        const c = item.customer as Record<string, unknown> | null
        if (!c) return <span className="text-sm text-muted-foreground">-</span>
        return (
          <span className="text-sm">
            {getCountryFlag(c.country as string)} {c.companyName as string}
          </span>
        )
      },
    },
    {
      key: 'quantity',
      header: '数量',
      render: (item: Record<string, unknown>) => (
        <span className="text-sm crm-number">{item.quantity as number}</span>
      ),
    },
    {
      key: 'status',
      header: '状态',
      render: (item: Record<string, unknown>) => (
        <StatusBadge status={item.status as string} type="sample" />
      ),
    },
    {
      key: 'trackingNo',
      header: '快递单号',
      render: (item: Record<string, unknown>) => (
        <span className="text-xs font-mono text-muted-foreground">{(item.trackingNo as string) || '-'}</span>
      ),
    },
    {
      key: 'sentAt',
      header: '寄出日期',
      render: (item: Record<string, unknown>) => (
        <span className="text-xs text-muted-foreground">
          {item.sentAt ? format(new Date(item.sentAt as string), 'yyyy-MM-dd', { locale: zhCN }) : '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: '创建时间',
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
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索样品名称、客户..."
            className="pl-8 h-9"
            value={searchQuery}
            onChange={(e) => useCRMStore.getState().setSearchQuery(e.target.value)}
          />
        </div>
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
            <SelectItem value="confirmed">已确认</SelectItem>
            <SelectItem value="rejected">已拒绝</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="ml-auto" onClick={() => { setForm({ ...DEFAULT_SAMPLE_FORM }); setSampleFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> 新建样品
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={samples}
        isLoading={isLoading && samples.length === 0}
        emptyMessage="暂无样品数据"
        searchValue=""
        onSearchChange={() => {}}
        onRowClick={(item) => selectSample(item.id as string)}
      />

      {/* 新建样品 Dialog */}
      <Dialog open={sampleFormOpen} onOpenChange={(v) => !v && setSampleFormOpen(false)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto crm-scrollbar">
          <DialogHeader>
            <DialogTitle>新建样品</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">客户（可选）</Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerOpen}
                    className="w-full justify-between h-9 text-sm"
                  >
                    {selectedCustomer
                      ? `${selectedCustomer.companyName as string}${selectedCustomer.country ? ` (${selectedCustomer.country as string})` : ''}`
                      : '搜索并选择客户...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="搜索公司名称..." value={customerSearch} onValueChange={setCustomerSearch} />
                    <CommandList className="max-h-64">
                      <CommandEmpty>未找到客户</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer: Record<string, unknown>) => (
                          <CommandItem
                            key={customer.id as string}
                            value={customer.companyName as string}
                            onSelect={() => {
                              setForm({ ...form, customerId: customer.id as string })
                              setCustomerOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                form.customerId === customer.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="text-sm">{customer.companyName as string}</span>
                            <span className="ml-1 text-xs text-muted-foreground">{customer.country as string}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">样品名称 *</Label>
              <Input
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                placeholder="输入样品名称..."
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">数量</Label>
                <Input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">快递方式</Label>
                <Select value={form.shippingMethod} onValueChange={(v) => setForm({ ...form, shippingMethod: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHIPPING_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">快递单号</Label>
              <Input
                value={form.trackingNo}
                onChange={(e) => setForm({ ...form, trackingNo: e.target.value })}
                placeholder="输入快递单号..."
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">备注</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="备注信息..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSampleFormOpen(false)}>取消</Button>
              <Button onClick={handleCreateSample} disabled={formLoading}>
                {formLoading ? '创建中...' : '创建样品'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

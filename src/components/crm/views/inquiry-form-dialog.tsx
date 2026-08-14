'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, Check, ChevronsUpDown } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { INQUIRY_SOURCE_LABELS } from '@/lib/types'
import type { Priority } from '@/lib/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const DEFAULT_FORM = {
  customerId: '',
  productId: '',
  subject: '',
  content: '',
  source: 'email',
  priority: 'normal' as Priority,
  language: 'en',
}

export function InquiryFormDialog() {
  const { inquiryFormOpen, closeInquiryForm, currentUser } = useCRMStore()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productOpen, setProductOpen] = useState(false)

  const { data: customersData } = useQuery({
    queryKey: ['customers-select', customerSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      if (customerSearch) params.set('search', customerSearch)
      params.set('page', '1')
      params.set('pageSize', '20')
      return fetch(`/api/customers?${params}`).then((r) => r.json())
    },
    enabled: inquiryFormOpen,
  })

  const { data: productsData } = useQuery({
    queryKey: ['products-select', productSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      if (productSearch) params.set('search', productSearch)
      params.set('page', '1')
      params.set('pageSize', '20')
      return fetch(`/api/products?${params}`).then((r) => r.json())
    },
    enabled: inquiryFormOpen,
  })

  const customers = customersData?.data || []
  const products = productsData?.data || []

  const selectedCustomer = customers.find((c: Record<string, unknown>) => c.id === form.customerId)
  const selectedProduct = products.find((p: Record<string, unknown>) => p.id === form.productId)

  useEffect(() => {
    if (!inquiryFormOpen) {
      setForm(DEFAULT_FORM)
    }
  }, [inquiryFormOpen])

  const handleSubmit = async () => {
    if (!form.subject.trim()) {
      toast.error('请输入询盘主题')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, assignedTo: currentUser?.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('询盘已创建')
        closeInquiryForm()
        queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      } else {
        toast.error(data.error || '创建失败')
      }
    } catch {
      toast.error('创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={inquiryFormOpen} onOpenChange={(v) => !v && closeInquiryForm()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新建询盘</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* 关联客户 */}
          <div className="space-y-1.5">
            <Label className="text-xs">关联客户</Label>
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

          {/* 来源 & 优先级 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">来源</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(INQUIRY_SOURCE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">优先级</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="normal">普通</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="urgent">紧急</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 主题 */}
          <div className="space-y-1.5">
            <Label className="text-xs">主题 *</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="询盘主题" />
          </div>

          {/* 内容 */}
          <div className="space-y-1.5">
            <Label className="text-xs">询盘内容</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="请输入询盘详细内容..."
              rows={4}
            />
          </div>

          {/* 关联产品 */}
          <div className="space-y-1.5">
            <Label className="text-xs">关联产品（可选）</Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className="w-full justify-between h-9 text-sm"
                >
                  {selectedProduct
                    ? `${selectedProduct.name as string} (${selectedProduct.productCode as string})`
                    : '搜索并选择产品...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索产品名称或编号..." value={productSearch} onValueChange={setProductSearch} />
                  <CommandList className="max-h-64">
                    <CommandEmpty>未找到产品</CommandEmpty>
                    <CommandGroup>
                      {products.map((p: Record<string, unknown>) => (
                        <CommandItem
                          key={p.id as string}
                          value={`${p.name as string} ${p.productCode as string}`}
                          onSelect={() => {
                            setForm((prev) => ({ ...prev, productId: p.id as string }))
                            setProductOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              form.productId === p.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span className="text-sm">{p.name as string}</span>
                          <span className="ml-1 text-xs text-muted-foreground">{p.productCode as string}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeInquiryForm}>取消</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? '提交中...' : '创建'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

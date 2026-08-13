'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { formatCurrency } from '@/lib/utils'
import type { TradeTerm } from '@/lib/types'
import { cn } from '@/lib/utils'
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

interface ItemRow {
  productName: string
  productSpec: string
  quantity: number
  unit: string
  unitPrice: number
  cost: number
}

const DEFAULT_FORM = {
  customerId: '',
  tradeTerm: 'FOB' as TradeTerm,
  currency: 'USD',
  exchangeRate: 7.24,
  validUntil: '',
  notes: '',
}

const DEFAULT_ITEM: ItemRow = { productName: '', productSpec: '', quantity: 1, unit: 'PCS', unitPrice: 0, cost: 0 }

export function QuotationFormDialog() {
  const { quotationFormOpen, closeQuotationForm, currentUser, selectedCustomerId } = useCRMStore()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [items, setItems] = useState<ItemRow[]>([{ ...DEFAULT_ITEM }])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)

  const { data: customersData } = useQuery({
    queryKey: ['customers-select-q', customerSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      if (customerSearch) params.set('search', customerSearch)
      params.set('page', '1')
      params.set('pageSize', '20')
      return fetch(`/api/customers?${params}`).then((r) => r.json())
    },
    enabled: quotationFormOpen,
  })

  const customers = customersData?.data || []
  const selectedCustomer = customers.find((c: Record<string, unknown>) => c.id === form.customerId)

  useEffect(() => {
    if (!quotationFormOpen) {
      setForm(DEFAULT_FORM)
      setItems([{ ...DEFAULT_ITEM }])
      return
    }
    if (selectedCustomerId) {
      setForm((f) => ({ ...f, customerId: selectedCustomerId }))
    }
  }, [quotationFormOpen, selectedCustomerId])

  const addItem = () => {
    setItems([...items, { ...DEFAULT_ITEM }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ItemRow, value: string | number) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const totalCost = items.reduce((sum, item) => sum + item.quantity * item.cost, 0)
  const profitRate = totalCost > 0 ? ((totalAmount - totalCost) / totalCost) * 100 : 0

  const handleSubmit = async () => {
    if (!form.customerId) {
      toast.error('请选择客户')
      return
    }
    if (items.some((i) => !i.productName)) {
      toast.error('请填写所有产品名称')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items, createdById: currentUser?.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('报价已创建')
        closeQuotationForm()
        queryClient.invalidateQueries({ queryKey: ['quotations'] })
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
    <Dialog open={quotationFormOpen} onOpenChange={(v) => !v && closeQuotationForm()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto crm-scrollbar">
        <DialogHeader>
          <DialogTitle>新建报价</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">客户 *</Label>
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">贸易条款</Label>
              <Select value={form.tradeTerm} onValueChange={(v) => setForm({ ...form, tradeTerm: v as TradeTerm })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FOB">FOB</SelectItem>
                  <SelectItem value="CIF">CIF</SelectItem>
                  <SelectItem value="EXW">EXW</SelectItem>
                  <SelectItem value="DDP">DDP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">货币</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">汇率</Label>
              <Input type="number" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: parseFloat(e.target.value) || 1 })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">有效期</Label>
              <Input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="h-9" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">报价项目</Label>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />添加项目</Button>
            </div>

            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3">
                  <div className="col-span-3 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">产品名称</Label>
                    <Input value={item.productName} onChange={(e) => updateItem(i, 'productName', e.target.value)} placeholder="产品名" className="h-8 text-xs" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">规格</Label>
                    <Input value={item.productSpec} onChange={(e) => updateItem(i, 'productSpec', e.target.value)} placeholder="规格" className="h-8 text-xs" />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">数量</Label>
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} className="h-8 text-xs" />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">单价</Label>
                    <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">成本</Label>
                    <Input type="number" value={item.cost} onChange={(e) => updateItem(i, 'cost', parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                  </div>
                  <div className="col-span-3 text-right">
                    <p className="text-xs text-muted-foreground">小计</p>
                    <p className="text-xs font-medium crm-number">{formatCurrency(item.quantity * item.unitPrice)}</p>
                  </div>
                  <div className="col-span-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(i)} disabled={items.length <= 1}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex gap-6 text-sm">
                <span>总金额: <strong>{formatCurrency(totalAmount)}</strong></span>
                <span>总成本: <strong className="text-muted-foreground">{formatCurrency(totalCost)}</strong></span>
              </div>
              <span className={`text-sm font-bold ${profitRate >= 20 ? 'text-emerald-600' : profitRate >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                利润率: {profitRate.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">备注</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="备注..." rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeQuotationForm}>取消</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? '提交中...' : '创建报价'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
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

interface OrderForm {
  customerId: string
  quotationId: string
  totalAmount: number
  paymentTerm: string
  deliveryDate: string
  piNo: string
  notes: string
}

const DEFAULT_FORM: OrderForm = {
  customerId: '',
  quotationId: '',
  totalAmount: 0,
  paymentTerm: '30% deposit, 70% before shipment',
  deliveryDate: '',
  piNo: '',
  notes: '',
}

const PAYMENT_TERMS = [
  { value: '100% advance', label: '100% 预付' },
  { value: '30% deposit, 70% before shipment', label: '30% 定金, 70% 发货前' },
  { value: '30% deposit, 70% against B/L', label: '30% 定金, 70% 见提单' },
  { value: '50% deposit, 50% before shipment', label: '50% 定金, 50% 发货前' },
  { value: 'L/C at sight', label: '即期信用证' },
  { value: 'D/P 30 days', label: 'D/P 30天' },
]

export function OrderFormDialog() {
  const { orderFormOpen, closeOrderForm, currentUser, selectedCustomerId } = useCRMStore()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<OrderForm>({ ...DEFAULT_FORM })
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [quotationSearch, setQuotationSearch] = useState('')
  const [quotationOpen, setQuotationOpen] = useState(false)

  // Customer search
  const { data: customersData } = useQuery({
    queryKey: ['customers-select-order', customerSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      if (customerSearch) params.set('search', customerSearch)
      params.set('page', '1')
      params.set('pageSize', '20')
      return fetch(`/api/customers?${params}`).then((r) => r.json())
    },
    enabled: orderFormOpen,
  })

  // Quotation search (filtered by selected customer if available)
  const { data: quotationsData } = useQuery({
    queryKey: ['quotations-select-order', quotationSearch, form.customerId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (quotationSearch) params.set('search', quotationSearch)
      if (form.customerId) params.set('customerId', form.customerId)
      params.set('page', '1')
      params.set('pageSize', '20')
      return fetch(`/api/quotations?${params}`).then((r) => r.json())
    },
    enabled: orderFormOpen,
  })

  const customers = customersData?.data || []
  const quotations = quotationsData?.data || []
  const selectedCustomer = customers.find((c: Record<string, unknown>) => c.id === form.customerId)
  const selectedQuotation = quotations.find((q: Record<string, unknown>) => q.id === form.quotationId)

  // Auto-fill from quotation
  useEffect(() => {
    if (selectedQuotation) {
      setForm((f) => ({
        ...f,
        quotationId: selectedQuotation.id as string,
        totalAmount: selectedQuotation.totalAmount as number,
        customerId: selectedQuotation.customerId as string || f.customerId,
      }))
    }
  }, [selectedQuotation])

  useEffect(() => {
    if (!orderFormOpen) {
      setForm({ ...DEFAULT_FORM })
      return
    }
    if (selectedCustomerId) {
      setForm((f) => ({ ...f, customerId: selectedCustomerId }))
    }
  }, [orderFormOpen, selectedCustomerId])

  const handleSubmit = async () => {
    if (!form.customerId) {
      toast.error('请选择客户')
      return
    }
    if (form.totalAmount <= 0) {
      toast.error('请输入有效金额')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          quotationId: form.quotationId || undefined,
          totalAmount: form.totalAmount,
          currency: 'USD',
          paymentTerm: form.paymentTerm,
          deliveryDate: form.deliveryDate || undefined,
          piNo: form.piNo || undefined,
          notes: form.notes || undefined,
          createdById: currentUser?.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('订单已创建')
        closeOrderForm()
        queryClient.invalidateQueries({ queryKey: ['orders'] })
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
    <Dialog open={orderFormOpen} onOpenChange={(v) => !v && closeOrderForm()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto crm-scrollbar">
        <DialogHeader>
          <DialogTitle>新建订单</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Customer Select */}
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

          {/* Quotation Select (optional) */}
          <div className="space-y-1.5">
            <Label className="text-xs">关联报价（可选，自动填充金额）</Label>
            <Popover open={quotationOpen} onOpenChange={setQuotationOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={quotationOpen}
                  className="w-full justify-between h-9 text-sm"
                >
                  {selectedQuotation
                    ? `${selectedQuotation.quoteNo as string} - ${selectedQuotation.totalAmount ? `$${(selectedQuotation.totalAmount as number).toLocaleString()}` : ''}`
                    : '搜索并选择报价...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索报价号..." value={quotationSearch} onValueChange={setQuotationSearch} />
                  <CommandList className="max-h-64">
                    <CommandEmpty>未找到报价</CommandEmpty>
                    <CommandGroup>
                      {quotations.map((quotation: Record<string, unknown>) => (
                        <CommandItem
                          key={quotation.id as string}
                          value={quotation.quoteNo as string}
                          onSelect={() => {
                            setForm({
                              ...form,
                              quotationId: quotation.id as string,
                              totalAmount: quotation.totalAmount as number,
                              customerId: quotation.customerId as string || form.customerId,
                            })
                            setQuotationOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              form.quotationId === quotation.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-mono">{quotation.quoteNo as string}</span>
                            <span className="text-xs text-muted-foreground">
                              ${(quotation.totalAmount as number).toLocaleString()} · {quotation.tradeTerm as string}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">订单金额 (USD) *</Label>
              <Input
                type="number"
                value={form.totalAmount || ''}
                onChange={(e) => setForm({ ...form, totalAmount: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="h-9 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">PI号</Label>
              <Input
                value={form.piNo}
                onChange={(e) => setForm({ ...form, piNo: e.target.value })}
                placeholder="自动生成"
                className="h-9 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">付款条款</Label>
              <Select value={form.paymentTerm} onValueChange={(v) => setForm({ ...form, paymentTerm: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">交货日期</Label>
              <Input
                type="date"
                value={form.deliveryDate}
                onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">备注</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="订单备注..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeOrderForm}>取消</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? '提交中...' : '创建订单'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

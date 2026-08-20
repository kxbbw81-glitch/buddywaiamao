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

interface PaymentForm {
  orderId: string
  amount: number
  currency: string
  paymentMethod: string
  paymentDate: string
  dueDate: string
  status: string
  notes: string
}

const DEFAULT_FORM: PaymentForm = {
  orderId: '',
  amount: 0,
  currency: 'USD',
  paymentMethod: 'T/T',
  paymentDate: '',
  dueDate: '',
  status: 'pending',
  notes: '',
}

const CURRENCIES = [
  { value: 'USD', label: 'USD - 美元' },
  { value: 'EUR', label: 'EUR - 欧元' },
  { value: 'GBP', label: 'GBP - 英镑' },
  { value: 'CNY', label: 'CNY - 人民币' },
]

const PAYMENT_METHODS = [
  { value: 'T/T', label: 'T/T 电汇' },
  { value: 'L/C', label: 'L/C 信用证' },
  { value: 'PayPal', label: 'PayPal' },
  { value: 'Western Union', label: 'Western Union' },
  { value: '其他', label: '其他' },
]

const PAYMENT_STATUSES = [
  { value: 'pending', label: '待付款' },
  { value: 'partial', label: '部分付款' },
  { value: 'completed', label: '已付款' },
]

export function PaymentFormDialog() {
  const { paymentFormOpen, closePaymentForm } = useCRMStore()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<PaymentForm>({ ...DEFAULT_FORM })
  const [orderSearch, setOrderSearch] = useState('')
  const [orderOpen, setOrderOpen] = useState(false)

  // Order search
  const { data: ordersData } = useQuery({
    queryKey: ['orders-select-payment', orderSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      if (orderSearch) params.set('search', orderSearch)
      params.set('page', '1')
      params.set('pageSize', '20')
      return fetch(`/api/orders?${params}`).then((r) => r.json())
    },
    enabled: paymentFormOpen,
  })

  const orders = ordersData?.data || []
  const selectedOrder = orders.find((o: Record<string, unknown>) => o.id === form.orderId)

  useEffect(() => {
    if (!paymentFormOpen) {
      setForm({ ...DEFAULT_FORM })
      setOrderSearch('')
    }
  }, [paymentFormOpen])

  const handleSubmit = async () => {
    if (!form.orderId) {
      toast.error('请选择关联订单')
      return
    }
    if (form.amount <= 0) {
      toast.error('请输入有效金额')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: form.orderId,
          amount: form.amount,
          currency: form.currency,
          paymentMethod: form.paymentMethod,
          paymentDate: form.paymentDate || undefined,
          dueDate: form.dueDate || undefined,
          status: form.status,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('收款记录已创建')
        closePaymentForm()
        queryClient.invalidateQueries({ queryKey: ['payments'] })
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
    <Dialog open={paymentFormOpen} onOpenChange={(v) => !v && closePaymentForm()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto crm-scrollbar">
        <DialogHeader>
          <DialogTitle>新建收款</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Order Select */}
          <div className="space-y-1.5">
            <Label className="text-xs">关联订单 *</Label>
            <Popover open={orderOpen} onOpenChange={setOrderOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={orderOpen}
                  className="w-full justify-between h-9 text-sm"
                >
                  {selectedOrder
                    ? (() => {
                        const customer = selectedOrder.customer as Record<string, unknown> | null
                        return `${selectedOrder.orderNo as string} - ${customer?.companyName as string || ''}`
                      })()
                    : '搜索并选择订单...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索订单号..." value={orderSearch} onValueChange={setOrderSearch} />
                  <CommandList className="max-h-64">
                    <CommandEmpty>未找到订单</CommandEmpty>
                    <CommandGroup>
                      {orders.map((order: Record<string, unknown>) => {
                        const customer = order.customer as Record<string, unknown> | null
                        return (
                          <CommandItem
                            key={order.id as string}
                            value={order.orderNo as string}
                            onSelect={() => {
                              setForm({ ...form, orderId: order.id as string })
                              setOrderOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                form.orderId === order.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-mono">{order.orderNo as string}</span>
                              <span className="text-xs text-muted-foreground">
                                {customer?.companyName as string || ''} · ${Number(order.totalAmount).toLocaleString()}
                              </span>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">金额 *</Label>
              <Input
                type="number"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="h-9 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">币种</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">付款方式</Label>
            <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">付款日期</Label>
              <Input
                type="date"
                value={form.paymentDate}
                onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">到期日期</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">状态</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">备注</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="收款备注..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closePaymentForm}>取消</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? '创建中...' : '创建收款'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

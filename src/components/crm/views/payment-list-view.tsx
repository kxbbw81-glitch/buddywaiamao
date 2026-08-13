'use client'

import { useState } from 'react'
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, differenceInDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { StatusBadge } from '@/components/crm/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, CheckCircle2, Clock, AlertTriangle, Plus, ChevronDown, ChevronUp, Check, ChevronsUpDown, Download } from 'lucide-react'
import { PAYMENT_STATUS_LABELS } from '@/lib/types'
import { exportToCSV } from '@/lib/export-csv'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const PAYMENT_METHODS = ['T/T', 'L/C', 'D/P', 'Western Union', 'PayPal']

interface PaymentForm {
  orderId: string
  amount: number
  paymentMethod: string
  dueDate: string
  status: string
}

const DEFAULT_PAYMENT_FORM: PaymentForm = {
  orderId: '',
  amount: 0,
  paymentMethod: 'T/T',
  dueDate: '',
  status: 'pending',
}

export function PaymentListView() {
  const { filters, setFilters } = useCRMStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['payments', filters],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.paymentStatus) params.set('status', filters.paymentStatus)
      params.set('page', '1')
      params.set('pageSize', '50')
      return fetch(`/api/payments?${params}`).then((r) => r.json())
    },
  })

  const payments = data?.data || []

  const summary = useMemo(() => {
    const total = payments.reduce((s, p) => s + (p.amount as number || 0), 0)
    const paid = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + (p.amount as number || 0), 0)
    const pending = payments.filter((p) => p.status === 'pending' || p.status === 'partial').reduce((s, p) => s + (p.amount as number || 0), 0)
    const overdue = payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + (p.amount as number || 0), 0)
    const overdueCount = payments.filter((p) => p.status === 'overdue').length
    return { total, paid, pending, overdue, overdueCount }
  }, [payments])

  // Create payment dialog state
  const [paymentFormOpen, setPaymentFormOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState<PaymentForm>({ ...DEFAULT_PAYMENT_FORM })
  const [orderSearch, setOrderSearch] = useState('')
  const [orderOpen, setOrderOpen] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Order search for form dialog
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

  const handleCreatePayment = async () => {
    if (!form.orderId) {
      toast.error('请选择关联订单')
      return
    }
    if (form.amount <= 0) {
      toast.error('请输入有效金额')
      return
    }
    setFormLoading(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          dueDate: form.dueDate || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('付款记录已创建')
        setPaymentFormOpen(false)
        setForm({ ...DEFAULT_PAYMENT_FORM })
        queryClient.invalidateQueries({ queryKey: ['payments'] })
      } else {
        toast.error(data.error || '创建失败')
      }
    } catch {
      toast.error('创建失败')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-muted text-muted-foreground">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">总金额</p>
              <p className="text-sm font-bold crm-number">{formatCurrency(summary.total)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">已付款</p>
              <p className="text-sm font-bold crm-number text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.paid)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">待付款</p>
              <p className="text-sm font-bold crm-number text-amber-600 dark:text-amber-400">{formatCurrency(summary.pending)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="p-3">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">逾期</p>
              <p className="text-sm font-bold crm-number text-rose-600 dark:text-rose-400">{formatCurrency(summary.overdue)}</p>
              {summary.overdueCount > 0 && <p className="text-[10px] text-rose-500">{summary.overdueCount} 笔</p>}
            </div>
          </CardContent>
        </Card>
      </div>

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
                  if (!payments.length) { toast.info('暂无数据可导出'); return }
                  const csvData = payments.map((item: Record<string, unknown>) => {
                    const orderData = item.order as Record<string, unknown> | null
                    const customer = orderData?.customer as Record<string, unknown> | null
                    return {
                      paymentNo: item.id ? `PAY-${String(item.id).slice(-4)}` : '',
                      orderNo: orderData?.orderNo as string || '',
                      customerName: customer?.companyName as string || '',
                      amount: item.amount as number,
                      paymentMethod: item.paymentMethod as string || '',
                      status: PAYMENT_STATUS_LABELS[item.status as keyof typeof PAYMENT_STATUS_LABELS] || (item.status as string),
                      dueDate: item.dueDate ? format(new Date(item.dueDate as string), 'yyyy-MM-dd') : '',
                    }
                  })
                  exportToCSV(csvData, '付款列表', [
                    { key: 'paymentNo', label: '付款编号' },
                    { key: 'orderNo', label: '订单' },
                    { key: 'customerName', label: '客户' },
                    { key: 'amount', label: '金额' },
                    { key: 'paymentMethod', label: '付款方式' },
                    { key: 'status', label: '状态' },
                    { key: 'dueDate', label: '到期日' },
                  ])
                  toast.success(`导出成功，共 ${payments.length} 条数据`)
                }}
              >
                <Download className="h-4 w-4 mr-2 text-emerald-600" /> 导出CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => { setForm({ ...DEFAULT_PAYMENT_FORM }); setPaymentFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> 新建付款
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30">
              <th className="text-xs font-medium text-muted-foreground text-left px-3 py-2.5">订单号</th>
              <th className="text-xs font-medium text-muted-foreground text-left px-3 py-2.5">客户</th>
              <th className="text-xs font-medium text-muted-foreground text-left px-3 py-2.5">金额</th>
              <th className="text-xs font-medium text-muted-foreground text-left px-3 py-2.5">付款方式</th>
              <th className="text-xs font-medium text-muted-foreground text-left px-3 py-2.5">到期日</th>
              <th className="text-xs font-medium text-muted-foreground text-left px-3 py-2.5">付款日</th>
              <th className="text-xs font-medium text-muted-foreground text-left px-3 py-2.5">状态</th>
              <th className="text-xs font-medium text-muted-foreground text-left px-3 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t animate-pulse">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-3 py-2.5"><div className="h-4 bg-muted rounded w-20" /></td>
                  ))}
                </tr>
              ))
            ) : payments.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-16 text-muted-foreground">暂无付款数据</td></tr>
            ) : (
              payments.map((item, i) => {
                const isOverdue = item.status === 'overdue'
                const isExpanded = expandedRow === (item.id as string)
                const orderData = item.order as Record<string, unknown> | null
                return (
                  <>
                    <tr
                      key={(item.id as string) || i}
                      className={cn(
                        'border-t crm-table-row transition-colors cursor-pointer',
                        i % 2 === 1 && 'crm-table-row-odd',
                        isOverdue && 'border-l-[3px] border-l-rose-500 bg-red-50/50 dark:bg-red-950/20',
                      )}
                      onClick={() => setExpandedRow(isExpanded ? null : (item.id as string))}
                    >
                      <td className="px-3 py-2.5">
                        <div className="truncate-cell">
                          <span className="font-mono text-xs">{orderData?.orderNo as string || '-'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="truncate-cell">
                          <span className="text-sm">{orderData?.customer ? (orderData.customer as Record<string, unknown>).companyName as string : '-'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="truncate-cell">
                          <span className="text-sm font-medium crm-number">{formatCurrency(item.amount as number)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="truncate-cell">
                          <span className="text-xs">{item.paymentMethod as string || '-'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="truncate-cell">
                          {(() => {
                            const dueDate = item.dueDate as string | null
                            if (!dueDate) return <span className="text-xs text-muted-foreground">-</span>
                            const daysOverdue = differenceInDays(new Date(), new Date(dueDate))
                            return (
                              <div className="flex flex-col">
                                <span className={cn('text-xs', isOverdue ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-muted-foreground')}>
                                  {format(new Date(dueDate), 'yyyy-MM-dd', { locale: zhCN })}
                                </span>
                                {isOverdue && daysOverdue > 0 && (
                                  <span className="text-[10px] text-rose-500">逾期 {daysOverdue} 天</span>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="truncate-cell">
                          <span className="text-xs text-muted-foreground">{item.paymentDate ? format(new Date(item.paymentDate as string), 'yyyy-MM-dd', { locale: zhCN }) : '-'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={item.status as string} type="payment" />
                      </td>
                      <td className="px-3 py-2.5">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </td>
                    </tr>
                    {/* Expanded Details */}
                    {isExpanded && (
                      <tr key={`${item.id}-detail`} className="border-t bg-muted/20">
                        <td colSpan={8} className="px-3 py-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                              <span className="text-muted-foreground">PI号：</span>
                              <span className="font-mono">{orderData?.piNo as string || '-'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">币种：</span>
                              <span>{item.currency as string || 'USD'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">创建时间：</span>
                              <span>{format(new Date(item.createdAt as string), 'yyyy-MM-dd', { locale: zhCN })}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">备注：</span>
                              <span className="truncate max-w-[150px]">{(item.notes as string) || '-'}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 新建付款 Dialog */}
      <Dialog open={paymentFormOpen} onOpenChange={(v) => !v && setPaymentFormOpen(false)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto crm-scrollbar">
          <DialogHeader>
            <DialogTitle>新建付款记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
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
                      ? `${selectedOrder.orderNo as string} - ${(selectedOrder.customer as Record<string, unknown>)?.companyName as string || ''}`
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
                                  {customer?.companyName as string || ''} · {formatCurrency(order.totalAmount as number)}
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
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">付款方式</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">到期日</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">状态</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">待付款</SelectItem>
                    <SelectItem value="partial">部分付款</SelectItem>
                    <SelectItem value="completed">已付清</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPaymentFormOpen(false)}>取消</Button>
              <Button onClick={handleCreatePayment} disabled={formLoading}>
                {formLoading ? '创建中...' : '创建付款记录'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

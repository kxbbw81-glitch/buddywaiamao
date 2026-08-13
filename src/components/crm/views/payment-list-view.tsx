'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, differenceInDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { StatusBadge } from '@/components/crm/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { DollarSign, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

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

  const payments = data || []

  const summary = useMemo(() => {
    const total = payments.reduce((s, p) => s + (p.amount as number || 0), 0)
    const paid = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + (p.amount as number || 0), 0)
    const pending = payments.filter((p) => p.status === 'pending' || p.status === 'partial').reduce((s, p) => s + (p.amount as number || 0), 0)
    const overdue = payments.filter((p) => p.status === 'overdue').reduce((s, p) => s + (p.amount as number || 0), 0)
    const overdueCount = payments.filter((p) => p.status === 'overdue').length
    return { total, paid, pending, overdue, overdueCount }
  }, [payments])

  const columns = [
    { key: 'orderNo', header: '订单号', render: (item: Record<string, unknown>) => <span className="font-mono text-xs">{item.orderNo as string}</span> },
    { key: 'customerName', header: '客户', render: (item: Record<string, unknown>) => <span className="text-sm">{item.customerName as string || '-'}</span> },
    { key: 'amount', header: '金额', sortable: true, render: (item: Record<string, unknown>) => <span className="text-sm font-medium crm-number">{formatCurrency(item.amount as number)}</span> },
    { key: 'paymentMethod', header: '付款方式', render: (item: Record<string, unknown>) => <span className="text-xs">{item.paymentMethod as string || '-'}</span> },
    {
      key: 'dueDate',
      header: '到期日',
      render: (item: Record<string, unknown>) => {
        const isOverdue = item.status === 'overdue'
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
      },
    },
    { key: 'paymentDate', header: '付款日', render: (item: Record<string, unknown>) => <span className="text-xs text-muted-foreground">{item.paymentDate ? format(new Date(item.paymentDate as string), 'yyyy-MM-dd', { locale: zhCN }) : '-'}</span> },
    { key: 'status', header: '状态', render: (item: Record<string, unknown>) => <StatusBadge status={item.status as string} type="payment" /> },
  ]

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
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30">
              {columns.map((col) => (
                <th key={col.key} className="text-xs font-medium text-muted-foreground text-left px-3 py-2.5">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2.5"><div className="h-4 bg-muted rounded w-20" /></td>
                  ))}
                </tr>
              ))
            ) : payments.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-16 text-muted-foreground">暂无付款数据</td></tr>
            ) : (
              payments.map((item, i) => {
                const isOverdue = item.status === 'overdue'
                return (
                  <tr
                    key={(item.id as string) || i}
                    className={cn(
                      'border-t crm-table-row transition-colors',
                      i % 2 === 1 && 'crm-table-row-odd',
                      isOverdue && 'border-l-[3px] border-l-rose-500 bg-red-50/50 dark:bg-red-950/20',
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-3 py-2.5"><div className="truncate-cell">{col.render(item)}</div></td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

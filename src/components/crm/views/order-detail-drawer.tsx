'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { StatusBadge } from '@/components/crm/status-badge'
import { DetailSkeleton } from '@/components/crm/loading-skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)
}

const ORDER_STEPS = ['pending', 'confirmed', 'in_production', 'ready', 'shipped', 'completed']
const ORDER_STEP_LABELS: Record<string, string> = { pending: '待确认', confirmed: '已确认', in_production: '生产中', ready: '待发货', shipped: '已发货', completed: '已完成' }

export function OrderDetailDrawer() {
  const { selectedOrderId, selectOrder } = useCRMStore()
  

  

  const { data, isLoading } = useQuery({
    queryKey: ['order', selectedOrderId],
    queryFn: () => fetch(`/api/orders/${selectedOrderId}`).then((r) => r.json()),
    enabled: !!selectedOrderId,
  })

  const order = data?.data

  const handleStatusUpdate = async (status: string) => {
    if (!order) return
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) toast.success('状态已更新')
    } catch { toast.error('操作失败') }
  }

  const currentStepIndex = ORDER_STEPS.indexOf(order?.status || 'pending')
  const progressPct = order?.status === 'cancelled' ? 0 : Math.round((currentStepIndex / (ORDER_STEPS.length - 1)) * 100)

  return (
    <Sheet open={!!selectedOrderId} onOpenChange={(v) => !v && selectOrder(null)}>
      <SheetContent className="w-full sm:max-w-xl p-0">
        {isLoading || !order ? (
          <DetailSkeleton />
        ) : (
          <>
            <SheetHeader className="p-6 pb-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-base font-mono">{order.orderNo}</SheetTitle>
                    {order.piNo && <p className="text-xs text-muted-foreground font-mono mt-0.5">PI: {order.piNo}</p>}
                  </div>
                  <StatusBadge status={order.status} type="order" />
                </div>
                {order.customer && (
                  <p className="text-sm text-muted-foreground">{order.customer.companyName} · {order.customer.country}</p>
                )}
              </div>
            </SheetHeader>

            <Separator />

            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] crm-scrollbar">
              {/* Progress */}
              {order.status !== 'cancelled' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>订单进度</span>
                    <span>{ORDER_STEP_LABELS[order.status] || order.status}</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    {ORDER_STEPS.filter(s => s !== 'cancelled').map((step) => (
                      <span key={step} className={ORDER_STEPS.indexOf(step) <= currentStepIndex ? 'text-emerald-600 font-medium' : ''}>
                        {ORDER_STEP_LABELS[step]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3"><p className="text-xs text-muted-foreground">订单金额</p><p className="text-lg font-bold crm-number">{formatCurrency(order.totalAmount)}</p></Card>
                <Card className="p-3"><p className="text-xs text-muted-foreground">已收款</p><p className="text-lg font-bold crm-number text-emerald-600">{formatCurrency(order.paidAmount)}</p></Card>
              </div>

              <Card className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">付款条款</span><span>{order.paymentTerm || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">交货日期</span>
                  <span>{order.deliveryDate ? format(new Date(order.deliveryDate), 'yyyy-MM-dd', { locale: zhCN }) : '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">创建时间</span>
                  <span>{format(new Date(order.createdAt), 'yyyy-MM-dd', { locale: zhCN })}</span>
                </div>
              </Card>

              {/* Payments */}
              {order.payments && order.payments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">收款记录</h4>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">金额</TableHead>
                          <TableHead className="text-xs">方式</TableHead>
                          <TableHead className="text-xs">到期日</TableHead>
                          <TableHead className="text-xs">付款日</TableHead>
                          <TableHead className="text-xs">状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.payments.map((p: Record<string, unknown>) => (
                          <TableRow key={p.id as string}>
                            <TableCell className="text-xs crm-number">{formatCurrency(p.amount as number)}</TableCell>
                            <TableCell className="text-xs">{p.paymentMethod as string || '-'}</TableCell>
                            <TableCell className="text-xs">{p.dueDate ? format(new Date(p.dueDate as string), 'MM-dd', { locale: zhCN }) : '-'}</TableCell>
                            <TableCell className="text-xs">{p.paymentDate ? format(new Date(p.paymentDate as string), 'MM-dd', { locale: zhCN }) : '-'}</TableCell>
                            <TableCell><StatusBadge status={p.status as string} type="payment" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {order.status === 'pending' && <Button size="sm" onClick={() => handleStatusUpdate('confirmed')}>确认订单</Button>}
                {order.status === 'confirmed' && <Button size="sm" onClick={() => handleStatusUpdate('in_production')}>开始生产</Button>}
                {order.status === 'in_production' && <Button size="sm" onClick={() => handleStatusUpdate('ready')}>生产完成</Button>}
                {order.status === 'ready' && <Button size="sm" onClick={() => handleStatusUpdate('shipped')}>确认发货</Button>}
                {order.status === 'shipped' && <Button size="sm" onClick={() => handleStatusUpdate('completed')}>确认收货</Button>}
                {order.status !== 'cancelled' && order.status !== 'completed' && (
                  <Button size="sm" variant="destructive" onClick={() => handleStatusUpdate('cancelled')}>取消订单</Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

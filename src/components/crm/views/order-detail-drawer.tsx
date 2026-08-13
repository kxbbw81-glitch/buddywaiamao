'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, addDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { StatusBadge } from '@/components/crm/status-badge'
import { DetailSkeleton } from '@/components/crm/loading-skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { formatCurrency, cn } from '@/lib/utils'
import { Check, Circle, Clock, Save, Truck, Package, Factory, ClipboardCheck, ArrowRight } from 'lucide-react'

const ORDER_STEPS = ['pending', 'confirmed', 'in_production', 'ready', 'shipped', 'completed']
const ORDER_STEP_LABELS: Record<string, string> = {
  pending: '待确认', confirmed: '已确认', in_production: '生产中',
  ready: '待发货', shipped: '已发货', completed: '已完成',
}
const ORDER_STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  confirmed: ClipboardCheck,
  in_production: Factory,
  ready: Package,
  shipped: Truck,
  completed: Check,
}
const ORDER_STEP_DAYS: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  in_production: 7,
  ready: 14,
  shipped: 21,
  completed: 30,
}

const SHIPPING_METHODS = [
  { value: 'FOB', label: 'FOB (离岸价)' },
  { value: 'CIF', label: 'CIF (到岸价)' },
  { value: 'EXW', label: 'EXW (出厂价)' },
  { value: 'DDP', label: 'DDP (完税后交货)' },
  { value: 'DAP', label: 'DAP (目的地交货)' },
]

export function OrderDetailDrawer() {
  const { selectedOrderId, selectOrder } = useCRMStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['order', selectedOrderId],
    queryFn: () => fetch(`/api/orders/${selectedOrderId}`).then((r) => r.json()),
    enabled: !!selectedOrderId,
  })

  const order = data?.data

  const [activeTab, setActiveTab] = useState('info')
  const [editingTrackingNo, setEditingTrackingNo] = useState(false)
  const [trackingNoInput, setTrackingNoInput] = useState('')
  const [notesInput, setNotesInput] = useState('')
  const [internalNotesInput, setInternalNotesInput] = useState('')
  const [shippingMethod, setShippingMethod] = useState('')
  const [savingField, setSavingField] = useState<string | null>(null)

  useEffect(() => {
    if (order) {
      setTrackingNoInput(order.trackingNo || '')
      setNotesInput(order.notes || '')
      setInternalNotesInput('')
      setShippingMethod(order.shippingMethod || 'FOB')
      setActiveTab('info')
    }
  }, [order])

  const handleSaveField = async (field: string, value: string) => {
    if (!order) return
    setSavingField(field)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      })
      if (res.ok) {
        toast.success('保存成功')
        queryClient.invalidateQueries({ queryKey: ['order', order.id] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      } else {
        toast.error('保存失败')
      }
    } catch {
      toast.error('保存失败')
    } finally {
      setSavingField(null)
      if (field === 'trackingNo') setEditingTrackingNo(false)
    }
  }

  const handleStatusUpdate = async (status: string) => {
    if (!order) return
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const label = ORDER_STEP_LABELS[status] || status
        toast.success(`订单状态已更新为「${label}」`)
        queryClient.invalidateQueries({ queryKey: ['order', order.id] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const currentStepIndex = ORDER_STEPS.indexOf(order?.status || 'pending')
  const createdDate = order?.createdAt ? new Date(order.createdAt) : new Date()

  const getStepDate = (step: string) => {
    const days = ORDER_STEP_DAYS[step] || 0
    return addDays(createdDate, days)
  }

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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
              <TabsList className="w-full h-9 bg-muted/50 p-0.5 rounded-lg">
                <TabsTrigger value="info" className="flex-1 text-xs h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  订单信息
                </TabsTrigger>
                <TabsTrigger value="logistics" className="flex-1 text-xs h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  物流追踪
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex-1 text-xs h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  备注
                </TabsTrigger>
              </TabsList>

              {/* ===== 订单信息 Tab ===== */}
              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">订单金额</p>
                    <p className="text-lg font-bold crm-number">{formatCurrency(order.totalAmount)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-muted-foreground">已收款</p>
                    <p className="text-lg font-bold crm-number text-emerald-600">{formatCurrency(order.paidAmount)}</p>
                  </Card>
                </div>

                <Card className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">付款条款</span>
                    <span>{order.paymentTerm || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">交货日期</span>
                    <span>{order.deliveryDate ? format(new Date(order.deliveryDate), 'yyyy-MM-dd', { locale: zhCN }) : '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">创建时间</span>
                    <span>{format(new Date(order.createdAt), 'yyyy-MM-dd', { locale: zhCN })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">创建人</span>
                    <span>{order.creator?.name || '-'}</span>
                  </div>
                </Card>

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
              </TabsContent>

              {/* ===== 物流追踪 Tab ===== */}
              <TabsContent value="logistics" className="mt-4 space-y-4 pb-4 overflow-y-auto max-h-[calc(100vh-280px)] crm-scrollbar">
                {/* Visual Timeline */}
                {order.status !== 'cancelled' && (
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium mb-3">订单进度时间线</h4>
                    <div className="relative pl-6">
                      {/* Connecting line */}
                      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-muted" />

                      {ORDER_STEPS.map((step, index) => {
                        const isCompleted = index < currentStepIndex
                        const isCurrent = index === currentStepIndex
                        const isFuture = index > currentStepIndex
                        const StepIcon = ORDER_STEP_ICONS[step]
                        const stepDate = getStepDate(step)

                        return (
                          <div key={step} className="relative flex items-start gap-3 pb-4 last:pb-0">
                            {/* Dot */}
                            <div className={cn(
                              'absolute -left-6 top-0.5 flex items-center justify-center w-[22px] h-[22px] rounded-full border-2 z-10',
                              isCurrent && 'border-emerald-500 bg-emerald-500 text-white',
                              isCompleted && 'border-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
                              isFuture && 'border-muted-foreground/30 bg-background text-muted-foreground/50',
                            )}>
                              {isCompleted ? (
                                <Check className="h-3 w-3" />
                              ) : isCurrent ? (
                                <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                              ) : (
                                StepIcon && <StepIcon className="h-3 w-3" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center justify-between">
                                <span className={cn(
                                  'text-sm font-medium',
                                  isCurrent && 'text-emerald-600 dark:text-emerald-400',
                                  isCompleted && 'text-foreground',
                                  isFuture && 'text-muted-foreground',
                                )}>
                                  {ORDER_STEP_LABELS[step]}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full font-medium">
                                    当前阶段
                                  </span>
                                )}
                                {isCompleted && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full">
                                    已完成
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                预计: {format(stepDate, 'MM月dd日', { locale: zhCN })}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Tracking Number */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-medium">快递单号</Label>
                  {editingTrackingNo ? (
                    <div className="flex gap-2">
                      <Input
                        value={trackingNoInput}
                        onChange={(e) => setTrackingNoInput(e.target.value)}
                        placeholder="输入快递单号..."
                        className="h-9 text-sm font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveField('trackingNo', trackingNoInput)}
                        disabled={savingField === 'trackingNo'}
                      >
                        <Save className="h-3.5 w-3.5 mr-1" />
                        {savingField === 'trackingNo' ? '保存中...' : '保存'}
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-2.5 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setEditingTrackingNo(true)}
                    >
                      <span className="text-sm font-mono">
                        {(order as Record<string, unknown>).trackingNo ? (order as Record<string, unknown>).trackingNo as string : (
                          <span className="text-muted-foreground">点击添加快递单号</span>
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground">点击编辑</span>
                    </div>
                  )}
                </div>

                {/* Shipping Method */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">贸易条款</Label>
                  <Select value={shippingMethod} onValueChange={(v) => {
                    setShippingMethod(v)
                    handleSaveField('shippingMethod', v)
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIPPING_METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* ===== 备注 Tab ===== */}
              <TabsContent value="notes" className="mt-4 space-y-4 pb-4 overflow-y-auto max-h-[calc(100vh-280px)] crm-scrollbar">
                {/* Order Notes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">订单备注</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => handleSaveField('notes', notesInput)}
                      disabled={savingField === 'notes'}
                    >
                      <Save className="h-3 w-3 mr-1" />
                      保存
                    </Button>
                  </div>
                  <Textarea
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="添加订单备注信息..."
                    rows={4}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">备注信息会展示给客户</p>
                </div>

                <Separator />

                {/* Internal Notes */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">内部备注（仅团队可见）</Label>
                  <Textarea
                    value={internalNotesInput}
                    onChange={(e) => setInternalNotesInput(e.target.value)}
                    placeholder="添加内部备注，仅团队成员可见..."
                    rows={4}
                    className="text-sm border-dashed"
                  />
                  <p className="text-[10px] text-muted-foreground">内部备注不会展示给客户</p>
                </div>

                <Separator />

                {/* Quick Info */}
                <Card className="p-3 bg-muted/30">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>订单时间线</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span>创建时间</span>
                      <span className="font-mono">{format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                    </div>
                    {order.updatedAt && (
                      <div className="flex justify-between">
                        <span>最后更新</span>
                        <span className="font-mono">{format(new Date(order.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                      </div>
                    )}
                    {order.deliveryDate && (
                      <div className="flex justify-between">
                        <span>预计交货</span>
                        <span className="font-mono">{format(new Date(order.deliveryDate), 'yyyy-MM-dd', { locale: zhCN })}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

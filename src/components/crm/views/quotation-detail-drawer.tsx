'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { StatusBadge } from '@/components/crm/status-badge'
import { DetailSkeleton } from '@/components/crm/loading-skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { formatCurrency, cn } from '@/lib/utils'
import {
  Send, CheckCircle2, XCircle, Trash2, Eye,
  FileText, Clock, DollarSign, BarChart3, Package,
  MessageSquare, Calendar, User, TrendingUp, AlertTriangle,
  ClipboardCheck,
} from 'lucide-react'

const Phone = (props: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
)

// Activity type icon/color mapping
const ACTIVITY_TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  follow_up: { icon: MessageSquare, color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400', label: '跟进' },
  email: { icon: Send, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400', label: '邮件' },
  call: { icon: Phone, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400', label: '电话' },
  meeting: { icon: User, color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400', label: '会议' },
  note: { icon: FileText, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', label: '备注' },
  system: { icon: Clock, color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400', label: '系统' },
}

interface QuotationItem {
  id: string
  productName: string
  productSpec?: string
  quantity: number
  unit: string
  unitPrice: number
  cost: number
  totalPrice: number
  priceDeviationFlag: boolean
  product?: { productCode: string }
}

interface QuotationData {
  id: string
  quoteNo: string
  version: number
  status: string
  tradeTerm: string
  currency: string
  exchangeRate: number
  totalAmount: number
  totalCost: number
  profitRate: number
  validUntil?: string
  notes?: string
  marginCheckPassed?: boolean
  marginCheckReason?: string
  createdAt: string
  updatedAt?: string
  inquiry?: { inquiryNo: string; subject?: string }
  customer?: { id: string; companyName: string; companyNameEn?: string; country?: string }
  creator?: { id: string; name: string }
  approver?: { id: string; name: string }
  items?: QuotationItem[]
  orders?: Array<{ id: string; orderNo: string; status: string }>
}

interface ActivityData {
  id: string
  type: string
  subject?: string
  content?: string
  createdAt: string
  user?: { name: string }
}

export function QuotationDetailDrawer() {
  const {
    selectedQuotationId, selectQuotation,
    setCurrentNavigation, selectCustomer,
  } = useCRMStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['quotation', selectedQuotationId],
    queryFn: () => fetch(`/api/quotations/${selectedQuotationId}`).then((r) => r.json()),
    enabled: !!selectedQuotationId,
  })

  const { data: activitiesData } = useQuery({
    queryKey: ['quotation-activities', selectedQuotationId],
    queryFn: () => fetch(`/api/activities?entityType=quotation&entityId=${selectedQuotationId}&pageSize=50`).then((r) => r.json()),
    enabled: !!selectedQuotationId,
  })

  const quotation = data?.data as QuotationData | undefined
  const activities = (activitiesData?.data || []) as ActivityData[]

  const [activeTab, setActiveTab] = useState('overview')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (quotation) {
      setActiveTab('overview')
    }
  }, [quotation])

  const handleStatusUpdate = async (status: string) => {
    if (!quotation) return
    try {
      const res = await fetch(`/api/quotations/${quotation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const labels: Record<string, string> = {
          pending: '待审批', sent: '已发送', accepted: '已接受',
          rejected: '已拒绝', expired: '已过期', cancelled: '已取消',
        }
        toast.success(`状态已更新为「${labels[status] || status}」`)
        queryClient.invalidateQueries({ queryKey: ['quotation', quotation.id] })
        queryClient.invalidateQueries({ queryKey: ['quotations'] })
      }
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async () => {
    if (!quotation) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/quotations/${quotation.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('报价已删除')
        queryClient.invalidateQueries({ queryKey: ['quotations'] })
        selectQuotation(null)
      } else {
        toast.error('删除失败')
      }
    } catch {
      toast.error('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const handleViewCustomer = () => {
    if (!quotation?.customer?.id) return
    selectQuotation(null)
    setCurrentNavigation('customer', 'customer-records')
    selectCustomer(quotation.customer.id)
  }

  // Computed values for items tab
  const itemsTotalAmount = quotation?.items?.reduce((sum, item) => sum + item.totalPrice, 0) ?? quotation?.totalAmount ?? 0
  const itemsTotalCost = quotation?.items?.reduce((sum, item) => sum + item.cost * item.quantity, 0) ?? quotation?.totalCost ?? 0
  const itemsProfitRate = itemsTotalAmount > 0 ? ((itemsTotalAmount - itemsTotalCost) / itemsTotalAmount) * 100 : 0

  return (
    <Sheet open={!!selectedQuotationId} onOpenChange={(v) => !v && selectQuotation(null)}>
      <SheetContent className="w-full sm:max-w-2xl p-0">
        {isLoading || !quotation ? (
          <DetailSkeleton />
        ) : (
          <>
            {/* ===== Header Section ===== */}
            <SheetHeader className="p-6 pb-4">
              <div className="space-y-3">
                {/* Top row: quote number + badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <SheetTitle className="text-base font-mono">
                      {quotation.quoteNo}
                      <span className="text-muted-foreground text-sm ml-1">v{quotation.version}</span>
                    </SheetTitle>
                    {quotation.validUntil && (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>有效期至 {format(new Date(quotation.validUntil), 'yyyy-MM-dd', { locale: zhCN })}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={quotation.status} type="quotation" />
                    <Badge variant="outline" className="text-xs">{quotation.tradeTerm}</Badge>
                  </div>
                </div>

                {/* Customer info + view button */}
                {quotation.customer && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{quotation.customer.companyName}</span>
                      {quotation.customer.country && (
                        <span className="text-muted-foreground">· {quotation.customer.country}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={handleViewCustomer}
                    >
                      <Eye className="h-3 w-3" />
                      查看客户
                    </Button>
                  </div>
                )}

                {/* Status change action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {quotation.status === 'draft' && (
                    <Button size="sm" className="h-8 text-xs gap-1" onClick={() => handleStatusUpdate('pending')}>
                      <ClipboardCheck className="h-3 w-3" />
                      提交审批
                    </Button>
                  )}
                  {quotation.status === 'pending' && (
                    <>
                      <Button size="sm" className="h-8 text-xs gap-1" onClick={() => handleStatusUpdate('sent')}>
                        <CheckCircle2 className="h-3 w-3" />
                        审批通过
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handleStatusUpdate('rejected')}>
                        <XCircle className="h-3 w-3" />
                        审批拒绝
                      </Button>
                    </>
                  )}
                  {quotation.status === 'sent' && (
                    <>
                      <Button size="sm" className="h-8 text-xs gap-1" onClick={() => handleStatusUpdate('accepted')}>
                        <CheckCircle2 className="h-3 w-3" />
                        已接受
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => handleStatusUpdate('rejected')}>
                        <XCircle className="h-3 w-3" />
                        已拒绝
                      </Button>
                    </>
                  )}
                  {(quotation.status === 'draft' || quotation.status === 'rejected') && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" className="h-8 text-xs gap-1">
                          <Trash2 className="h-3 w-3" />
                          删除报价
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除报价</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除报价 {quotation.quoteNo} 吗？此操作不可撤销，相关报价项目也将被删除。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-rose-600 hover:bg-rose-700"
                          >
                            {deleting ? '删除中...' : '确认删除'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </SheetHeader>

            <Separator />

            {/* ===== Tabs Section ===== */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
              <TabsList className="w-full h-9 bg-muted/50 p-0.5 rounded-lg">
                <TabsTrigger value="overview" className="flex-1 text-xs h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  概览
                </TabsTrigger>
                <TabsTrigger value="items" className="flex-1 text-xs h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  报价项目
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 text-xs h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  动态记录
                </TabsTrigger>
              </TabsList>

              {/* ===== 概览 Tab ===== */}
              <TabsContent value="overview" className="mt-4 space-y-4 pb-4 overflow-y-auto max-h-[calc(100vh-340px)] crm-scrollbar">
                {/* Financial overview cards */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 border-l-4 border-l-emerald-500">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>总金额</span>
                    </div>
                    <p className="text-xl font-bold crm-number mt-1">
                      {formatCurrency(quotation.totalAmount, quotation.currency)}
                    </p>
                  </Card>
                  <Card className="p-3 border-l-4 border-l-rose-400">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>利润率</span>
                    </div>
                    <p className={cn(
                      'text-xl font-bold crm-number mt-1',
                      quotation.profitRate >= 20 ? 'text-emerald-600' :
                      quotation.profitRate >= 10 ? 'text-amber-600' : 'text-rose-600',
                    )}>
                      {quotation.profitRate.toFixed(1)}%
                    </p>
                  </Card>
                </div>

                {/* Detail info card */}
                <Card className="p-4 space-y-3">
                  <h4 className="text-sm font-medium">报价详情</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">客户公司</span>
                      {quotation.customer ? (
                        <button
                          className="text-teal-600 hover:text-teal-700 font-medium text-right"
                          onClick={handleViewCustomer}
                        >
                          {quotation.customer.companyName}
                        </button>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">贸易条款</span>
                      <Badge variant="outline" className="text-xs">{quotation.tradeTerm}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">币种 / 汇率</span>
                      <span className="font-mono">{quotation.currency} / {quotation.exchangeRate}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">有效期至</span>
                      <span>
                        {quotation.validUntil
                          ? format(new Date(quotation.validUntil), 'yyyy-MM-dd', { locale: zhCN })
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">创建人</span>
                      <span>{quotation.creator?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">创建时间</span>
                      <span className="font-mono">
                        {format(new Date(quotation.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                    {quotation.approver && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">审批人</span>
                        <span>{quotation.approver.name}</span>
                      </div>
                    )}
                    {quotation.inquiry && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">关联询盘</span>
                        <span className="font-mono">{quotation.inquiry.inquiryNo}</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Margin check warning */}
                {quotation.marginCheckReason && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">利润预警</p>
                    </div>
                    <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">{quotation.marginCheckReason}</p>
                  </div>
                )}

                {/* Notes */}
                {quotation.notes && (
                  <Card className="p-4 bg-muted/30">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <FileText className="h-3.5 w-3.5" />
                      <span>报价备注</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{quotation.notes}</p>
                  </Card>
                )}

                {/* Related orders */}
                {quotation.orders && quotation.orders.length > 0 && (
                  <Card className="p-4 space-y-2">
                    <h4 className="text-sm font-medium">关联订单</h4>
                    <div className="space-y-1.5">
                      {quotation.orders.map((order) => (
                        <div key={order.id} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">{order.orderNo}</span>
                          <StatusBadge status={order.status} type="order" />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Quick time info */}
                <Card className="p-3 bg-muted/30">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>时间线</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span>创建时间</span>
                      <span className="font-mono">{format(new Date(quotation.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                    </div>
                    {quotation.updatedAt && quotation.updatedAt !== quotation.createdAt && (
                      <div className="flex justify-between">
                        <span>最后更新</span>
                        <span className="font-mono">{format(new Date(quotation.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                      </div>
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* ===== 报价项目 Tab ===== */}
              <TabsContent value="items" className="mt-4 space-y-4 pb-4 overflow-y-auto max-h-[calc(100vh-340px)] crm-scrollbar">
                {quotation.items && quotation.items.length > 0 ? (
                  <>
                    {/* Items table */}
                    <Card>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">产品名称</TableHead>
                              <TableHead className="text-xs">规格</TableHead>
                              <TableHead className="text-xs text-right">数量</TableHead>
                              <TableHead className="text-xs">单价</TableHead>
                              <TableHead className="text-xs text-right">小计</TableHead>
                              <TableHead className="text-xs text-right">成本</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {quotation.items.map((item: QuotationItem) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-xs font-medium">
                                  <div className="flex items-center gap-1">
                                    <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                                    <span>{item.productName}</span>
                                  </div>
                                  {item.priceDeviationFlag && (
                                    <Badge variant="outline" className="text-[10px] mt-0.5 border-amber-300 text-amber-600">
                                      偏差
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{item.productSpec || '-'}</TableCell>
                                <TableCell className="text-xs text-right crm-number">
                                  {item.quantity} <span className="text-muted-foreground">{item.unit}</span>
                                </TableCell>
                                <TableCell className="text-xs crm-number">{formatCurrency(item.unitPrice, quotation.currency)}</TableCell>
                                <TableCell className="text-xs text-right crm-number font-medium">{formatCurrency(item.totalPrice, quotation.currency)}</TableCell>
                                <TableCell className="text-xs text-right crm-number text-muted-foreground">{formatCurrency(item.cost * item.quantity, quotation.currency)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    {/* Summary totals */}
                    <Card className="p-4 space-y-2">
                      <h4 className="text-sm font-medium mb-3">汇总</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">报价总金额</span>
                          <span className="text-base font-bold crm-number">{formatCurrency(itemsTotalAmount, quotation.currency)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">总成本</span>
                          <span className="text-base font-bold crm-number text-muted-foreground">{formatCurrency(itemsTotalCost, quotation.currency)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">利润率</span>
                          <span className={cn(
                            'text-base font-bold crm-number',
                            itemsProfitRate >= 20 ? 'text-emerald-600' :
                            itemsProfitRate >= 10 ? 'text-amber-600' : 'text-rose-600',
                          )}>
                            {itemsProfitRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </Card>

                    {/* Visual profit rate bar */}
                    <Card className="p-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                        <span>利润率</span>
                        <span>{itemsProfitRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            itemsProfitRate >= 20 ? 'bg-emerald-500' :
                            itemsProfitRate >= 10 ? 'bg-amber-500' : 'bg-rose-500',
                          )}
                          style={{ width: `${Math.min(itemsProfitRate, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>0%</span>
                        <span>10%</span>
                        <span>20%</span>
                        <span>30%+</span>
                      </div>
                    </Card>
                  </>
                ) : (
                  <Card className="p-8">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Package className="h-10 w-10 mb-3 opacity-40" />
                      <p className="text-sm font-medium">暂无报价项目</p>
                      <p className="text-xs mt-1">该报价尚未添加任何产品项目</p>
                    </div>
                  </Card>
                )}
              </TabsContent>

              {/* ===== 动态记录 Tab ===== */}
              <TabsContent value="history" className="mt-4 space-y-4 pb-4 overflow-y-auto max-h-[calc(100vh-340px)] crm-scrollbar">
                {activities.length > 0 ? (
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium mb-3">活动时间线</h4>
                    <div className="relative pl-6">
                      {/* Connecting line */}
                      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-muted" />

                      {activities.map((activity) => {
                        const config = ACTIVITY_TYPE_CONFIG[activity.type] || ACTIVITY_TYPE_CONFIG.note
                        const Icon = config.icon

                        return (
                          <div key={activity.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
                            {/* Icon dot */}
                            <div className={cn(
                              'absolute -left-6 top-0.5 flex items-center justify-center w-[22px] h-[22px] rounded-full z-10',
                              config.color,
                            )}>
                              <Icon className="h-3 w-3" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{config.label}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {format(new Date(activity.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
                                </span>
                              </div>
                              {activity.subject && (
                                <p className="text-xs text-foreground mt-0.5">{activity.subject}</p>
                              )}
                              {activity.content && (
                                <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{activity.content}</p>
                              )}
                              {activity.user && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  <User className="h-2.5 w-2.5 inline mr-0.5" />
                                  {activity.user.name}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <Card className="p-8">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
                      <p className="text-sm font-medium">暂无活动记录</p>
                      <p className="text-xs mt-1">该报价暂无相关动态记录</p>
                    </div>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

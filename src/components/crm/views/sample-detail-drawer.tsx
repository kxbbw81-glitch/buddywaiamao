'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { StatusBadge } from '@/components/crm/status-badge'
import { DetailSkeleton } from '@/components/crm/loading-skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn, getCountryFlag } from '@/lib/utils'
import {
  Check,
  Clock,
  Package,
  Truck,
  Beaker,
  ThumbsUp,
  XCircle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'

// 样品状态步骤定义
const SAMPLE_STEPS = [
  'pending',
  'approved',
  'sent',
  'in_transit',
  'delivered',
  'testing',
  'confirmed',
]

const SAMPLE_STEP_LABELS: Record<string, string> = {
  pending: '待处理',
  approved: '已批准',
  sent: '已寄出',
  in_transit: '运输中',
  delivered: '已送达',
  testing: '测试中',
  confirmed: '已确认',
  rejected: '已拒绝',
}

const SAMPLE_STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  approved: Check,
  sent: Package,
  in_transit: Truck,
  delivered: Package,
  testing: Beaker,
  confirmed: ThumbsUp,
  rejected: XCircle,
}

// 每个步骤相对于创建日期的模拟天数偏移
const SAMPLE_STEP_DAYS: Record<string, number> = {
  pending: 0,
  approved: 2,
  sent: 4,
  in_transit: 8,
  delivered: 14,
  testing: 15,
  confirmed: 21,
  rejected: 18,
}

export function SampleDetailDrawer() {
  const { selectedSampleId, selectSample, setCurrentModule, selectCustomer, selectInquiry } = useCRMStore()

  const { data, isLoading } = useQuery({
    queryKey: ['sample', selectedSampleId],
    queryFn: () => fetch(`/api/samples/${selectedSampleId}`).then((r) => r.json()),
    enabled: !!selectedSampleId,
  })

  const sample = data?.data

  const [activeTab, setActiveTab] = useState('info')

  // 确定当前步骤索引
  const currentStepIndex = SAMPLE_STEPS.indexOf(sample?.status || 'pending')
  const isRejected = sample?.status === 'rejected'
  const createdDate = sample?.createdAt ? new Date(sample.createdAt) : new Date()

  const getStepDate = (step: string) => {
    const days = SAMPLE_STEP_DAYS[step] || 0
    return addDays(createdDate, days)
  }

  // 构建时间线条目
  const buildTimeline = () => {
    if (!sample) return []

    // 拒绝状态特殊处理
    if (isRejected) {
      const rejectedSteps = ['pending', 'approved', 'rejected']
      return rejectedSteps.map((step) => {
        const isCompleted = step === 'pending'
        const isCurrent = step === sample.status
        return {
          step,
          label: SAMPLE_STEP_LABELS[step],
          date: getStepDate(step),
          isCompleted,
          isCurrent,
          isFuture: false,
          icon: SAMPLE_STEP_ICONS[step],
        }
      })
    }

    return SAMPLE_STEPS.map((step, index) => {
      const isCompleted = index < currentStepIndex
      const isCurrent = index === currentStepIndex
      const isFuture = index > currentStepIndex
      return {
        step,
        label: SAMPLE_STEP_LABELS[step],
        date: getStepDate(step),
        isCompleted,
        isCurrent,
        isFuture,
        icon: SAMPLE_STEP_ICONS[step],
      }
    })
  }

  const timeline = buildTimeline()

  // 点击客户跳转
  const handleCustomerClick = (customerId: string) => {
    selectSample(null)
    setCurrentModule('customers')
    selectCustomer(customerId)
  }

  // 点击询盘跳转
  const handleInquiryClick = (inquiryId: string) => {
    selectSample(null)
    setCurrentModule('inquiries')
    selectInquiry(inquiryId)
  }

  return (
    <Sheet open={!!selectedSampleId} onOpenChange={(v) => !v && selectSample(null)}>
      <SheetContent className="w-full sm:max-w-xl p-0">
        {isLoading || !sample ? (
          <DetailSkeleton />
        ) : (
          <>
            <SheetHeader className="p-6 pb-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-base font-mono">{sample.id}</SheetTitle>
                    <p className="text-sm font-medium mt-1 truncate">{sample.productName}</p>
                  </div>
                  <StatusBadge status={sample.status} type="sample" />
                </div>
              </div>
            </SheetHeader>

            <Separator />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
              <TabsList className="w-full h-9 bg-muted/50 p-0.5 rounded-lg">
                <TabsTrigger value="info" className="flex-1 text-xs h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  基本信息
                </TabsTrigger>
                <TabsTrigger value="timeline" className="flex-1 text-xs h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  状态跟踪
                </TabsTrigger>
                <TabsTrigger value="notes" className="flex-1 text-xs h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md">
                  备注
                </TabsTrigger>
              </TabsList>

              {/* ===== 基本信息 Tab ===== */}
              <TabsContent value="info" className="mt-4 space-y-4 pb-6 overflow-y-auto max-h-[calc(100vh-220px)] crm-scrollbar">
                <Card className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {/* 样品编号 */}
                    <div>
                      <p className="text-xs text-muted-foreground">样品编号</p>
                      <p className="text-sm font-mono mt-0.5">{sample.id}</p>
                    </div>

                    {/* 样品名称 */}
                    <div>
                      <p className="text-xs text-muted-foreground">样品名称</p>
                      <p className="text-sm font-medium mt-0.5">{sample.productName}</p>
                    </div>

                    {/* 规格 */}
                    <div>
                      <p className="text-xs text-muted-foreground">规格</p>
                      <p className="text-sm mt-0.5 text-muted-foreground">-</p>
                    </div>

                    {/* 数量 */}
                    <div>
                      <p className="text-xs text-muted-foreground">数量</p>
                      <p className="text-sm crm-number font-medium mt-0.5">{sample.quantity}</p>
                    </div>

                    {/* 状态 */}
                    <div>
                      <p className="text-xs text-muted-foreground">状态</p>
                      <div className="mt-0.5">
                        <StatusBadge status={sample.status} type="sample" />
                      </div>
                    </div>

                    {/* 创建时间 */}
                    <div>
                      <p className="text-xs text-muted-foreground">创建时间</p>
                      <p className="text-sm font-mono mt-0.5">
                        {format(new Date(sample.createdAt), 'yyyy-MM-dd', { locale: zhCN })}
                      </p>
                    </div>

                    {/* 寄出时间 */}
                    <div>
                      <p className="text-xs text-muted-foreground">寄出时间</p>
                      <p className="text-sm font-mono mt-0.5">
                        {sample.sentAt
                          ? format(new Date(sample.sentAt), 'yyyy-MM-dd', { locale: zhCN })
                          : '-'}
                      </p>
                    </div>

                    {/* 送达时间 */}
                    <div>
                      <p className="text-xs text-muted-foreground">预计完成日期</p>
                      <p className="text-sm font-mono mt-0.5">
                        {sample.deliveredAt
                          ? format(new Date(sample.deliveredAt), 'yyyy-MM-dd', { locale: zhCN })
                          : '-'}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {/* 物流单号 */}
                    <div>
                      <p className="text-xs text-muted-foreground">物流单号</p>
                      <p className="text-sm font-mono mt-0.5">
                        {sample.trackingNo || '-'}
                      </p>
                    </div>

                    {/* 快递方式 */}
                    <div>
                      <p className="text-xs text-muted-foreground">快递方式</p>
                      <p className="text-sm mt-0.5">
                        {sample.shippingMethod || '-'}
                      </p>
                    </div>

                    {/* 邮寄地址 */}
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">邮寄地址</p>
                      <p className="text-sm mt-0.5 text-muted-foreground">-</p>
                    </div>

                    {/* 运费 */}
                    <div>
                      <p className="text-xs text-muted-foreground">运费</p>
                      <p className="text-sm mt-0.5 text-muted-foreground">-</p>
                    </div>
                  </div>

                  <Separator />

                  {/* 关联客户 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">关联客户</p>
                      {sample.customer ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 mt-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline transition-colors"
                          onClick={() => handleCustomerClick(sample.customer.id)}
                        >
                          <span>{getCountryFlag(sample.customer.country || '')}</span>
                          <span className="font-medium">{sample.customer.companyName}</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </button>
                      ) : (
                        <p className="text-sm mt-1 text-muted-foreground">未关联</p>
                      )}
                    </div>
                  </div>

                  {/* 关联询盘 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">关联询盘</p>
                      {sample.inquiry ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 mt-1 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline transition-colors"
                          onClick={() => handleInquiryClick(sample.inquiry.id)}
                        >
                          <span className="font-mono text-xs">{sample.inquiry.inquiryNo}</span>
                          <ArrowRight className="h-3 w-3 opacity-60" />
                          <span>{sample.inquiry.subject || '无主题'}</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </button>
                      ) : (
                        <p className="text-sm mt-1 text-muted-foreground">未关联</p>
                      )}
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* ===== 状态跟踪 Tab ===== */}
              <TabsContent value="timeline" className="mt-4 space-y-4 pb-6 overflow-y-auto max-h-[calc(100vh-220px)] crm-scrollbar">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <h4 className="text-sm font-medium">样品生命周期时间线</h4>
                  </div>

                  {sample.status === 'rejected' && (
                    <div className="mb-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/30">
                      <div className="flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5 text-rose-500" />
                        <span className="text-xs font-medium text-rose-600 dark:text-rose-400">样品已被客户拒绝</span>
                      </div>
                    </div>
                  )}

                  <div className="relative pl-6">
                    {/* 连接线 */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-muted" />

                    {timeline.map((entry) => {
                      const StepIcon = entry.icon
                      return (
                        <div key={entry.step} className="relative flex items-start gap-3 pb-4 last:pb-0">
                          {/* 圆点 */}
                          <div
                            className={cn(
                              'absolute -left-6 top-0.5 flex items-center justify-center w-[22px] h-[22px] rounded-full border-2 z-10',
                              entry.isCurrent && entry.step === 'rejected'
                                ? 'border-rose-500 bg-rose-500 text-white'
                                : entry.isCurrent && 'border-teal-500 bg-teal-500 text-white',
                              entry.isCompleted && 'border-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
                              entry.isFuture && 'border-muted-foreground/30 bg-background text-muted-foreground/50',
                            )}
                          >
                            {entry.isCompleted ? (
                              <Check className="h-3 w-3" />
                            ) : entry.isCurrent ? (
                              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                            ) : (
                              StepIcon && <StepIcon className="h-3 w-3" />
                            )}
                          </div>

                          {/* 内容 */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center justify-between">
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  entry.isCurrent && entry.step === 'rejected'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : entry.isCurrent && 'text-teal-600 dark:text-teal-400',
                                  entry.isCompleted && 'text-foreground',
                                  entry.isFuture && 'text-muted-foreground',
                                )}
                              >
                                {entry.label}
                              </span>
                              {entry.isCurrent && entry.step !== 'rejected' && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0.5 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full font-medium border-0"
                                >
                                  当前阶段
                                </Badge>
                              )}
                              {entry.isCurrent && entry.step === 'rejected' && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full font-medium border-0"
                                >
                                  已终止
                                </Badge>
                              )}
                              {entry.isCompleted && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full border-0"
                                >
                                  已完成
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {format(entry.date, 'yyyy年MM月dd日', { locale: zhCN })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 测试结果 */}
                {sample.testResult && (
                  <Card className="p-3 bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground mb-1">测试结果</p>
                    <p className="text-sm">{sample.testResult}</p>
                  </Card>
                )}
              </TabsContent>

              {/* ===== 备注 Tab ===== */}
              <TabsContent value="notes" className="mt-4 space-y-4 pb-6 overflow-y-auto max-h-[calc(100vh-220px)] crm-scrollbar">
                {sample.notes ? (
                  <Card className="p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">备注信息</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{sample.notes}</p>
                  </Card>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <div className="p-3 rounded-full bg-muted/50 mb-3">
                      <Package className="h-6 w-6 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">暂无备注</p>
                    <p className="text-xs mt-1">该样品尚未添加备注信息</p>
                  </div>
                )}

                <Separator />

                {/* 时间信息 */}
                <Card className="p-3 bg-muted/30">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>样品时间线</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span>创建时间</span>
                      <span className="font-mono">{format(new Date(sample.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                    </div>
                    {sample.updatedAt && (
                      <div className="flex justify-between">
                        <span>最后更新</span>
                        <span className="font-mono">{format(new Date(sample.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                      </div>
                    )}
                    {sample.sentAt && (
                      <div className="flex justify-between">
                        <span>寄出时间</span>
                        <span className="font-mono">{format(new Date(sample.sentAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
                      </div>
                    )}
                    {sample.deliveredAt && (
                      <div className="flex justify-between">
                        <span>送达时间</span>
                        <span className="font-mono">{format(new Date(sample.deliveredAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}</span>
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

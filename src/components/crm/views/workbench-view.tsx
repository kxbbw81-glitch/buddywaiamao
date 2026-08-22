'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Target,
  FileText,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Info,
  Plus,
  Bot,
  BarChart3,
  Clock,
  Mail,
  Phone,
  MessageSquare,
  CalendarDays,
  ArrowUpRight,
  Sparkles,
  UserPlus,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Wallet,
  PieChart as PieChartIcon,
  CreditCard,
  TrendingDown,
  Eye,
  Calendar,
  AlertTriangle as AlertTriangleIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { KPICard } from '@/components/crm/kpi-card'
import { StatusBadge } from '@/components/crm/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

const activityIcons: Record<string, React.ElementType> = {
  email: Mail,
  call: Phone,
  meeting: Users,
  note: MessageSquare,
  follow_up: Clock,
  system: Bot,
}

const motivationalLines = [
  '每一个询盘都是潜在的合作机会',
  '跟进及时，成交率提升50%',
  '今天的目标客户，就是明天的订单',
  '数据驱动决策，效率成就业绩',
  '客户至上，服务为先',
]

// Mini sparkline SVG component - 80x32px
function MiniSparkline({ data, width = 80, height = 32 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null

  const maxVal = Math.max(...data, 1)
  const minVal = Math.min(...data, 0)
  const range = maxVal - minVal || 1
  const padding = 2

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = padding + (1 - (val - minVal) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  const polylinePoints = points.join(' ')
  // Build area path: line points + close to bottom-right + bottom-left
  const areaPath = `M${points[0]} ${points.map((p) => `L${p}`).join(' ')} L${padding + (width - padding * 2)},${height} L${padding},${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGradient)" />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#10b981"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={padding + (width - padding * 2)}
        cy={padding + (1 - (data[data.length - 1] - minVal) / range) * (height - padding * 2)}
        r={2.5}
        fill="#10b981"
      />
    </svg>
  )
}

const quickActions = [
  { label: '新建客户', subtitle: '创建和管理客户档案', icon: UserPlus, color: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500/20 to-teal-500/10', border: 'border-emerald-200 dark:border-emerald-800', action: 'customer' },
  { label: '新建询盘', subtitle: '创建和跟进新询盘', icon: FileText, color: 'text-teal-600 dark:text-teal-400', gradient: 'from-teal-500/20 to-cyan-500/10', border: 'border-teal-200 dark:border-teal-800', action: 'inquiry' },
  { label: '新建报价', subtitle: '快速生成专业报价单', icon: Calculator, color: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-200 dark:border-amber-800', action: 'quotation' },
  { label: 'AI分析', subtitle: '智能分析辅助决策', icon: Sparkles, color: 'text-rose-600 dark:text-rose-400', gradient: 'from-rose-500/20 to-pink-500/10', border: 'border-rose-200 dark:border-rose-800', action: 'ai' },
]

interface QuickActionItem {
  label: string
  subtitle?: string
  icon: React.ElementType
  color: string
  gradient: string
  border: string
  action: string
}

const roleQuickActions: Record<string, QuickActionItem[]> = {
  finance: [
    { label: '收款管理', subtitle: '管理和跟踪收款进度', icon: Wallet, color: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500/20 to-teal-500/10', border: 'border-emerald-200 dark:border-emerald-800', action: 'payments' },
    { label: '查看订单', subtitle: '查看订单状态和进度', icon: ShoppingCart, color: 'text-teal-600 dark:text-teal-400', gradient: 'from-teal-500/20 to-cyan-500/10', border: 'border-teal-200 dark:border-teal-800', action: 'orders' },
    { label: '报价审核', subtitle: '审核待确认的报价', icon: FileText, color: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-200 dark:border-amber-800', action: 'quotations' },
    { label: 'AI分析', subtitle: '智能分析辅助决策', icon: Sparkles, color: 'text-rose-600 dark:text-rose-400', gradient: 'from-rose-500/20 to-pink-500/10', border: 'border-rose-200 dark:border-rose-800', action: 'ai' },
  ],
  management: [
    { label: '新建客户', subtitle: '创建和管理客户档案', icon: UserPlus, color: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500/20 to-teal-500/10', border: 'border-emerald-200 dark:border-emerald-800', action: 'customer' },
    { label: '数据分析', subtitle: '销售数据和趋势分析', icon: BarChart3, color: 'text-teal-600 dark:text-teal-400', gradient: 'from-teal-500/20 to-cyan-500/10', border: 'border-teal-200 dark:border-teal-800', action: 'analytics' },
    { label: '查看订单', subtitle: '查看订单状态和进度', icon: ShoppingCart, color: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-200 dark:border-amber-800', action: 'orders' },
    { label: 'AI分析', subtitle: '智能分析辅助决策', icon: Sparkles, color: 'text-rose-600 dark:text-rose-400', gradient: 'from-rose-500/20 to-pink-500/10', border: 'border-rose-200 dark:border-rose-800', action: 'ai' },
  ],
}

export function WorkbenchView() {
  const { currentUser, openInquiryForm, openCustomerForm, openQuotationForm, selectInquiry, toggleAiDrawer } = useCRMStore()

  useEffect(() => {
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const { data: pendingInquiriesData } = useQuery({
    queryKey: ['pending-inquiries'],
    queryFn: () => fetch('/api/inquiries?status=new&pageSize=50').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const { data: followingInquiriesData } = useQuery({
    queryKey: ['following-inquiries'],
    queryFn: () => fetch('/api/inquiries?status=following&pageSize=50').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const { data: customerTrendData } = useQuery({
    queryKey: ['customer-trend'],
    queryFn: () => fetch('/api/dashboard/customer-trend').then((r) => r.json()),
    refetchInterval: 60000,
  })

  const pendingInquiries = [...(pendingInquiriesData?.data || []), ...(followingInquiriesData?.data || [])]
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const pa = a.priority as string
      const pb = b.priority as string
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
      return (priorityOrder[pa] || 2) - (priorityOrder[pb] || 2)
    })

  const handleQuickAction = (action: string) => {
    const { setCurrentNavigation } = useCRMStore.getState()
    switch (action) {
      case 'customer': openCustomerForm(); break
      case 'inquiry': openInquiryForm(); break
      case 'quotation': openQuotationForm(); break
      case 'ai': toggleAiDrawer(); break
      case 'payments': setCurrentNavigation('finance', 'orders-collections'); break
      case 'orders': setCurrentNavigation('fulfillment', 'contract-orders'); break
      case 'quotations': setCurrentNavigation('quote', 'quotation-management'); break
      case 'analytics': setCurrentNavigation('insight', 'data-analysis'); break
    }
  }

  const activeQuickActions = roleQuickActions[currentUser?.primaryRole || ''] || quickActions

  if (isLoading || !data?.data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-4 bg-muted rounded w-20 mb-3" />
              <div className="h-8 bg-muted rounded w-16 mb-2" />
              <div className="h-4 bg-muted rounded w-24" />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const { kpis, riskAlerts, recentActivities, charts } = data.data

  const funnelData = [
    { stage: '询盘', count: kpis.totalInquiries, value: kpis.totalInquiries },
    { stage: '报价', count: kpis.pendingQuotations, value: kpis.pendingQuotations },
    { stage: '订单', count: kpis.activeOrders, value: kpis.activeOrders },
    { stage: '成交', count: kpis.wonInquiries, value: kpis.wonInquiries },
  ]

  const statusLabels: Record<string, string> = {
    new: '新询盘', assigned: '已分配', following: '跟进中', quoted: '已报价',
    won: '已成交', lost: '已流失', pooled: '公海', closed: '已关闭',
  }

  const today = new Date()
  const dayOfWeek = format(today, 'EEEE', { locale: zhCN })
  const dateStr = format(today, 'yyyy年M月d日', { locale: zhCN })
  const motivLine = motivationalLines[today.getDate() % motivationalLines.length]

  return (
    <div className="space-y-6 workbench-bg rounded-lg p-1">
      {/* Welcome Section */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1 className="text-xl font-bold">
            欢迎回来, {currentUser?.name || '用户'}!
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {dateStr} {dayOfWeek}
          </p>
        </div>
        <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" />
          {motivLine}
        </p>
      </motion.div>

      {/* Risk Alerts Bar */}
      {riskAlerts.length > 0 && (
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-2">
            {riskAlerts.map((alert: Record<string, unknown>, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs shrink-0 crm-card-hover',
                  alert.level === 'danger' && 'border border-rose-200 text-rose-700 dark:border-rose-800 dark:text-rose-400 risk-alert-danger',
                  alert.level === 'warning' && 'border border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400 risk-alert-warning',
                  alert.level === 'info' && 'border border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 risk-alert-info'
                )}
              >
                {alert.level === 'danger' ? <AlertTriangle className="h-3 w-3" /> : alert.level === 'warning' ? <AlertCircle className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                <span>{alert.message as string}</span>
              </motion.div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      {/* 今日概要 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
      >
        <Card className="overflow-hidden">
          <div className="flex items-center">
            {/* Today's date */}
            <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0">
              <div className="p-2 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{dateStr}</p>
                <p className="text-xs text-muted-foreground">{dayOfWeek}</p>
              </div>
            </div>
            {/* Divider */}
            <div className="w-px h-10 bg-border flex-shrink-0" />
            {/* Today's new inquiries */}
            <div className="flex items-center gap-3 px-5 py-4 flex-1">
              <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">今日新增询盘</p>
                <p className="text-lg font-bold crm-stat-mini crm-number">{formatNumber(kpis.todayInquiries || 0)}</p>
              </div>
            </div>
            {/* Divider */}
            <div className="w-px h-10 bg-border flex-shrink-0" />
            {/* Pending follow-ups */}
            <div className="flex items-center gap-3 px-5 py-4 flex-1">
              <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">待跟进</p>
                <p className="text-lg font-bold crm-stat-mini crm-number">{formatNumber(kpis.pendingFollow || 0)}</p>
              </div>
            </div>
            {/* Divider */}
            <div className="w-px h-10 bg-border flex-shrink-0" />
            {/* Overdue payments */}
            <div className="flex items-center gap-3 px-5 py-4 flex-1">
              <div className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                <AlertTriangleIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">逾期款项</p>
                <p className="text-lg font-bold crm-stat-mini crm-number">{formatNumber(kpis.overduePaymentsCount || 0)}</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* 快速操作 Quick Actions */}
      <motion.div
        className="grid grid-cols-4 gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {activeQuickActions.map((item, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <Card
              className={cn(
                'cursor-pointer p-4 flex flex-col items-center gap-2 border transition-all duration-200 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20',
                item.border
              )}
              onClick={() => handleQuickAction(item.action)}
            >
              <div className={cn('p-2.5 rounded-full bg-gradient-to-br', item.gradient)}>
                <item.icon className={cn('h-5 w-5', item.color)} />
              </div>
              <span className="text-xs font-medium">{item.label}</span>
              {item.subtitle && (
                <span className="text-[10px] text-muted-foreground text-center leading-tight">{item.subtitle}</span>
              )}
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08 } },
        }}
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="活跃客户"
            value={kpis.totalCustomers}
            change={12}
            changeType="increase"
            icon={<Users className="h-5 w-5" />}
            variant="emerald"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="活跃询盘"
            value={kpis.activeInquiries}
            change={8}
            changeType="increase"
            icon={<Target className="h-5 w-5" />}
            variant="sky"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="待处理报价"
            value={kpis.pendingQuotations}
            change={-5}
            changeType="decrease"
            icon={<FileText className="h-5 w-5" />}
            variant="amber"
          />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <KPICard
            title="进行中订单"
            value={kpis.activeOrders}
            change={15}
            changeType="increase"
            icon={<ShoppingCart className="h-5 w-5" />}
            variant="violet"
          />
        </motion.div>
        {/* 本月新增客户 - with sparkline */}
        <motion.div variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
          <Card className="p-4 lg:p-6 relative overflow-hidden kpi-card-hover animate-fade-in-up kpi-emerald kpi-border-emerald">
            <div className="kpi-pattern-overlay pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">本月新增客户</p>
                <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20 text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl lg:text-3xl font-bold tabular-nums crm-number tracking-tight">
                {customerTrendData?.data?.currentMonthCount ?? 0}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground">近6个月趋势</span>
                {customerTrendData?.data?.trend && (
                  <MiniSparkline data={customerTrendData.data.trend.map((t: { count: number }) => t.count)} />
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Revenue & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue KPIs with collection rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                收款概览
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">总订单金额</p>
                  <p className="text-xl font-bold crm-number">{formatCurrency(kpis.totalRevenue)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">已收款金额</p>
                  <p className="text-xl font-bold crm-number text-emerald-600">{formatCurrency(kpis.totalPaid)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">订单总数</p>
                  <p className="text-xl font-bold crm-number">{formatNumber(kpis.activeOrders + kpis.completedOrders)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">已完成订单</p>
                  <p className="text-xl font-bold crm-number">{formatNumber(kpis.completedOrders)}</p>
                </div>
              </div>
              {/* Collection Rate Progress Bar */}
              {kpis.totalRevenue > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">回款率</span>
                    <span className="font-medium crm-number text-emerald-600">
                      {((kpis.totalPaid / kpis.totalRevenue) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={(kpis.totalPaid / kpis.totalRevenue) * 100} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Sales Funnel with conversion rates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                销售漏斗
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {funnelData.map((item, i) => {
                  const maxVal = Math.max(...funnelData.map((f) => f.count), 1)
                  const pct = (item.count / maxVal) * 100
                  const convRate = i > 0 && funnelData[i - 1].count > 0
                    ? ((item.count / funnelData[i - 1].count) * 100).toFixed(1)
                    : null
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.stage}</span>
                        <div className="flex items-center gap-2">
                          {convRate && (
                            <span className="text-xs text-muted-foreground">
                              转化 {convRate}%
                            </span>
                          )}
                          <span className="font-medium crm-number">{item.count}</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: COLORS[i] }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.6 + i * 0.1, duration: 0.5 }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row: Inquiry Distribution + 待办事项 & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inquiry Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">询盘状态分布</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div className="w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.inquiriesByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      dataKey="count"
                      nameKey="status"
                    >
                      {charts.inquiriesByStatus.map((_: Record<string, unknown>, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [value, statusLabels[name] || name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {charts.inquiriesByStatus.map((item: Record<string, unknown>, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{statusLabels[item.status as string] || item.status}</span>
                    <span className="font-medium ml-auto crm-number">{item.count as number}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 待办事项 */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-600" />
                待办事项
                <Badge variant="secondary" className="ml-auto text-xs">{pendingInquiries.length} 项待办</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto crm-scrollbar">
                {pendingInquiries.length > 0 ? pendingInquiries.slice(0, 10).map((inq: Record<string, unknown>) => (
                  <div
                    key={inq.id as string}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => selectInquiry(inq.id as string)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-emerald-600 transition-colors">
                        {inq.subject as string || inq.inquiryNo as string}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(inq.customer as Record<string, unknown>)?.companyName as string || '未关联客户'}
                      </p>
                    </div>
                    <StatusBadge status={inq.priority as string} type="priority" />
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">暂无待办事项 🎉</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activities */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                最近动态
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto crm-scrollbar">
                {recentActivities.slice(0, 8).map((activity: Record<string, unknown>, i: number) => {
                  const IconComp = activityIcons[activity.type as string] || MessageSquare
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="p-1.5 rounded-md bg-muted mt-0.5">
                        <IconComp className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{activity.subject as string}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          {activity.user && <span>{(activity.user as Record<string, unknown>).name as string}</span>}
                          <span>{format(new Date(activity.createdAt as string), 'MM-dd HH:mm', { locale: zhCN })}</span>
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Role-specific Panels */}
      {(currentUser?.primaryRole === 'finance' || currentUser?.primaryRole === 'super_admin' || currentUser?.primaryRole === 'management') && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.78 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600" />
                财务快览
                {currentUser?.primaryRole === 'finance' && <Badge variant="secondary" className="ml-auto text-xs bg-emerald-50 text-emerald-700 border-emerald-200">我的工作台</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" />应收总额</p>
                  <p className="text-lg font-bold crm-number">{formatCurrency(kpis.totalRevenue - kpis.totalPaid)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3 text-red-500" />逾期金额</p>
                  <p className="text-lg font-bold crm-number text-red-600">{formatCurrency(kpis.totalRevenue - kpis.totalPaid)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />待审批报价</p>
                  <p className="text-lg font-bold crm-number">{formatNumber(kpis.pendingQuotations)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><PieChartIcon className="h-3 w-3" />回款率</p>
                  <p className="text-lg font-bold crm-number text-emerald-600">{kpis.totalRevenue > 0 ? ((kpis.totalPaid / kpis.totalRevenue) * 100).toFixed(1) : 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Top Customers with gradient bars */}
      {charts.topCustomers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
                Top 客户 (按订单金额)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.topCustomers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {charts.topCustomers.map((_: Record<string, unknown>, i: number) => (
                        <Cell
                          key={i}
                          fill={`url(#barGradient${i})`}
                        />
                      ))}
                      <defs>
                        {charts.topCustomers.map((_: Record<string, unknown>, i: number) => (
                          <linearGradient key={i} id={`barGradient${i}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.7} />
                            <stop offset="100%" stopColor="#059669" stopOpacity={1} />
                          </linearGradient>
                        ))}
                      </defs>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}

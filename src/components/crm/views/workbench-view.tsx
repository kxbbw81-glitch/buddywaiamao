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

export function WorkbenchView() {
  const { currentUser, openInquiryForm, openCustomerForm, openQuotationForm } = useCRMStore()
  

  useEffect(() => {
    
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
    refetchInterval: 30000,
  })

  if (isLoading || !data?.data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
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

  const role = currentUser?.primaryRole || 'sales'

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
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs shrink-0',
                  alert.level === 'danger' && 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-400 risk-alert-danger',
                  alert.level === 'warning' && 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400',
                  alert.level === 'info' && 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-400'
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

      {/* 今日概览 */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
      >
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
          <div className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">今日新增询盘</p>
            <p className="text-lg font-bold crm-stat-mini crm-number">{formatNumber(kpis.todayInquiries || 0)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
          <div className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">待跟进</p>
            <p className="text-lg font-bold crm-stat-mini crm-number">{formatNumber(kpis.pendingFollow || 0)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
          <div className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">即将到期报价</p>
            <p className="text-lg font-bold crm-stat-mini crm-number">{formatNumber(kpis.expiringQuotesCount || 0)}</p>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Row */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {[
          { label: '今日询盘', val: kpis.totalInquiries, icon: ArrowUpRight, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: '今日报价', val: kpis.pendingQuotations, icon: FileText, color: 'text-amber-600 dark:text-amber-400' },
          { label: '今日跟进', val: recentActivities?.length || 0, icon: MessageSquare, color: 'text-sky-600 dark:text-sky-400' },
          { label: '待处理', val: kpis.totalInquiries - kpis.wonInquiries, icon: Clock, color: 'text-rose-600 dark:text-rose-400' },
        ].map((stat, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
            <div className={cn('p-1.5 rounded-md bg-muted', stat.color)}>
              <stat.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-bold crm-number">{formatNumber(stat.val)}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
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
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        className="flex flex-wrap gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Button size="sm" onClick={openInquiryForm}>
          <Plus className="h-4 w-4 mr-1" /> 新建询盘
        </Button>
        <Button size="sm" variant="outline" onClick={openCustomerForm}>
          <Plus className="h-4 w-4 mr-1" /> 新建客户
        </Button>
        <Button size="sm" variant="outline" onClick={openQuotationForm}>
          <Plus className="h-4 w-4 mr-1" /> 新建报价
        </Button>
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

      {/* Bottom Row: Inquiries by Status + Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        {/* Recent Activities */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
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

      {/* Top Customers with gradient bars */}
      {charts.topCustomers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
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

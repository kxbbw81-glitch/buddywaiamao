'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Users, ShoppingCart, DollarSign, TrendingUp, Target,
  BarChart3, PieChart as PieChartIcon, Globe, Trophy, Medal, PackageCheck,
  Clock, UserPlus, CreditCard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/utils'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'

const COLORS = ['#10b981', '#14b8a6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#84cc16']

const REGION_COLORS: Record<string, string> = {
  '亚洲': '#10b981',
  '欧洲': '#14b8a6',
  '北美': '#f59e0b',
  '南美': '#ec4899',
  '非洲': '#ef4444',
  '大洋洲': '#06b6d4',
  '中东': '#f97316',
}

const countryToRegion: Record<string, string> = {
  '美国': '北美',
  '德国': '欧洲',
  '阿联酋': '中东',
  '日本': '亚洲',
  '尼日利亚': '非洲',
  '马来西亚': '亚洲',
  '瑞典': '欧洲',
  '印度': '亚洲',
  '英国': '欧洲',
  '法国': '欧洲',
  '巴西': '南美',
  '澳大利亚': '大洋洲',
  '韩国': '亚洲',
  '中国': '亚洲',
  '墨西哥': '北美',
  '泰国': '亚洲',
  '越南': '亚洲',
}

const regionLabels: Record<string, string> = {
  'Asia': '亚洲',
  'Europe': '欧洲',
  'North America': '北美',
  'South America': '南美',
  'Africa': '非洲',
  'Oceania': '大洋洲',
  'Middle East': '中东',
}

type TrendMode = 'inquiry' | 'quotation' | 'order'

interface AnalyticsData {
  inquiryTrend: Array<{ month: string; value: number }>
  quotationTrend: Array<{ month: string; value: number }>
  orderTrend: Array<{ month: string; value: number }>
  funnelData: Array<{ stage: string; value: number }>
  sourceData: Array<{ name: string; value: number }>
  salesRanking: Array<{ name: string; inquiries: number; revenue: number; conversionRate: number }>
  orderStatusData: Array<{ name: string; value: number }>
  // Enhanced
  monthlyRevenue: Array<{ month: string; value: number }>
  paymentCollectionRate: number
  avgDealCycle: number
  topProducts: Array<{ name: string; orderCount: number; quantity: number }>
  customerAcquisition: Array<{ name: string; value: number }>
  salesPerformance: Array<{ name: string; revenue: number; orderCount: number }>
  thisMonthCustomers: number
  thisMonthOrderAmount: number
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-32" />
           </CardHeader>
      <CardContent>
        <Skeleton className={cn("h-52 w-full", className)} />
      </CardContent>
    </Card>
  )
}

function KPISkeleton() {
  return (
    <Card className="p-4 relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-3 w-16 mt-2" />
      </div>
    </Card>
  )
}

function MetricCard({ label, value, icon, kpiBg, colorClass }: { label: string; value: string; icon: React.ReactNode; kpiBg: string; colorClass: string }) {
  return (
    <Card className={cn('p-4 crm-card-hover relative overflow-hidden', kpiBg, colorClass)}>
      <div className="kpi-pattern-overlay" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <p className="text-xl font-bold crm-number">{value}</p>
      </div>
    </Card>
  )
}

export function AnalyticsView() {
  const [dateRange, setDateRange] = useState('this_year')
  const [trendMode, setTrendMode] = useState<TrendMode>('inquiry')

  const { data: analyticsRes, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', dateRange],
    queryFn: () => fetch(`/api/analytics?dateRange=${dateRange}`).then((r) => r.json()),
  })

  const analytics: AnalyticsData | null = analyticsRes?.data ?? null

  const { data: dashData } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
  })

  const { data: customersData } = useQuery({
    queryKey: ['analytics-customers'],
    queryFn: () => fetch('/api/customers?pageSize=100').then((r) => r.json()),
  })

  const kpis = dashData?.data?.kpis
  const topCustomers = dashData?.data?.charts?.topCustomers || []
  const levelData = dashData?.data?.charts?.customersByLevel || []

  // Compute region distribution from customer data
  const regionData = (() => {
    const regions: Record<string, number> = {}
    const customers = customersData?.data || []
    for (const c of customers) {
      const country = (c as Record<string, unknown>).country as string || ''
      const region = countryToRegion[country] || '其他'
      regions[region] = (regions[region] || 0) + 1
    }
    const total = Object.values(regions).reduce((s, v) => s + v, 0)
    return Object.entries(regions)
      .map(([region, count]) => ({
        name: regionLabels[region] || region,
        count,
        percentage: total > 0 ? ((count / total) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.count - a.count)
  })()

  // Real trend data from API
  const trendDataMap: Record<TrendMode, AnalyticsData['inquiryTrend']> = {
    inquiry: analytics?.inquiryTrend || [],
    quotation: analytics?.quotationTrend || [],
    order: analytics?.orderTrend || [],
  }

  const trendConfig: Record<TrendMode, { label: string; color: string; fillOpacity: number }> = {
    inquiry: { label: '询盘趋势', color: '#10b981', fillOpacity: 0.15 },
    quotation: { label: '报价趋势', color: '#14b8a6', fillOpacity: 0.15 },
    order: { label: '订单趋势', color: '#f59e0b', fillOpacity: 0.15 },
  }

  const avgOrderAmount = kpis && (kpis.activeOrders + kpis.completedOrders) > 0
    ? kpis.totalRevenue / (kpis.activeOrders + kpis.completedOrders)
    : 0

  const paymentRate = kpis && kpis.totalRevenue > 0
    ? ((kpis.totalPaid / kpis.totalRevenue) * 100).toFixed(1)
    : '0'

  const funnelData = analytics?.funnelData || []
  const sourceData = analytics?.sourceData || []
  const salesRanking = analytics?.salesRanking || []
  const orderStatusData = analytics?.orderStatusData || []

  // Enhanced data
  const monthlyRevenue = analytics?.monthlyRevenue || []
  const paymentCollectionRate = analytics?.paymentCollectionRate || 0
  const avgDealCycle = analytics?.avgDealCycle || 0
  const topProducts = analytics?.topProducts || []
  const customerAcquisition = analytics?.customerAcquisition || []
  const salesPerformance = analytics?.salesPerformance || []
  const thisMonthCustomers = analytics?.thisMonthCustomers || 0
  const thisMonthOrderAmount = analytics?.thisMonthOrderAmount || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">数据分析</h2>
          <p className="text-sm text-muted-foreground">全面的业务数据分析与洞察</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="this_week">本周</SelectItem>
            <SelectItem value="this_month">本月</SelectItem>
            <SelectItem value="this_quarter">本季度</SelectItem>
            <SelectItem value="this_year">本年</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Summary Row */}
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}>
        {!kpis ? (
          <><KPISkeleton /><KPISkeleton /><KPISkeleton /><KPISkeleton /></>
        ) : (
          [
            { label: '客户总数', value: kpis.totalCustomers, icon: <Users className="h-5 w-5" />, kpiBg: 'kpi-emerald', colorClass: 'kpi-border-emerald' },
            { label: '询盘转化率', value: kpis.totalInquiries > 0 ? `${((kpis.wonInquiries / kpis.totalInquiries) * 100).toFixed(1)}%` : '-', icon: <TrendingUp className="h-5 w-5" />, kpiBg: 'kpi-teal', colorClass: 'kpi-border-teal' },
            { label: '平均订单金额', value: avgOrderAmount > 0 ? formatCurrency(avgOrderAmount) : '-', icon: <DollarSign className="h-5 w-5" />, kpiBg: 'kpi-amber', colorClass: 'kpi-border-amber' },
            { label: '回款率', value: `${paymentRate}%`, icon: <Target className="h-5 w-5" />, kpiBg: 'kpi-rose', colorClass: 'kpi-border-rose' },
          ].map((kpi, i) => (
            <motion.div key={i} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
              <Card className={cn('p-4 crm-card-hover relative overflow-hidden', kpi.kpiBg, kpi.colorClass)}>
                <div className="kpi-pattern-overlay" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                    <div className="text-muted-foreground">{kpi.icon}</div>
                  </div>
                  <p className="text-xl font-bold crm-number">{kpi.value}</p>
                  <div className={cn(
                    'text-xs mt-1 font-medium',
                    'text-emerald-600 dark:text-emerald-400'
                  )}>
                    ↑ 较上月
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Enhanced KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="回款率"
          value={`${paymentCollectionRate}%`}
          icon={<CreditCard className="h-5 w-5" />}
          kpiBg="kpi-emerald"
          colorClass="kpi-border-emerald"
        />
        <MetricCard
          label="平均成交周期"
          value={`${avgDealCycle} 天`}
          icon={<Clock className="h-5 w-5" />}
          kpiBg="kpi-teal"
          colorClass="kpi-border-teal"
        />
        <MetricCard
          label="本月新增客户"
          value={`${thisMonthCustomers}`}
          icon={<UserPlus className="h-5 w-5" />}
          kpiBg="kpi-amber"
          colorClass="kpi-border-amber"
        />
        <MetricCard
          label="本月订单金额"
          value={formatCurrency(thisMonthOrderAmount)}
          icon={<ShoppingCart className="h-5 w-5" />}
          kpiBg="kpi-rose"
          colorClass="kpi-border-rose"
        />
      </div>

      {/* Charts Row 1: Monthly Revenue + Sales Performance Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Revenue Trend - AreaChart */}
        {analyticsLoading ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  月度营收趋势（近12个月）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => { const parts = v.split('-'); return `${parseInt(parts[1])}月` }}
                      />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), '营收']}
                        labelFormatter={(label) => { const parts = label.split('-'); return `${parts[0]}年${parseInt(parts[1])}月` }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#10b981"
                        fill="#10b981"
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Sales Performance - Horizontal Bar Chart */}
        {analyticsLoading ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-600" />
                  销售业绩排行
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={24}>
                        {salesPerformance.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? '#10b981' : i === 1 ? '#14b8a6' : i === 2 ? '#f59e0b' : '#06b6d4'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Charts Row 2: Sales Funnel + Monthly Trend Toggle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales Funnel */}
        {analyticsLoading ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-600" />
                  销售漏斗
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {funnelData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Monthly Trend with Toggle */}
        {analyticsLoading ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    {trendConfig[trendMode].label}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {(['inquiry', 'quotation', 'order'] as TrendMode[]).map((mode) => (
                      <Button
                        key={mode}
                        size="sm"
                        variant={trendMode === mode ? 'default' : 'ghost'}
                        className={cn(
                          'h-7 text-xs px-2.5',
                          trendMode === mode && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        )}
                        onClick={() => setTrendMode(mode)}
                      >
                        {trendConfig[mode].label.replace('趋势', '')}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendDataMap[trendMode]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={trendConfig[trendMode].color}
                        fill={trendConfig[trendMode].color}
                        fillOpacity={trendConfig[trendMode].fillOpacity}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Charts Row 3: Top Products + Customer Acquisition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 Products by Order Count */}
        {analyticsLoading ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-teal-600" />
                  产品销售Top10
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">暂无产品数据</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(value: number, name: string) => {
                            if (name === 'orderCount') return [value, '关联订单数']
                            if (name === 'quantity') return [formatNumber(value), '总数量']
                            return [value, name]
                          }}
                        />
                        <Bar dataKey="orderCount" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={18} name="关联订单数" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Customer Acquisition Channels - PieChart */}
        {analyticsLoading ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-amber-600" />
                  客户获取渠道
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={customerAcquisition} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" nameKey="name">
                        {customerAcquisition.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {customerAcquisition.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground flex-1">{item.name}</span>
                      <span className="font-medium crm-number">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Charts Row 4: Inquiry Source + Customer Level */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inquiry Source Distribution */}
        {analyticsLoading ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-amber-600" />
                  询盘来源分布
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" nameKey="name">
                        {sourceData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {sourceData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-muted-foreground flex-1">{item.name}</span>
                      <span className="font-medium crm-number">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Customer Level Distribution */}
        {analyticsLoading || levelData.length === 0 ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-600" />
                  客户级别分布
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={levelData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="count" nameKey="level">
                        {levelData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {levelData.map((item: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <Badge variant="outline" className="text-xs">{item.level as string}级</Badge>
                      <span className="font-medium ml-auto crm-number">{item.count as number}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Row 5: Region Distribution + Sales Ranking Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer Region Distribution */}
        {analyticsLoading || regionData.length === 0 ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  客户地区分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'count') return [value, '客户数']
                          return [value, name]
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                        {regionData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={REGION_COLORS[entry.name] || COLORS[i % COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {regionData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: REGION_COLORS[entry.name] || '#888' }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-medium crm-number">{entry.count}</span>
                      <span className="text-muted-foreground">({entry.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Sales Ranking Table */}
        {analyticsLoading ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  销售人员详情排行
                </CardTitle>
              </CardHeader>
              <CardContent>
                {salesRanking.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">暂无销售数据</div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-12">排名</TableHead>
                          <TableHead className="text-xs">姓名</TableHead>
                          <TableHead className="text-xs text-right">询盘数</TableHead>
                          <TableHead className="text-xs text-right">成交额</TableHead>
                          <TableHead className="text-xs text-right">转化率</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesRanking.map((person, i) => (
                          <TableRow key={i} className="crm-table-row">
                            <TableCell className="text-xs">
                              {i === 0 && <div className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-amber-500" /><span className="font-bold text-amber-600">1</span></div>}
                              {i === 1 && <div className="flex items-center gap-1"><Medal className="h-3.5 w-3.5 text-slate-400" /><span className="font-bold text-slate-500">2</span></div>}
                              {i === 2 && <div className="flex items-center gap-1"><Medal className="h-3.5 w-3.5 text-amber-700" /><span className="font-bold text-amber-700">3</span></div>}
                              {i > 2 && <span className="text-muted-foreground">{i + 1}</span>}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              <div className="flex items-center gap-1.5">
                                <div className={cn(
                                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                                  i === 0 && 'bg-amber-500',
                                  i === 1 && 'bg-slate-400',
                                  i === 2 && 'bg-amber-700',
                                  i > 2 && 'bg-muted text-muted-foreground'
                                )}>
                                  {person.name.charAt(0)}
                                </div>
                                {person.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-right crm-number">{person.inquiries}</TableCell>
                            <TableCell className="text-xs text-right crm-number font-medium text-emerald-600">{formatCurrency(person.revenue)}</TableCell>
                            <TableCell className="text-xs text-right crm-number">
                              <span className={cn(
                                person.conversionRate >= 40 ? 'text-emerald-600' : person.conversionRate >= 30 ? 'text-amber-600' : 'text-rose-600'
                              )}>
                                {person.conversionRate}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Row 6: Order Status + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Order Status Distribution */}
        {analyticsLoading ? (
          <ChartSkeleton />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-emerald-600" />
                  订单状态分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderStatusData.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">暂无订单数据</div>
                ) : (
                  <>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={orderStatusData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value: number) => [value, '订单数']}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                            {orderStatusData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {orderStatusData.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-1.5 text-xs">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-muted-foreground">{item.name}</span>
                          <span className="font-medium crm-number">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Top Customers */}
        {topCustomers.length > 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  Top 客户 (按订单金额)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCustomers} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <ChartSkeleton />
        )}
      </div>
    </div>
  )
}

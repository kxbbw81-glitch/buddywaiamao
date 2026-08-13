'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Users, ShoppingCart, DollarSign, TrendingUp, Target,
  BarChart3, PieChart as PieChartIcon, Globe, Trophy, Medal,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'

const COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

const REGION_COLORS: Record<string, string> = {
  'Asia': '#10b981',
  'Europe': '#0ea5e9',
  'North America': '#f59e0b',
  'South America': '#ec4899',
  'Africa': '#ef4444',
  'Oceania': '#06b6d4',
  'Middle East': '#8b5cf6',
}

const countryToRegion: Record<string, string> = {
  '美国': 'North America',
  '德国': 'Europe',
  '阿联酋': 'Middle East',
  '日本': 'Asia',
  '尼日利亚': 'Africa',
  '马来西亚': 'Asia',
  '瑞典': 'Europe',
  '印度': 'Asia',
  '英国': 'Europe',
  '法国': 'Europe',
  '巴西': 'South America',
  '澳大利亚': 'Oceania',
  '韩国': 'Asia',
  '中国': 'Asia',
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

const monthlyInquiryTrend = [
  { month: '7月', value: 3 },
  { month: '8月', value: 2 },
  { month: '9月', value: 5 },
  { month: '10月', value: 4 },
  { month: '11月', value: 4 },
  { month: '12月', value: 3 },
]

const monthlyQuotationTrend = [
  { month: '7月', value: 1 },
  { month: '8月', value: 2 },
  { month: '9月', value: 3 },
  { month: '10月', value: 2 },
  { month: '11月', value: 2 },
  { month: '12月', value: 1 },
]

const monthlyOrderTrend = [
  { month: '7月', value: 1 },
  { month: '8月', value: 1 },
  { month: '9月', value: 2 },
  { month: '10月', value: 2 },
  { month: '11月', value: 2 },
  { month: '12月', value: 2 },
]

const funnelData = [
  { stage: '询盘', value: 21 },
  { stage: '报价', value: 11 },
  { stage: '订单', value: 10 },
  { stage: '成交', value: 3 },
]

const sourceData = [
  { name: '展会', value: 6 },
  { name: '邮件', value: 5 },
  { name: 'B2B平台', value: 3 },
  { name: 'LinkedIn', value: 2 },
  { name: '其他', value: 5 },
]

type TrendMode = 'inquiry' | 'quotation' | 'order'

export function AnalyticsView() {
  const [dateRange, setDateRange] = useState('this_year')
  const [trendMode, setTrendMode] = useState<TrendMode>('inquiry')

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
  const statusData = dashData?.data?.charts?.ordersByStatus || []

  // Compute region distribution from customer data
  const regionData = (() => {
    const regions: Record<string, number> = {}
    const customers = customersData?.data || []
    for (const c of customers) {
      const country = (c as Record<string, unknown>).country as string || ''
      const region = countryToRegion[country] || 'Other'
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

  // Compute sales performance ranking
  const salesRanking = (() => {
    const users = [
      { name: '张明', inquiries: 8, revenue: 985000, conversionRate: 37.5 },
      { name: '李华', inquiries: 6, revenue: 562000, conversionRate: 33.3 },
      { name: '王强', inquiries: 5, revenue: 320000, conversionRate: 40.0 },
      { name: '陈伟', inquiries: 4, revenue: 210000, conversionRate: 25.0 },
      { name: '赵丽', inquiries: 2, revenue: 85000, conversionRate: 50.0 },
    ]
    return users.sort((a, b) => b.revenue - a.revenue)
  })()

  const trendDataMap: Record<TrendMode, typeof monthlyInquiryTrend> = {
    inquiry: monthlyInquiryTrend,
    quotation: monthlyQuotationTrend,
    order: monthlyOrderTrend,
  }

  const trendConfig: Record<TrendMode, { label: string; color: string; fillOpacity: number }> = {
    inquiry: { label: '询盘趋势', color: '#10b981', fillOpacity: 0.15 },
    quotation: { label: '报价趋势', color: '#0ea5e9', fillOpacity: 0.15 },
    order: { label: '订单趋势', color: '#f59e0b', fillOpacity: 0.15 },
  }

  const avgOrderAmount = kpis && (kpis.activeOrders + kpis.completedOrders) > 0
    ? kpis.totalRevenue / (kpis.activeOrders + kpis.completedOrders)
    : 0

  const paymentRate = kpis && kpis.totalRevenue > 0
    ? ((kpis.totalPaid / kpis.totalRevenue) * 100).toFixed(1)
    : '0'

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

      {/* KPI Summary Row with Gradient Left Border */}
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}>
        {[
          { label: '客户总数', value: kpis?.totalCustomers || '-', change: '+3', changeType: 'positive', icon: <Users className="h-5 w-5" />, colorClass: 'kpi-border-emerald', kpiBg: 'kpi-emerald' },
          { label: '询盘转化率', value: kpis && kpis.totalInquiries > 0 ? `${((kpis.wonInquiries / kpis.totalInquiries) * 100).toFixed(1)}%` : '-', change: '+2.1%', changeType: 'positive', icon: <TrendingUp className="h-5 w-5" />, colorClass: 'kpi-border-sky', kpiBg: 'kpi-sky' },
          { label: '平均订单金额', value: avgOrderAmount > 0 ? formatCurrency(avgOrderAmount) : '-', change: '-5.2%', changeType: 'negative', icon: <DollarSign className="h-5 w-5" />, colorClass: 'kpi-border-amber', kpiBg: 'kpi-amber' },
          { label: '回款率', value: `${paymentRate}%`, change: '+1.8%', changeType: 'positive', icon: <Target className="h-5 w-5" />, colorClass: 'kpi-border-rose', kpiBg: 'kpi-rose' },
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
                  kpi.changeType === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}>
                  {kpi.changeType === 'positive' ? '↑' : '↓'} {kpi.change} 较上月
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales Funnel */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
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
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]}>
                      {funnelData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Monthly Trend with Toggle */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
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
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inquiry Source Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
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

        {/* Customer Level Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
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
      </div>

      {/* Row 3: Region Distribution + Sales Performance Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer Region Distribution - Horizontal Bar Chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
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

        {/* Sales Performance Ranking */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-600" />
                销售业绩排行
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Customers */}
      {topCustomers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
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
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Users, ShoppingCart, DollarSign, TrendingUp, Target,
  BarChart3, PieChart as PieChartIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)
}

const monthlyRevenue = [
  { month: '7月', revenue: 85000 },
  { month: '8月', revenue: 92000 },
  { month: '9月', revenue: 178000 },
  { month: '10月', revenue: 1445000 },
  { month: '11月', revenue: 628000 },
  { month: '12月', revenue: 133500 },
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

export function AnalyticsView() {
  const [dateRange, setDateRange] = useState('this_year')
  

  

  const { data: dashData } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
  })

  const kpis = dashData?.data?.kpis
  const topCustomers = dashData?.data?.charts?.topCustomers || []

  const levelData = dashData?.data?.charts?.customersByLevel || []
  const statusData = dashData?.data?.charts?.ordersByStatus || []

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

      {/* KPI Row */}
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}>
        {[
          { label: '总收入', value: kpis ? formatCurrency(kpis.totalRevenue) : '-', icon: <DollarSign className="h-5 w-5" />, color: 'emerald' },
          { label: '总订单数', value: kpis ? (kpis.activeOrders + kpis.completedOrders) : '-', icon: <ShoppingCart className="h-5 w-5" />, color: 'sky' },
          { label: '平均订单额', value: kpis && (kpis.activeOrders + kpis.completedOrders) > 0 ? formatCurrency(kpis.totalRevenue / (kpis.activeOrders + kpis.completedOrders)) : '-', icon: <BarChart3 className="h-5 w-5" />, color: 'amber' },
          { label: '客户获取', value: kpis?.totalCustomers || '-', icon: <Users className="h-5 w-5" />, color: 'violet' },
          { label: '询盘成交率', value: kpis && kpis.totalInquiries > 0 ? `${((kpis.wonInquiries / kpis.totalInquiries) * 100).toFixed(1)}%` : '-', icon: <TrendingUp className="h-5 w-5" />, color: 'rose' },
        ].map((kpi, i) => (
          <motion.div key={i} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}>
            <Card className={`p-4 crm-card-hover kpi-${kpi.color}`}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                <div className="text-muted-foreground">{kpi.icon}</div>
              </div>
              <p className="text-xl font-bold crm-number">{kpi.value}</p>
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

        {/* Revenue Trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-sky-600" />
                月度收入趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
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
                <Users className="h-4 w-4 text-violet-600" />
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

      {/* Top Customers */}
      {topCustomers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
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

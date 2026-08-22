'use client'

import { useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, Users, Target, ShoppingCart, TrendingUp,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Activity, Clock, Zap,
  Globe, BarChart3, Award, AlertCircle, CheckCircle2, X,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  RadialBarChart, RadialBar,
} from 'recharts'
import { cn, formatCurrency, getCountryFlag } from '@/lib/utils'
import { useCRMStore } from '@/store/use-crm-store'

// ===== Color Palette =====
const CYAN = '#06b6d4'
const EMERALD = '#10b981'
const AMBER = '#f59e0b'
const ROSE = '#ef4444'
const VIOLET = '#8b5cf6'
const SKY = '#0ea5e9'
const LIME = '#84cc16'
const PINK = '#ec4899'

const PIE_COLORS = [CYAN, EMERALD, AMBER, ROSE, VIOLET, SKY, LIME, PINK, '#f97316', '#14b8a6']
const ORDER_STATUS_COLORS: Record<string, string> = {
  '待确认': AMBER, '已确认': SKY, '生产中': CYAN,
  '待发货': VIOLET, '已发货': EMERALD, '已完成': '#22c55e', '已取消': '#6b7280',
}
const LEVEL_COLORS: Record<string, string> = { 'A级': '#22c55e', 'B级': CYAN, 'C级': AMBER, 'D级': '#6b7280' }

// ===== Data Types =====
interface DataScreenData {
  kpis: {
    totalCustomers: number
    totalInquiries: number
    wonInquiries: number
    lostInquiries: number
    totalOrders: number
    completedOrders: number
    totalRevenue: number
    totalPaid: number
    conversionRate: number
    collectionRate: number
    thisMonthInquiries: number
    thisMonthOrders: number
    thisMonthRevenue: number
    thisMonthCustomers: number
  }
  monthlyRevenue: Array<{ month: string; revenue: number; orderCount: number }>
  funnelData: Array<{ stage: string; count: number; color: string }>
  regionData: Array<{ country: string; revenue: number }>
  customerCountryData: Array<{ country: string; count: number }>
  salesTeamPerformance: Array<{
    name: string; role: string; inquiryCount: number; wonCount: number
    orderCount: number; revenue: number; conversionRate: number; activePipeline: number
  }>
  sourceData: Array<{ name: string; value: number }>
  orderStatusData: Array<{ name: string; value: number }>
  customerLevelData: Array<{ level: string; count: number }>
  topCustomers: Array<{ name: string; country: string; revenue: number }>
  riskAlerts: Array<{ type: string; level: string; message: string }>
  recentActivities: Array<{
    id: string; type: string; subject: string; content: string | null
    entityType: string | null; entityId: string | null
    userId: string | null; readAt: Date | null; createdAt: string
    user: { name: string; primaryRole: string } | null
  }>
  paymentStatusData: Array<{ name: string; count: number; amount: number }>
  inquiryTrend: Array<{ month: string; value: number }>
}

// ===== Panel Wrapper =====
function Panel({ children, className, title, icon }: {
  children: React.ReactNode
  className?: string
  title?: string
  icon?: React.ReactNode
}) {
  return (
    <div className={cn('ds-panel rounded-xl p-4 flex flex-col', className)}>
      {title && (
        <div className="flex items-center gap-2 mb-3 shrink-0">
          {icon && <span className="text-cyan-400 text-sm">{icon}</span>}
          <h3 className="ds-panel-title text-sm font-semibold tracking-wide">{title}</h3>
          <div className="flex-1 h-px ds-border-gradient" />
        </div>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  )
}

// ===== KPI Card =====
function ScreenKPI({ label, value, subText, icon, color = CYAN, trend }: {
  label: string
  value: string
  subText?: string
  icon: React.ReactNode
  color?: string
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="ds-kpi-card rounded-xl p-3 lg:p-4 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</span>
        <div className="p-1.5 rounded-lg" style={{ background: `${color}15` }}>
          <span style={{ color }} className="text-sm">{icon}</span>
        </div>
      </div>
      <div className="text-xl lg:text-2xl font-bold text-white ds-number tracking-tight" style={{ textShadow: `0 0 20px ${color}40` }}>
        {value}
      </div>
      {subText && (
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-emerald-400" />}
          {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-rose-400" />}
          <span className={cn('text-[11px]',
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-gray-500'
          )}>{subText}</span>
        </div>
      )}
    </div>
  )
}

// ===== Funnel Bar =====
function FunnelBar({ stage, count, color, maxCount }: {
  stage: string; count: number; color: string; maxCount: number
}) {
  const width = maxCount > 0 ? Math.max(8, (count / maxCount) * 100) : 8
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs text-gray-400 w-14 text-right shrink-0">{stage}</span>
      <div className="flex-1 h-6 bg-white/5 rounded relative overflow-hidden">
        <motion.div
          className="h-full rounded flex items-center px-2"
          style={{ background: `linear-gradient(90deg, ${color}90, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <span className="text-xs font-bold text-white drop-shadow-sm">{count}</span>
        </motion.div>
      </div>
    </div>
  )
}

// ===== Sales Team Row =====
function TeamRow({ member, rank }: { member: DataScreenData['salesTeamPerformance'][0]; rank: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className={cn(
        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
        rank === 1 ? 'bg-amber-500/20 text-amber-400' :
        rank === 2 ? 'bg-gray-400/20 text-gray-300' :
        rank === 3 ? 'bg-orange-600/20 text-orange-400' :
        'bg-white/5 text-gray-500'
      )}>
        {rank}
      </div>
      <span className="text-xs text-gray-300 w-16 truncate shrink-0">{member.name}</span>
      <div className="flex-1 h-4 bg-white/5 rounded relative overflow-hidden">
        <motion.div
          className="h-full rounded"
          style={{ background: 'linear-gradient(90deg, #06b6d480, #06b6d4)' }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (member.revenue / 200000) * 100)}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs text-cyan-400 font-mono w-20 text-right shrink-0">
        ${member.revenue >= 1000 ? `${(member.revenue / 1000).toFixed(0)}K` : member.revenue.toLocaleString()}
      </span>
    </div>
  )
}

// ===== Activity Item =====
function ActivityItem({ activity }: { activity: DataScreenData['recentActivities'][0] }) {
  const typeIcons: Record<string, React.ReactNode> = {
    follow_up: <Target className="h-3 w-3" />,
    email: <Globe className="h-3 w-3" />,
    call: <Activity className="h-3 w-3" />,
    meeting: <Users className="h-3 w-3" />,
    note: <BarChart3 className="h-3 w-3" />,
    system: <Zap className="h-3 w-3" />,
  }
  const typeLabels: Record<string, string> = {
    follow_up: '跟进', email: '邮件', call: '电话', meeting: '会议', note: '备注', system: '系统',
  }
  const timeStr = new Date(activity.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = new Date(activity.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
      <div className="mt-0.5 p-1 rounded bg-white/5 text-cyan-400 shrink-0">
        {typeIcons[activity.type] || <Activity className="h-3 w-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-300 truncate">
          <span className="text-cyan-400 font-medium">{activity.user?.name || '系统'}</span>
          {' '}{typeLabels[activity.type] || activity.type}
          {activity.entityType && activity.subject ? ` ${activity.subject}` : ''}
        </p>
        <span className="text-[10px] text-gray-500">{dateStr} {timeStr}</span>
      </div>
    </div>
  )
}

// ===== Custom Tooltip for Charts =====
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900/95 border border-cyan-500/20 rounded-lg px-3 py-2 shadow-lg shadow-cyan-500/5">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((item: any, i: number) => (
        <p key={i} className="text-xs font-mono" style={{ color: item.color || CYAN }}>
          {item.name}: {typeof item.value === 'number' && item.value > 999
            ? `$${(item.value / 1000).toFixed(1)}K`
            : item.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

// ===== Main Component =====
export function DataScreenView() {
  const { setCurrentModule } = useCRMStore()
  const [currentTime, setCurrentTime] = useState(new Date())

  // ESC key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCurrentModule('workbench')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCurrentModule])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['data-screen'],
    queryFn: () => fetch('/api/data-screen').then(r => r.json()).then(d => d.data as DataScreenData),
    staleTime: 60000,
    refetchInterval: 60000,
  })

  const refreshData = useCallback(() => { refetch() }, [refetch])

  useEffect(() => {
    const interval = setInterval(refreshData, 60000)
    return () => clearInterval(interval)
  }, [refreshData])

  if (isLoading || !data) {
    return <DataScreenSkeleton />
  }

  const { kpis, monthlyRevenue, funnelData, regionData, salesTeamPerformance,
    sourceData, orderStatusData, customerLevelData, topCustomers, riskAlerts,
    recentActivities, inquiryTrend } = data

  const maxFunnel = Math.max(...funnelData.map(f => f.count), 1)
  const totalSourceCount = sourceData.reduce((s, d) => s + d.value, 0)

  const dateStr = currentTime.toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long',
  })
  const timeStr = currentTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Conversion rate radial data
  const conversionRadial = [
    { name: '转化率', value: kpis.conversionRate, fill: kpis.conversionRate >= 30 ? EMERALD : kpis.conversionRate >= 15 ? AMBER : ROSE },
  ]

  return (
    <div className="ds-container fixed inset-0 z-50 overflow-auto">
      {/* ===== Header ===== */}
      <header className="ds-header flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">
                NexFab AI CRM
              </h1>
              <p className="text-[10px] text-cyan-400/60 tracking-widest uppercase">Data Command Center</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-medium">实时同步</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-white font-medium tracking-wider">{timeStr}</div>
            <div className="text-[10px] text-gray-400">{dateStr}</div>
          </div>
          <button
            onClick={() => setCurrentModule('workbench')}
            className="ml-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            title="退出大屏"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-white transition-colors" />
          </button>
        </div>
      </header>

      {/* ===== KPI Row ===== */}
      <div className="px-4 lg:px-6 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
          <ScreenKPI
            label="总营收" value={formatCurrency(kpis.totalRevenue)}
            subText={`本月 ${formatCurrency(kpis.thisMonthRevenue)}`}
            icon={<DollarSign className="h-4 w-4" />} color={CYAN} trend="up"
          />
          <ScreenKPI
            label="活跃客户" value={kpis.totalCustomers.toLocaleString()}
            subText={`本月新增 ${kpis.thisMonthCustomers}`}
            icon={<Users className="h-4 w-4" />} color={EMERALD} trend="up"
          />
          <ScreenKPI
            label="询盘总量" value={kpis.totalInquiries.toLocaleString()}
            subText={`本月 ${kpis.thisMonthInquiries}`}
            icon={<Target className="h-4 w-4" />} color={AMBER}
          />
          <ScreenKPI
            label="订单总量" value={kpis.totalOrders.toLocaleString()}
            subText={`本月 ${kpis.thisMonthOrders}`}
            icon={<ShoppingCart className="h-4 w-4" />} color={VIOLET} trend="up"
          />
          <ScreenKPI
            label="成交转化" value={`${kpis.conversionRate}%`}
            subText={`已成交 ${kpis.wonInquiries} / 流失 ${kpis.lostInquiries}`}
            icon={<TrendingUp className="h-4 w-4" />} color={LIME}
          />
          <ScreenKPI
            label="收款率" value={`${kpis.collectionRate}%`}
            subText={`已收 ${formatCurrency(kpis.totalPaid)}`}
            icon={<CheckCircle2 className="h-4 w-4" />} color={PINK}
          />
          <ScreenKPI
            label="完成订单" value={kpis.completedOrders.toLocaleString()}
            subText={`进行中 ${kpis.totalOrders - kpis.completedOrders}`}
            icon={<Award className="h-4 w-4" />} color={SKY}
          />
        </div>
      </div>

      {/* ===== Main Grid ===== */}
      <div className="px-4 lg:px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ===== Left Column ===== */}
          <div className="lg:col-span-3 flex flex-col gap-4">

            {/* Sales Funnel */}
            <Panel title="销售漏斗" icon={<TrendingUp className="h-4 w-4" />}>
              <div className="space-y-1">
                {funnelData.map((item) => (
                  <FunnelBar key={item.stage} stage={item.stage} count={item.count} color={item.color} maxCount={maxFunnel} />
                ))}
              </div>
            </Panel>

            {/* Inquiry Sources */}
            <Panel title="询盘来源" icon={<Globe className="h-4 w-4" />}>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%" cy="50%"
                      innerRadius={35} outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {sourceData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
                {sourceData.slice(0, 6).map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[10px] text-gray-400 truncate">{item.name}</span>
                    <span className="text-[10px] text-gray-300 font-mono ml-auto">{totalSourceCount > 0 ? Math.round((item.value / totalSourceCount) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Customer Level */}
            <Panel title="客户等级分布" icon={<Award className="h-4 w-4" />}>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={customerLevelData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="level" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {customerLevelData.map((item, i) => (
                        <Cell key={i} fill={LEVEL_COLORS[item.level] || '#6b7280'} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* ===== Center Column ===== */}
          <div className="lg:col-span-6 flex flex-col gap-4">

            {/* Revenue Trend - Main Chart */}
            <Panel title="营收趋势 (近12个月)" icon={<DollarSign className="h-4 w-4" />} className="lg:col-span-6">
              <div className="h-64 lg:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dsRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CYAN} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={CYAN} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="dsOrderGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={EMERALD} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={EMERALD} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone" dataKey="revenue" name="营收"
                      stroke={CYAN} strokeWidth={2}
                      fill="url(#dsRevenueGradient)"
                      animationDuration={1500}
                    />
                    <Area
                      type="monotone" dataKey="orderCount" name="订单数"
                      stroke={EMERALD} strokeWidth={1.5} strokeDasharray="4 2"
                      fill="url(#dsOrderGradient)"
                      yAxisId={0}
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            {/* Bottom Row: Country Revenue + Order Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Country Revenue */}
              <Panel title="区域营收 TOP10" icon={<Globe className="h-4 w-4" />}>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionData} margin={{ left: 0, right: 10 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                      />
                      <YAxis type="category" dataKey="country" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="revenue" name="营收" radius={[0, 4, 4, 0]}>
                        {regionData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.75} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              {/* Order Status */}
              <Panel title="订单状态分布" icon={<ShoppingCart className="h-4 w-4" />}>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        cx="50%" cy="45%"
                        innerRadius={35} outerRadius={65}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {orderStatusData.map((item) => (
                          <Cell key={item.name} fill={ORDER_STATUS_COLORS[item.name] || '#6b7280'} fillOpacity={0.85} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
                  {orderStatusData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ORDER_STATUS_COLORS[item.name] || '#6b7280' }} />
                      <span className="text-[10px] text-gray-400">{item.name}</span>
                      <span className="text-[10px] text-gray-300 font-mono ml-auto">{item.value}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          {/* ===== Right Column ===== */}
          <div className="lg:col-span-3 flex flex-col gap-4">

            {/* Conversion Rate Ring */}
            <Panel title="核心指标" icon={<Target className="h-4 w-4" />}>
              <div className="flex items-center justify-center gap-6">
                <div className="h-32 w-32 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%"
                      startAngle={90} endAngle={-270}
                      data={conversionRadial}
                    >
                      <RadialBar
                        background={{ fill: 'rgba(255,255,255,0.05)' }}
                        dataKey="value"
                        cornerRadius={6}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute text-center">
                    <div className="text-2xl font-bold text-white ds-number">{kpis.conversionRate}%</div>
                    <div className="text-[10px] text-gray-500">询盘转化率</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-gray-500 mb-0.5">收款率</div>
                    <div className="text-lg font-bold ds-number" style={{ color: kpis.collectionRate >= 80 ? EMERALD : AMBER }}>
                      {kpis.collectionRate}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 mb-0.5">成交/流失</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-400">{kpis.wonInquiries}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-sm font-bold text-rose-400">{kpis.lostInquiries}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 mb-0.5">完成/进行</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-cyan-400">{kpis.completedOrders}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-sm font-bold text-gray-300">{kpis.totalOrders}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            {/* Sales Team Ranking */}
            <Panel title="团队业绩排行" icon={<Award className="h-4 w-4" />}>
              <div className="space-y-0">
                {salesTeamPerformance.slice(0, 6).map((member, i) => (
                  <TeamRow key={member.name} member={member} rank={i + 1} />
                ))}
              </div>
            </Panel>

            {/* Top Customers */}
            <Panel title="客户营收 TOP5" icon={<TrendingUp className="h-4 w-4" />}>
              <div className="space-y-2 max-h-40 overflow-y-auto ds-scroll">
                {topCustomers.slice(0, 5).map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className={cn(
                      'w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0',
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i === 1 ? 'bg-gray-400/20 text-gray-300' :
                      i === 2 ? 'bg-orange-600/20 text-orange-400' :
                      'bg-white/5 text-gray-500'
                    )}>{i + 1}</span>
                    <span className="text-[10px] text-gray-400">{getCountryFlag(c.country)}</span>
                    <span className="text-xs text-gray-300 flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-cyan-400 font-mono shrink-0">${c.revenue >= 1000 ? `${(c.revenue / 1000).toFixed(1)}K` : c.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Risk Alerts */}
            <Panel title="风险预警" icon={<AlertTriangle className="h-4 w-4" />}>
              <div className="space-y-1.5 max-h-28 overflow-y-auto ds-scroll">
                <AnimatePresence>
                  {riskAlerts.length === 0 ? (
                    <div className="flex items-center justify-center py-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-2" />
                      <span className="text-xs text-emerald-400">暂无风险</span>
                    </div>
                  ) : (
                    riskAlerts.map((alert, i) => (
                      <motion.div
                        key={`${alert.type}-${i}`}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className={cn(
                          'flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs',
                          alert.level === 'danger' ? 'bg-rose-500/10 border border-rose-500/20' :
                          alert.level === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' :
                          'bg-cyan-500/10 border border-cyan-500/20'
                        )}
                      >
                        <AlertCircle className={cn(
                          'h-3 w-3 mt-0.5 shrink-0',
                          alert.level === 'danger' ? 'text-rose-400' :
                          alert.level === 'warning' ? 'text-amber-400' : 'text-cyan-400'
                        )} />
                        <span className={cn(
                          'text-[11px] leading-relaxed',
                          alert.level === 'danger' ? 'text-rose-300' :
                          alert.level === 'warning' ? 'text-amber-300' : 'text-cyan-300'
                        )}>{alert.message}</span>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </Panel>
          </div>
        </div>

        {/* ===== Bottom Row: Activity Feed + Inquiry Trend ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
          {/* Inquiry Trend Sparkline */}
          <div className="lg:col-span-5">
            <Panel title="询盘趋势 (近6月)" icon={<BarChart3 className="h-4 w-4" />}>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inquiryTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="询盘数" radius={[4, 4, 0, 0]}>
                      {inquiryTrend.map((_, i) => (
                        <Cell key={i} fill={i === inquiryTrend.length - 1 ? CYAN : `${CYAN}60`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Recent Activity Feed */}
          <div className="lg:col-span-7">
            <Panel title="实时动态" icon={<Clock className="h-4 w-4" />}>
              <div className="max-h-32 overflow-y-auto ds-scroll">
                {recentActivities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== Loading Skeleton =====
function DataScreenSkeleton() {
  return (
    <div className="ds-container fixed inset-0 z-50 overflow-auto">
      <header className="ds-header flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-700 animate-pulse" />
          <div className="space-y-1">
            <div className="h-4 w-32 bg-gray-700 rounded animate-pulse" />
            <div className="h-2 w-24 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
      </header>
      <div className="px-4 lg:px-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <div className="h-52 bg-gray-800/50 rounded-xl animate-pulse" />
            <div className="h-56 bg-gray-800/50 rounded-xl animate-pulse" />
            <div className="h-48 bg-gray-800/50 rounded-xl animate-pulse" />
          </div>
          <div className="lg:col-span-6 space-y-4">
            <div className="h-80 bg-gray-800/50 rounded-xl animate-pulse" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-56 bg-gray-800/50 rounded-xl animate-pulse" />
              <div className="h-56 bg-gray-800/50 rounded-xl animate-pulse" />
            </div>
          </div>
          <div className="lg:col-span-3 space-y-4">
            <div className="h-40 bg-gray-800/50 rounded-xl animate-pulse" />
            <div className="h-52 bg-gray-800/50 rounded-xl animate-pulse" />
            <div className="h-44 bg-gray-800/50 rounded-xl animate-pulse" />
            <div className="h-32 bg-gray-800/50 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

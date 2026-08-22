'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Globe2, Users, MapPin, DollarSign, TrendingUp,
  ChevronRight, ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { cn, formatCurrency, formatNumber, getCountryFlag } from '@/lib/utils'
import { useCRMStore } from '@/store/use-crm-store'

// ============ Constants ============

const COUNTRY_REGION_MAP: Record<string, string> = {
  '美国': '北美', '加拿大': '北美', '墨西哥': '北美',
  '德国': '欧洲', '英国': '欧洲', '法国': '欧洲', '瑞典': '欧洲', '意大利': '欧洲', '西班牙': '欧洲', '荷兰': '欧洲',
  '日本': '东亚', '韩国': '东亚', '中国': '东亚',
  '泰国': '东南亚', '越南': '东南亚', '马来西亚': '东南亚', '印度尼西亚': '东南亚', '印尼': '东南亚', '菲律宾': '东南亚',
  '印度': '南亚',
  '阿联酋': '中东', '沙特阿拉伯': '中东', '沙特': '中东',
  '澳大利亚': '大洋洲', '新西兰': '大洋洲',
  '巴西': '南美', '阿根廷': '南美', '智利': '南美',
  '尼日利亚': '非洲', '南非': '非洲', '埃及': '非洲',
}

const REGION_ORDER = ['东亚', '东南亚', '南亚', '欧洲', '北美', '南美', '中东', '非洲', '大洋洲']

const REGION_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  '东亚': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', accent: '#10b981' },
  '东南亚': { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', text: 'text-teal-700 dark:text-teal-300', accent: '#14b8a6' },
  '南亚': { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', accent: '#f59e0b' },
  '欧洲': { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', text: 'text-sky-700 dark:text-sky-300', accent: '#0ea5e9' },
  '北美': { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-300', accent: '#8b5cf6' },
  '南美': { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300', accent: '#f43f5e' },
  '中东': { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', accent: '#f97316' },
  '非洲': { bg: 'bg-stone-100 dark:bg-stone-900/30', border: 'border-stone-300 dark:border-stone-700', text: 'text-stone-700 dark:text-stone-300', accent: '#78716c' },
  '大洋洲': { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-700 dark:text-cyan-300', accent: '#06b6d4' },
}

const LEVEL_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#14b8a6',
  C: '#f59e0b',
  D: '#ef4444',
}

const LEVEL_LABELS: Record<string, string> = {
  A: 'A级',
  B: 'B级',
  C: 'C级',
  D: 'D级',
}

// ============ Types ============

interface MapCustomer {
  id: string
  companyName: string
  customerLevel: string
}

interface CountryData {
  country: string
  code: string
  count: number
  revenue: number
  customers: MapCustomer[]
}

interface RegionData {
  region: string
  count: number
  revenue: number
}

interface MapApiResponse {
  countryDistribution: CountryData[]
  regionSummary: RegionData[]
  totalCustomers: number
  totalRevenue: number
  countryCount: number
}

// ============ Animation ============

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// ============ Components ============

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold crm-number tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={cn('p-2 rounded-lg', color)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
    </Card>
  )
}

function RegionCard({ region, count, revenue, customers, maxCount, onNavigate }: {
  region: string
  count: number
  revenue: number
  customers: MapCustomer[]
  maxCount: number
  onNavigate: (country: string) => void
}) {
  const colors = REGION_COLORS[region]
  const [hovered, setHovered] = useState(false)
  const intensity = Math.max(0.3, Math.min(1, count / Math.max(maxCount, 1)))

  // Dynamic grid span based on customer count
  const isLarge = count >= maxCount * 0.5
  const isMedium = count >= maxCount * 0.25 && !isLarge

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'relative rounded-xl border p-4 transition-all duration-300 cursor-pointer group',
        colors.bg, colors.border,
        isLarge ? 'col-span-2 row-span-2' : isMedium ? 'col-span-2' : 'col-span-1',
        'hover:shadow-md hover:scale-[1.01]'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Background intensity indicator */}
      <div
        className="absolute inset-0 rounded-xl opacity-20 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at center, ${colors.accent}44 0%, transparent 70%)`,
          opacity: intensity * 0.4,
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-bold', colors.text)}>{region}</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-semibold">
              {count} 客户
            </Badge>
          </div>
          <ArrowUpRight className={cn('h-4 w-4 transition-transform duration-200',
            colors.text, hovered && 'translate-x-0.5 -translate-y-0.5'
          )} />
        </div>

        {/* Revenue */}
        <p className={cn('text-lg font-bold crm-number', colors.text)}>
          {formatCurrency(revenue)}
        </p>

        {/* Top customers (show on hover or large card) */}
        {(hovered || isLarge) && customers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 space-y-1.5"
          >
            <div className="h-px bg-border/50" />
            {customers.slice(0, isLarge ? 5 : 3).map((c) => (
              <button
                key={c.id}
                onClick={(e) => { e.stopPropagation(); onNavigate(c.companyName) }}
                className="flex items-center justify-between w-full text-left hover:bg-black/5 dark:hover:bg-white/5 rounded px-1.5 py-1 transition-colors"
              >
                <span className="text-xs text-muted-foreground truncate max-w-[60%]">
                  {c.companyName}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1.5 font-semibold shrink-0"
                  style={{ borderColor: LEVEL_COLORS[c.customerLevel], color: LEVEL_COLORS[c.customerLevel] }}
                >
                  {c.customerLevel}级
                </Badge>
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

function CountryRankItem({ data, maxCount, totalRevenue, onNavigate, index }: {
  data: CountryData
  maxCount: number
  totalRevenue: number
  onNavigate: (country: string) => void
  index: number
}) {
  const flag = getCountryFlag(data.country)
  const percentage = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
  const barWidth = maxCount > 0 ? (data.count / maxCount) * 100 : 0

  return (
    <motion.div
      variants={itemVariants}
      className="group cursor-pointer"
      onClick={() => onNavigate(data.country)}
    >
      <div className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
        <span className="text-sm text-muted-foreground w-5 text-right font-medium">{index + 1}</span>
        <span className="text-lg">{flag || '🌍'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium truncate">{data.country}</span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-semibold">
                {data.count} 客户
              </Badge>
              <span className="text-xs text-muted-foreground crm-number w-16 text-right">
                {formatCurrency(data.revenue)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.6, delay: index * 0.05 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-10 text-right crm-number">
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </motion.div>
  )
}

// Custom Recharts tooltip
function ChartTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-md">
      <p className="text-xs font-medium mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.dataKey === 'revenue' ? '营收' : p.dataKey}:</span>
          <span className="font-semibold crm-number">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ============ Main View ============

export function CustomerMapView() {
  const { setFilters, setCurrentNavigation } = useCRMStore()

  const { data, isLoading } = useQuery<{ success: boolean; data: MapApiResponse }>({
    queryKey: ['customer-map-data'],
    queryFn: () => fetch('/api/customers/map-data').then((r) => r.json()),
    staleTime: 60000,
  })

  const mapData = data?.data

  // Build region map with enriched customer data
  const regionMap = useMemo(() => {
    if (!mapData) return new Map<string, { region: string; count: number; revenue: number; customers: MapCustomer[] }>()

    const m = new Map<string, { region: string; count: number; revenue: number; customers: MapCustomer[] }>()
    for (const cd of mapData.countryDistribution) {
      const region = COUNTRY_REGION_MAP[cd.country] || '其他'
      const existing = m.get(region)
      if (existing) {
        existing.count += cd.count
        existing.revenue += cd.revenue
        existing.customers.push(...cd.customers)
      } else {
        m.set(region, { region, count: cd.count, revenue: cd.revenue, customers: [...cd.customers] })
      }
    }
    return m
  }, [mapData])

  // Sort regions by predefined order
  const sortedRegions = useMemo(() => {
    return REGION_ORDER
      .filter((r) => regionMap.has(r))
      .map((r) => regionMap.get(r)!)
      .sort((a, b) => b.count - a.count)
  }, [regionMap])

  const maxRegionCount = useMemo(() => {
    return Math.max(...sortedRegions.map((r) => r.count), 1)
  }, [sortedRegions])

  // Chart data for region revenue
  const regionChartData = useMemo(() => {
    return sortedRegions.map((r) => ({
      name: r.region,
      revenue: r.revenue,
      count: r.count,
    }))
  }, [sortedRegions])

  // Stacked bar chart data: customer level distribution by region
  const levelByRegionData = useMemo(() => {
    if (!mapData) return []
    const result: Array<{ region: string; A: number; B: number; C: number; D: number }> = []
    for (const [region, data] of regionMap) {
      const levels: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
      for (const c of data.customers) {
        if (c.customerLevel in levels) {
          levels[c.customerLevel] += 1
        }
      }
      result.push({ region, A: levels.A, B: levels.B, C: levels.C, D: levels.D })
    }
    return result.sort((a, b) => (b.A + b.B + b.C + b.D) - (a.A + a.B + a.C + a.D))
  }, [mapData, regionMap])

  const handleNavigateToCustomers = (country: string) => {
    setFilters({ customerStatus: 'active', customerCountry: country })
    setCurrentNavigation('customer', 'customer-records')
  }

  const avgRevenue = mapData && mapData.totalCustomers > 0
    ? mapData.totalRevenue / mapData.totalCustomers
    : 0

  // Loading skeleton
  if (isLoading || !mapData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
          <Globe2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">客户地图</h1>
          <p className="text-sm text-muted-foreground">全球客户分布与业务覆盖概览</p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label="总客户数"
          value={formatNumber(mapData.totalCustomers)}
          sub="活跃客户"
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
        />
        <KPICard
          icon={MapPin}
          label="覆盖国家"
          value={String(mapData.countryCount)}
          sub={`分布在 ${regionMap.size} 个区域`}
          color="bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400"
        />
        <KPICard
          icon={DollarSign}
          label="总营收"
          value={formatCurrency(mapData.totalRevenue)}
          sub="关联订单金额"
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
        />
        <KPICard
          icon={TrendingUp}
          label="平均单客户价值"
          value={formatCurrency(avgRevenue)}
          sub="总营收 / 客户数"
          color="bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
        />
      </motion.div>

      {/* Main Content: Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Region Card Grid (2/3) */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-emerald-600" />
                区域分布总览
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedRegions.length > 0 ? (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-3 gap-3"
                >
                  {sortedRegions.map((r) => (
                    <RegionCard
                      key={r.region}
                      region={r.region}
                      count={r.count}
                      revenue={r.revenue}
                      customers={r.customers}
                      maxCount={maxRegionCount}
                      onNavigate={handleNavigateToCustomers}
                    />
                  ))}
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Globe2 className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">暂无客户地理分布数据</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right: Country Ranking + Chart (1/3) */}
        <motion.div variants={itemVariants} className="space-y-6">
          {/* Country Ranking */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-teal-600" />
                  国家排行
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-emerald-600 hover:text-emerald-700 h-7"
                  onClick={() => setCurrentNavigation('customer', 'customer-records')}
                >
                  查看全部
                  <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto custom-scrollbar px-2">
                <motion.div variants={containerVariants} initial="hidden" animate="visible">
                  {mapData.countryDistribution.slice(0, 10).map((cd, i) => (
                    <CountryRankItem
                      key={cd.country}
                      data={cd}
                      maxCount={mapData.countryDistribution[0]?.count || 1}
                      totalRevenue={mapData.totalRevenue}
                      onNavigate={handleNavigateToCustomers}
                      index={i}
                    />
                  ))}
                </motion.div>
              </div>
            </CardContent>
          </Card>

          {/* Region Revenue Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-600" />
                区域营收分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              {regionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={regionChartData}
                    layout="vertical"
                    margin={{ top: 0, right: 20, bottom: 0, left: 50 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={45} tick={{ fontSize: 11 }} />
                    <RTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={16}>
                      {regionChartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={REGION_COLORS[entry.name]?.accent || '#10b981'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                  暂无数据
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom: Customer Level Distribution by Region */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              客户级别分布（按区域）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {levelByRegionData.length > 0 ? (
              <div className="space-y-4">
                {/* Legend */}
                <div className="flex items-center gap-4 flex-wrap">
                  {Object.entries(LEVEL_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm" style={{ background: LEVEL_COLORS[key] }} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Stacked bars */}
                <ResponsiveContainer width="100%" height={Math.max(200, levelByRegionData.length * 48)}>
                  <BarChart
                    data={levelByRegionData}
                    layout="vertical"
                    margin={{ top: 0, right: 20, bottom: 0, left: 50 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="region" width={45} tick={{ fontSize: 11 }} />
                    <RTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border bg-background p-2.5 shadow-md">
                            <p className="text-xs font-medium mb-1.5">{label}</p>
                            {payload.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                                <span className="text-muted-foreground">{LEVEL_LABELS[p.dataKey as string] || p.dataKey}:</span>
                                <span className="font-semibold crm-number">{p.value}</span>
                              </div>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="A" stackId="level" fill={LEVEL_COLORS.A} radius={0} barSize={20} />
                    <Bar dataKey="B" stackId="level" fill={LEVEL_COLORS.B} radius={0} barSize={20} />
                    <Bar dataKey="C" stackId="level" fill={LEVEL_COLORS.C} radius={0} barSize={20} />
                    <Bar dataKey="D" stackId="level" fill={LEVEL_COLORS.D} radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

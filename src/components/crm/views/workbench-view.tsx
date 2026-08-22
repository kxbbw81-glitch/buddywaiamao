'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Bot,
  BarChart3,
  Clock,
  Mail,
  Phone,
  Users,
  MessageSquare,
  Wallet,
  PieChart as PieChartIcon,
  CreditCard,
  TrendingDown,
  Eye,
  ChevronRight,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/crm/status-badge'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/utils'
import {
  Tooltip,
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

/* ============ 工作台 V3.8（按《外贸CRM工作台最终设计方案》实施） ============ */

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

// 红涨绿跌（中国习惯）
const UP_COLOR = '#E24B4A'
const DOWN_COLOR = '#0F6E56'
const SPARK_COLOR = '#185FA5'

const activityIcons: Record<string, React.ElementType> = {
  email: Mail,
  call: Phone,
  meeting: Users,
  note: MessageSquare,
  follow_up: Clock,
  system: Bot,
}

/* ---- 氛围条：每日一句（实际由一言 API 提供，失败降级本地轮换） ---- */
const atmoQuotes = [
  '今天的报价单，就是下个月的回款单。',
  '客户的一句「在考虑」，值得打一通电话。',
  '样品寄出去的不是货，是下一次成交的机会。',
  '汇率每波动 1%，都是利润在说话。',
  '跟得上节奏的客户，不会等你犹豫完。',
]

/* ---- 假日数据表（演示；实际由 Holiday 表维护，我方与客户国共用一表） ---- */
const cnHoliday = { name: '中秋', sm: 9, sd: 25, em: 9, ed: 27, days: 3 }
const countryHolidays: Record<string, { name: string; m: number; d: number; days: number }> = {
  '英国': { name: '夏末银行假日', m: 8, d: 31, days: 1 },
  '美国': { name: '劳动节', m: 9, d: 7, days: 1 },
  '德国': { name: '统一日', m: 10, d: 3, days: 1 },
  '日本': { name: '敬老节', m: 9, d: 21, days: 1 },
  '印度': { name: '甘地诞辰', m: 10, d: 2, days: 1 },
  '巴西': { name: '独立日', m: 9, d: 7, days: 1 },
  '澳大利亚': { name: '劳动节', m: 10, d: 5, days: 1 },
}

function daysUntil(m: number, d: number) {
  const now = new Date()
  const t = new Date(now.getFullYear(), m - 1, d)
  return Math.ceil((t.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000)
}

/* ---- 迷你趋势线（128x26，与设计稿一致） ---- */
function Spark({ pts }: { pts: number[] }) {
  const w = 128
  const h = 26
  const max = Math.max(...pts)
  const min = Math.min(...pts)
  const rng = max - min || 1
  const step = w / (pts.length - 1)
  const y = (p: number) => (h - 3 - ((p - min) / rng) * (h - 6)).toFixed(1)
  const pl = pts.map((p, i) => `${(i * step).toFixed(1)},${y(p)}`).join(' ')
  const li = pts.length - 1
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mt-2 block max-w-full">
      <polyline points={pl} fill="none" stroke={SPARK_COLOR} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(li * step).toFixed(1)} cy={y(pts[li])} r={2.2} fill={SPARK_COLOR} />
    </svg>
  )
}

/* ---- 销售漏斗（SVG 梯形逻辑 → CSS clip-path 实现；金额为主角） ---- */
const funnelStages = [
  { name: '线索', n: 214, amt: '$536K', w: 100 },
  { name: '询盘', n: 96, amt: '$238K', w: 82, conv: ['44.9%', '▼ 3.8pt', 'down'] as const },
  { name: '报价', n: 42, amt: '$128K', w: 64, conv: ['43.8%', '▲ 2.1pt', 'up'] as const },
  { name: '样品', n: 14, amt: '$52K', w: 46, conv: ['33.3%', '▼ 1.2pt', 'down'] as const },
  { name: '成交', n: 6, amt: '$24.6K', w: 30, conv: ['42.9%', '▲ 0.9pt', 'up'] as const, hot: true },
]

/* ---- 角色数据（演示口径：KPI 数值取自 /api/dashboard，趋势/口径说明为演示数据） ---- */
type WbRole = 'sales' | 'manager' | 'finance' | 'exec' | 'admin'

const ROLE_MAP: Record<string, WbRole> = {
  sales: 'sales',
  sales_manager: 'manager',
  finance: 'finance',
  management: 'exec',
  super_admin: 'admin',
}

const ROLE_NAME: Record<WbRole, string> = {
  sales: '销售业务员',
  manager: '销售经理',
  finance: '财务',
  exec: '管理层',
  admin: '超级管理员',
}

interface CapsuleSpec {
  tone: 'yellow' | 'red' | 'blue' | 'green'
  breath?: boolean
  emoji: string
  num: string
  label: string
  sub: string
  go: [string, string]
}

interface TodoSpec {
  pri: 'red' | 'amber' | 'blue'
  name: string
  meta: string
  act: string
  go: [string, string]
}

interface RoleSpec {
  scope: string
  desc: string
  bench: string
  capsules: CapsuleSpec[]
  kpiMeta: { delta: 'up' | 'down'; deltaText: string; foot: string; spark: number[] }[]
  todos: TodoSpec[]
}

const wbData: Record<WbRole, RoleSpec> = {
  sales: {
    scope: '本人',
    desc: '氛围条关注你负责的英国市场；AI 已按意向度 × 时效排好今天的优先行动。',
    bench: '团队均值',
    capsules: [
      { tone: 'yellow', emoji: '📋', num: '6', label: '今日待办', sub: '2 条高优先级', go: ['workbench', 'todo-list'] },
      { tone: 'red', breath: true, emoji: '⚠️', num: '2', label: '超期跟进', sub: '最久超 2 天，处理前持续提醒', go: ['workbench', 'todo-list'] },
      { tone: 'blue', emoji: '🔔', num: '3', label: '商机提醒', sub: '客户已读未回复', go: ['pipeline', 'sales-pipeline'] },
    ],
    kpiMeta: [
      { delta: 'up', deltaText: '▲ 12.4%', foot: '完成率 81% · 目标 $60,000', spark: [3, 4, 3.5, 5, 4.5, 5.5, 6] },
      { delta: 'up', deltaText: '▲ 6', foot: '独立站 24 / 社媒 14', spark: [4, 5, 4, 6, 5, 7, 7] },
      { delta: 'down', deltaText: '▼ 2', foot: '3 张客户已查看', spark: [6, 5, 6, 4, 5, 4, 5] },
      { delta: 'up', deltaText: '▲ 8.1%', foot: '本月目标 $20K', spark: [1, 2, 2, 3, 2.5, 3, 3.5] },
    ],
    todos: [
      { pri: 'red', name: '10:00 跟进 Müller GmbH — DDP 报价疑虑', meta: '客户跟进 · 对方已查看报价 3 次', act: '去跟进', go: ['pipeline', 'sales-pipeline'] },
      { pri: 'red', name: 'TechNova Ltd 样品已签收 7 天，未反馈', meta: '样品跟进 · AI 建议发送测试反馈询问邮件', act: '去跟进', go: ['fulfillment', 'sample-management'] },
      { pri: 'amber', name: '回复 InfraBuild（澳洲）DDP 询盘', meta: 'AI 提取完成 · 置信度 92% · 待人工确认', act: '确认', go: ['acquisition', 'lead-pool'] },
    ],
  },
  manager: {
    scope: '团队',
    desc: '团队 8 月预计成交 $302K；美国关税预警建议今日晨会同步。',
    bench: '行业均值',
    capsules: [
      { tone: 'blue', emoji: '📥', num: '12', label: '待回复询盘', sub: '团队今日 · 平均响应 3.2 小时', go: ['acquisition', 'lead-pool'] },
      { tone: 'red', breath: true, emoji: '⚠️', num: '7', label: '风险商机', sub: '3 个卡样品阶段，处理前持续提醒', go: ['pipeline', 'sales-pipeline'] },
      { tone: 'yellow', emoji: '🌐', num: '1', label: '关税预警', sub: '待晨会同步', go: ['workbench', 'morning-view'] },
    ],
    kpiMeta: [
      { delta: 'up', deltaText: '▲ 9.2%', foot: '团队 · 完成率 86% · 目标 $450K', spark: [5, 5.5, 6, 5.5, 6.5, 7, 7.2] },
      { delta: 'up', deltaText: '▲ 18', foot: '团队 · 独立站 96 / 社媒 56', spark: [15, 18, 16, 20, 19, 22, 24] },
      { delta: 'up', deltaText: '▲ 3', foot: '团队 · 平均停留 2.1 天', spark: [18, 20, 19, 21, 20, 22, 23] },
      { delta: 'up', deltaText: '▲ 15.6%', foot: '团队 · 本月目标 $120K', spark: [2, 3, 4, 4, 5, 5.5, 6] },
    ],
    todos: [
      { pri: 'red', name: '审批 Q-2026-0892 · Nordic AB 低毛利报价', meta: '毛利 8.2% 低于 10% 底线 · Alex 提交', act: '审批', go: ['workbench', 'approval-center'] },
      { pri: 'amber', name: '晨会同步美国关税预警', meta: '影响团队商机 12 个 · AI 已生成解读', act: '查看', go: ['workbench', 'morning-view'] },
      { pri: 'blue', name: '复盘张三样品阶段 2 个成功案例', meta: '组内样品转化率低于均值 4pt', act: '复盘', go: ['insight', 'data-analysis'] },
    ],
  },
  finance: {
    scope: '全公司',
    desc: '今日 1 笔收款到期、9 笔待确认；EUR 波动 1.8%，建议本周锁汇。',
    bench: '公司均值',
    capsules: [
      { tone: 'yellow', emoji: '💰', num: '9', label: '待确认收款', sub: '合计 $58,300 · 销售已登记水单', go: ['finance', 'orders-collections'] },
      { tone: 'red', breath: true, emoji: '⚠️', num: '2', label: '严重逾期', sub: '账龄超 90 天，处理前持续提醒', go: ['finance', 'orders-collections'] },
      { tone: 'blue', emoji: '💱', num: '1', label: '汇率预警', sub: 'EUR 波动 1.8% · 敞口 $42K', go: ['tools', 'exchange-converter'] },
    ],
    kpiMeta: [
      { delta: 'up', deltaText: '▲ 8.6%', foot: '全公司 · 环比', spark: [5, 5.5, 5.2, 6, 6.3, 6.5, 6.8] },
      { delta: 'up', deltaText: '▲ 21', foot: '全公司 · 独立站 104 / 社媒 58', spark: [16, 19, 17, 21, 20, 23, 25] },
      { delta: 'up', deltaText: '▲ 2', foot: '全公司 · 含 1 张低毛利待审', spark: [22, 24, 23, 25, 24, 25, 26] },
      { delta: 'up', deltaText: '▲ 12.3%', foot: '待确认 $58.3K · 目标达成 71%', spark: [2, 3, 3.5, 4, 5, 5, 6] },
    ],
    todos: [
      { pri: 'red', name: '确认 2 笔收款水单（Nordic AB / Pacific Steel）', meta: '销售已登记 · 核对流水与汇率后入账', act: '去确认', go: ['finance', 'orders-collections'] },
      { pri: 'amber', name: 'EUR 敞口 $42K，评估本周锁汇', meta: '汇率版本台账 · 快照 8/20 16:00', act: '处理', go: ['tools', 'exchange-converter'] },
      { pri: 'blue', name: '生成 8 月提成对账单初稿', meta: '按财务汇率版本折算 · 3 人待核', act: '生成', go: ['finance', 'commission-reconciliation'] },
    ],
  },
  exec: {
    scope: '全局',
    desc: '本月目标达成 81%；东南亚环比 +38% 值得关注。',
    bench: '公司均值',
    capsules: [
      { tone: 'green', emoji: '🎯', num: '81%', label: '本月目标达成', sub: '缺口 $114K · 距月底 10 天', go: ['insight', 'data-analysis'] },
      { tone: 'red', breath: true, emoji: '⚠️', num: '3', label: '战略风险', sub: '含关税敞口，处理前持续提醒', go: ['insight', 'data-analysis'] },
      { tone: 'blue', emoji: '📈', num: '3', label: '市场情报', sub: 'AI 已生成解读', go: ['workbench', 'operating-brief'] },
    ],
    kpiMeta: [
      { delta: 'up', deltaText: '▲ 8.6%', foot: '全局 · 目标 $600K · 达成 81%', spark: [5, 5.5, 5.2, 6, 6.3, 6.5, 6.8] },
      { delta: 'up', deltaText: '▲ 21', foot: '全局 · 环比', spark: [16, 19, 17, 21, 20, 23, 25] },
      { delta: 'up', deltaText: '▲ 2', foot: '全局 · 加权预测 $86.2K', spark: [22, 24, 23, 25, 24, 25, 26] },
      { delta: 'up', deltaText: '▲ 12.3%', foot: '全局 · 待确认 $58.3K', spark: [2, 3, 3.5, 4, 5, 5, 6] },
    ],
    todos: [
      { pri: 'red', name: '决策东南亚备货方案', meta: '环比 +38% · AI 已生成备货与物流专线评估', act: '查看', go: ['insight', 'data-analysis'] },
      { pri: 'amber', name: '审阅 8 月经营简报', meta: 'AI 三段式建议 · 含关税敞口分析', act: '审阅', go: ['workbench', 'operating-brief'] },
      { pri: 'blue', name: '大客户集中度评估', meta: 'Top3 客户占 41%，接近 45% 预警线', act: '评估', go: ['insight', 'data-analysis'] },
    ],
  },
  admin: {
    scope: '全局',
    desc: '7 项服务在线；有 5 项待处理审批和 1 条异地登录告警。',
    bench: '公司均值',
    capsules: [
      { tone: 'green', emoji: '✅', num: '7', label: '系统运行正常', sub: '7 项服务在线 · 运行 46 天', go: ['system', 'database-maintenance'] },
      { tone: 'yellow', emoji: '📝', num: '5', label: '待处理审批', sub: '3 账号 2 权限', go: ['system', 'accounts-permissions'] },
      { tone: 'red', breath: true, emoji: '🚨', num: '1', label: '异地登录告警', sub: 'IP 已记录，处理前持续提醒', go: ['system', 'accounts-permissions'] },
    ],
    kpiMeta: [
      { delta: 'up', deltaText: '▲ 8.6%', foot: '全局 · 数据口径', spark: [5, 5.5, 5.2, 6, 6.3, 6.5, 6.8] },
      { delta: 'up', deltaText: '▲ 21', foot: '全局 · 数据口径', spark: [16, 19, 17, 21, 20, 23, 25] },
      { delta: 'up', deltaText: '▲ 2', foot: '全局 · 数据口径', spark: [22, 24, 23, 25, 24, 25, 26] },
      { delta: 'up', deltaText: '▲ 12.3%', foot: '全局 · 数据口径', spark: [2, 3, 3.5, 4, 5, 5, 6] },
    ],
    todos: [
      { pri: 'red', name: '复核异地登录告警（账号 zhang3）', meta: '登录 IP 47.98.x.x · 与常用设备不符', act: '复核', go: ['system', 'accounts-permissions'] },
      { pri: 'amber', name: '处理 5 项待审批（3 账号 2 权限）', meta: '账号生命周期 + 权限模板变更', act: '去审批', go: ['system', 'accounts-permissions'] },
      { pri: 'blue', name: '检查昨日数据库备份任务', meta: 'SQL.GZ · 保留策略 30 份 · 全部成功', act: '查看', go: ['system', 'database-maintenance'] },
    ],
  },
}

const CAP_TONE: Record<CapsuleSpec['tone'], string> = {
  yellow: 'border-[#F3D9A4] bg-[#FFFBF2]',
  red: 'border-[#F0B9B8] bg-[#FEF6F6]',
  blue: 'border-[#B9DCF5] bg-[#F5FAFE]',
  green: 'border-[#B9E2D3] bg-[#F4FBF8]',
}

const PRI_COLOR: Record<TodoSpec['pri'], string> = {
  red: 'bg-[#E24B4A]',
  amber: 'bg-[#EFA01F]',
  blue: 'bg-[#185FA5]',
}

export function WorkbenchView() {
  const { currentUser } = useCRMStore()
  const [focusCountry, setFocusCountry] = useState('英国')

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const roleKey = ROLE_MAP[currentUser?.primaryRole || ''] || 'sales'
  const spec = wbData[roleKey]

  const today = new Date()
  const wd = ['日', '一', '二', '三', '四', '五', '六'][today.getDay()]
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日 星期${wd}`
  const hour = today.getHours()
  const greetWord = hour < 11 ? '早上好' : hour < 13 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
  const quote = atmoQuotes[today.getDate() % atmoQuotes.length]

  const cnUntil = daysUntil(cnHoliday.sm, cnHoliday.sd)
  const cnText = `我方${cnHoliday.name}放假 ${cnHoliday.sm}.${cnHoliday.sd}-${cnHoliday.em}.${cnHoliday.ed}·${cnHoliday.days}天 还有 ${cnUntil} 天`
  const ch = countryHolidays[focusCountry]
  const chUntil = daysUntil(ch.m, ch.d)
  const chText = `${ch.name} ${ch.m}.${ch.d}·${ch.days}天 还有 ${chUntil} 天`

  const { setCurrentNavigation, selectInquiry } = useCRMStore()

  const { data: pendingInquiriesData } = useQuery({
    queryKey: ['pending-inquiries'],
    queryFn: () => fetch('/api/inquiries?status=new&pageSize=50').then((r) => r.json()),
    refetchInterval: 30000,
  })
  const pendingInquiries = (pendingInquiriesData?.data || []) as Record<string, unknown>[]

  const handleNav = (go: [string, string]) => {
    setCurrentNavigation(go[0] as never, go[1])
  }

  const kpiCards = useMemo(() => {
    if (!data?.data) return []
    const kpis = data.data.kpis
    return [
      { label: '本月销售额', value: formatCurrency(kpis.totalRevenue), meta: spec.kpiMeta[0] },
      { label: '本月新增询盘', value: formatNumber(kpis.totalInquiries), meta: spec.kpiMeta[1] },
      { label: '进行中报价单', value: formatNumber(kpis.pendingQuotations), meta: spec.kpiMeta[2] },
      { label: '本月回款', value: formatCurrency(kpis.totalPaid), meta: spec.kpiMeta[3] },
    ]
  }, [data, spec])

  if (isLoading || !data?.data) {
    return (
      <div className="space-y-6">
        <div className="h-[42px] bg-muted rounded-[10px] animate-pulse" />
        <div className="h-20 bg-muted rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[132px] bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const { kpis, recentActivities, charts } = data.data

  return (
    <div className="space-y-4 workbench-bg rounded-lg p-1">
      {/* ===== 氛围条（每日一句 + 我方放假倒计时 + 客户国家假日） ===== */}
      <motion.div
        className="flex items-center bg-card border border-border rounded-[10px] h-[42px] overflow-hidden text-xs"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex-1 min-w-[160px] overflow-hidden relative h-full flex items-center text-muted-foreground px-3">
          <span className="wb-marquee-text">✦ {quote}</span>
        </div>
        <span className="px-3.5 border-l border-border/60 text-muted-foreground flex items-center gap-1.5 whitespace-nowrap h-full">
          📅 <b className="font-semibold text-foreground/80">{dateStr}</b>
        </span>
        <span
          className={cn(
            'px-3.5 border-l border-border/60 flex items-center gap-1.5 whitespace-nowrap h-full',
            cnUntil <= 15 ? 'bg-[#FDF3F3] text-[#A32D2D]' : 'text-muted-foreground'
          )}
          title="下单预期管理：倒计时内新订单交期需预留假期"
        >
          🇨🇳 {cnUntil <= 15 ? <b className="font-semibold">{cnText}</b> : cnText}
        </span>
        <span
          className={cn(
            'px-3.5 border-l border-border/60 flex items-center gap-1.5 whitespace-nowrap h-full',
            chUntil <= 14 ? 'bg-[#FDF3F3] text-[#A32D2D]' : 'text-muted-foreground'
          )}
        >
          <select
            className="bg-transparent border-none outline-none cursor-pointer text-inherit"
            value={focusCountry}
            onChange={(e) => setFocusCountry(e.target.value)}
          >
            {Object.keys(countryHolidays).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span>{chText}</span>
        </span>
      </motion.div>

      {/* ===== 假期预警条（客户国假期 ≤14 天时显示） ===== */}
      {chUntil <= 14 && (
        <motion.div
          className="text-xs text-[#A32D2D] bg-[#FDF3F3] border border-[#F0B9B8] rounded-lg px-3 py-[7px] leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {focusCountry}客户{ch.name}放假 {ch.days} 天：期间客户不回复、物流停摆，报价/签单/催款请提前，在途订单交期做好预期——客户放假前是催单、发货、节日营销的黄金窗口。
        </motion.div>
      )}

      {/* ===== 问候区 ===== */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="text-xs text-muted-foreground mb-1">工作台 / 角色工作台</div>
        <div className="text-xl font-bold">
          {greetWord}，{currentUser?.name || '用户'} 👋
        </div>
        <div className="text-[13px] text-muted-foreground mt-1">
          今天是 {today.getMonth() + 1} 月 {today.getDate()} 日 · 当前视角：{ROLE_NAME[roleKey]}（数据范围：{spec.scope}）。{spec.desc}
        </div>
      </motion.div>

      {/* ===== 今日提醒胶囊条（红类呼吸灯） ===== */}
      <motion.div
        className="flex gap-3 flex-wrap"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {spec.capsules.map((c) => (
          <div
            key={c.label}
            className={cn(
              'flex-1 min-w-[200px] flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer relative bg-card transition-transform duration-100 hover:-translate-y-0.5',
              CAP_TONE[c.tone]
            )}
            onClick={() => handleNav(c.go)}
          >
            {c.breath && <span className="wb-breath-dot absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E24B4A]" />}
            <span className="text-[22px] leading-none">{c.emoji}</span>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-foreground leading-none">{c.num}</span>
                <span className="text-xs text-foreground/80">{c.label}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-[3px]">{c.sub}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ===== KPI 四卡（红涨绿跌 + 迷你趋势） ===== */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
      >
        {kpiCards.map((k) => (
          <motion.div
            key={k.label}
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          >
            <div className="bg-card border border-border rounded-xl p-4 h-full hover:shadow-md transition-shadow">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                {k.label}
                <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-px font-normal">{spec.scope}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[26px] font-semibold text-foreground tracking-tight crm-number">{k.value}</span>
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: k.meta.delta === 'up' ? UP_COLOR : DOWN_COLOR }}
                >
                  {k.meta.deltaText}
                </span>
              </div>
              <Spark pts={k.meta.spark} />
              <div className="text-[11px] text-muted-foreground mt-1.5">{k.meta.foot}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ===== 销售漏斗 + 今日待办 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3.5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                销售漏斗
                <span className="text-[10px] font-normal text-muted-foreground bg-muted rounded px-1.5 py-px">
                  通用 · 数据范围：{spec.scope} · 对标：{spec.bench}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {funnelStages.map((s, i) => (
                <div key={s.name} className="grid grid-cols-[1fr_118px] gap-3 items-center">
                  <div className="flex justify-center">
                    <div
                      className="h-[46px] w-full flex flex-col items-center justify-center text-white"
                      style={{
                        width: `${s.w}%`,
                        background: s.hot
                          ? 'linear-gradient(180deg,#F6B352,#E8861A)'
                          : `linear-gradient(180deg,hsl(214,52%,${66 - i * 4}%),hsl(214,62%,${52 - i * 4}%))`,
                        clipPath: 'polygon(9% 0,91% 0,78% 100%,22% 100%)',
                      }}
                    >
                      <div className="text-[11px] opacity-95 flex gap-2 items-baseline whitespace-nowrap">
                        {s.name} {s.n} 条
                        <span className="text-[15px] font-bold">{s.amt}</span>
                      </div>
                    </div>
                  </div>
                  {'conv' in s && s.conv ? (
                    <div className="flex flex-col gap-[3px] text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center bg-muted rounded-full px-[9px] py-[2px] w-max text-foreground/80 font-medium">
                        ↓ {s.conv[0]}
                      </span>
                      <span>
                        vs 基准{' '}
                        <span className={cn('font-semibold', s.conv[2] === 'up' ? 'text-[#0F6E56]' : 'text-[#E24B4A]')}>
                          {s.conv[1]}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground/60">进入漏斗</div>
                  )}
                </div>
              ))}
              <div className="mt-3 px-3.5 py-[9px] bg-[#FFFBF2] border border-[#F3D9A4] rounded-[10px] text-xs text-foreground/80 dark:text-foreground">
                总体转化 <b className="text-[#854F0B]">2.8%</b>{' '}
                <span className="text-[#E24B4A] font-semibold">▼ 0.6pt</span> vs {spec.bench} · 平均客单价{' '}
                <b className="text-[#854F0B]">$4.1K</b>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                今日待办
                <span
                  className="text-xs text-[#185FA5] font-normal cursor-pointer hover:underline"
                  onClick={() => handleNav(['workbench', 'todo-list'])}
                >
                  全部
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                {spec.todos.map((t) => (
                  <div key={t.name} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRI_COLOR[t.pri])} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-foreground truncate">{t.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-[3px] truncate">{t.meta}</div>
                    </div>
                    <button
                      className="text-[11px] text-[#185FA5] border border-[#185FA5]/30 rounded-md px-2.5 py-1 hover:bg-[#185FA5]/5 transition-colors shrink-0"
                      onClick={() => handleNav(t.go)}
                    >
                      {t.act}
                    </button>
                  </div>
                ))}
                <div className="mt-2.5 px-3 py-[9px] bg-[#EEEDFE] rounded-lg text-[11px] text-[#534AB7] leading-relaxed">
                  AI 待办洞察：客户已读未回复 3 天，建议电话跟进（Müller GmbH）· 超期项已标红并置顶
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ===== 收款概览 ===== */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
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

      {/* ===== 询盘待跟进 + 最近动态 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                待跟进询盘
                <Badge variant="secondary" className="ml-auto text-xs">{pendingInquiries.length} 条待处理</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto crm-scrollbar">
                {pendingInquiries.length > 0 ? pendingInquiries.slice(0, 10).map((inq) => (
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
                  <p className="text-sm text-muted-foreground py-8 text-center">暂无待处理询盘 🎉</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <Card className="h-full">
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
                          {activity.user ? <span>{(activity.user as Record<string, unknown>).name as string}</span> : null}
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

      {/* ===== 角色专属面板 ===== */}
      {(currentUser?.primaryRole === 'finance' || currentUser?.primaryRole === 'super_admin' || currentUser?.primaryRole === 'management') && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
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

      {/* ===== Top 客户 ===== */}
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
                        <Cell key={i} fill={`url(#barGradient${i})`} />
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

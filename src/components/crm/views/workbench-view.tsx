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
import { toast } from 'sonner'
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

/* ---- 管道健康度：各阶段商机平均停留时长（阈值 7 天） ---- */
const stageStay = [
  { name: '询盘', days: 2.1, pct: 25 },
  { name: '报价', days: 4.6, pct: 55 },
  { name: '样品', days: 12.4, pct: 100, warn: '卡点' },
  { name: '谈判', days: 6.2, pct: 74 },
]

/* ---- 全球业务地图：气泡 = 本月成交额（风险市场橙色） ---- */
const mapBubbles = [
  { name: '美国', amt: '$384K', x: 18, y: 38, size: 46, cust: 42, mom: '+6.2%', risk: true },
  { name: '巴西', amt: '$86K', x: 30, y: 72, size: 30, cust: 11, mom: '+11.4%', risk: false },
  { name: '德国', amt: '$210K', x: 50, y: 30, size: 38, cust: 28, mom: '+9.1%', risk: false },
  { name: '印度', amt: '$95K', x: 66, y: 52, size: 30, cust: 15, mom: '-2.3%', risk: false },
  { name: '东南亚', amt: '$205K', x: 74, y: 58, size: 37, cust: 23, mom: '+38.2%', risk: false },
  { name: '澳大利亚', amt: '$54K', x: 84, y: 78, size: 27, cust: 9, mom: '+4.8%', risk: false },
]

/* ---- 多币种汇率看板（对 USD · 演示快照） ---- */
const wbFxRates: [string, string, 'up' | 'down', string][] = [
  ['EUR', '1.084', 'up', '▲ 0.3%'],
  ['GBP', '1.271', 'down', '▼ 0.2%'],
  ['JPY', '149.2', 'up', '▲ 0.5%'],
  ['INR', '83.9', 'down', '▼ 0.1%'],
  ['BRL', '5.42', 'up', '▲ 0.8%'],
  ['AUD', '0.665', 'down', '▼ 0.4%'],
]

/* ---- AI 经营建议（按角色生成，演示口径） ---- */
const adviceData: Record<WbRole, { pri: TodoSpec['pri']; name: string; meta: string }[]> = {
  sales: [
    { pri: 'red', name: '9 条询盘卡在「等我方确认」超 3 天，今天清掉', meta: '个人行动建议 · 影响金额约 $86K（按加权预测）' },
    { pri: 'amber', name: 'TechNova 样品签收 7 天未反馈', meta: 'AI 已生成询问邮件草稿，引用已审核产品资料，发送前需你确认' },
  ],
  manager: [
    { pri: 'red', name: '组内样品阶段转化率低于团队均值 4pt，建议复盘张三的成功案例', meta: '团队管理建议 · 样品阶段平均停留 12.4 天为最大卡点' },
    { pri: 'amber', name: '美国关税预警影响商机 12 个，建议今日晨会同步并排查在途报价', meta: '竞品调价 + 受影响商机名单已生成，可一键导出晨会材料' },
  ],
  finance: [
    { pri: 'red', name: 'EUR 敞口 $42K，建议本周锁汇', meta: '财务建议 · EUR/USD 单日波动 1.8%，创近 3 个月新高' },
    { pri: 'amber', name: '2 笔应收账龄超 90 天，建议启动催收流程', meta: '涉及 Nordic AB $210K、Pacific Steel $110K · 已通知对应销售' },
  ],
  exec: [
    { pri: 'red', name: '东南亚市场环比 +38%，建议增加备货并评估专线物流', meta: '战略建议 · 全球 3D 打印市场 2027 年预计达 $45B，头部厂商已布局东南亚' },
    { pri: 'amber', name: '大客户集中度 Top3 占 41%，接近预警线', meta: '建议培育中部客户 · AI 已圈定 12 家高潜力成长客户名单' },
  ],
  admin: [
    { pri: 'amber', name: '3 个账号 90 天未登录，建议清理', meta: '系统建议 · 含 1 个仍持有导出权限的账号' },
    { pri: 'blue', name: '昨日 AI 调用 1,284 次，建议采纳率 76%', meta: '成本 $12.6，在月度预算内 · 资讯采集任务 8/8 在线' },
  ],
}

/* ---- 外贸资讯推送（每日 8:30 · 按角色定制；biz = 一键动作） ---- */
type NewsTag = 'policy' | 'industry' | 'biz' | 'fx' | 'sys'
const NEWS_TAG_LABEL: Record<NewsTag, string> = {
  policy: '政策', industry: '行业', biz: '商机', fx: '汇率', sys: '系统',
}
const NEWS_TAG_TONE: Record<NewsTag, string> = {
  policy: 'text-[#A32D2D] bg-[#FCEBEB]',
  industry: 'text-[#854F0B] bg-[#FAEEDA]',
  biz: 'text-[#0F6E56] bg-[#DFF2EC]',
  fx: 'text-[#0C447C] bg-[#E6F1FB]',
  sys: 'text-[#4B5563] bg-muted',
}
const newsData: Record<WbRole, { tag: NewsTag; title: string; meta: string; biz?: [string, string] }[]> = {
  sales: [
    { tag: 'biz', title: '欧洲教育市场招标：桌面级 3D 打印机 200 台，9 月 15 日截止', meta: 'AI 识别为高匹配商机 · 匹配度 87%', biz: ['一键转线索', '已转入线索池并生成跟进任务（演示）'] },
    { tag: 'industry', title: 'PLA 原料价格本周上涨 4.2%，ABS/树脂持稳', meta: '影响你 2 张未发送报价的成本构成', biz: ['关联报价提醒', '已推送成本刷新提醒（演示）'] },
    { tag: 'policy', title: '美国拟对华 3D 打印机关税上调，征求意见期 30 天', meta: '影响你在途商机 3 个 · 客户 2 家', biz: ['一键转商机', '已生成商机预警并关联客户（演示）'] },
  ],
  manager: [
    { tag: 'policy', title: '美国拟对华 3D 打印机关税上调，征求意见期 30 天', meta: '团队受影响商机 12 个 · 已生成晨会同步项', biz: ['生成晨会同步项', '已加入今日晨会待同步事项（演示）'] },
    { tag: 'industry', title: '竞品 Hatchbox 宣布欧洲区耗材调价 +6%', meta: '受影响商机 5 个 · 建议排查在途报价竞争力', biz: ['查看受影响商机', '已筛选 5 个受影响商机（演示）'] },
    { tag: 'biz', title: '东南亚 3D 打印教育采购需求环比 +38%', meta: '团队区域市场情报 · AI 已生成解读', biz: ['一键转线索', '已转入公海池待分配（演示）'] },
  ],
  finance: [
    { tag: 'fx', title: 'EUR/USD 单日波动 1.8%，创近 3 个月新高', meta: '未锁汇敞口 $42K', biz: ['评估锁汇', '已打开汇率版本台账（演示）'] },
    { tag: 'policy', title: '出口退税率调整征求意见：部分塑料制品拟下调', meta: '影响耗材类订单毛利测算 · 涉及在途订单 14 单', biz: ['查看影响订单', '已筛选 14 个受影响订单（演示）'] },
    { tag: 'policy', title: '欧盟海关申报新规 10 月生效：低值货物申报字段变更', meta: '影响形式发票与商业发票模板', biz: ['查看新规解读', '已生成新规解读与模板变更清单（演示）'] },
  ],
  exec: [
    { tag: 'industry', title: '全球 3D 打印市场规模 2027 年预计达 $45B（CAGR 19.3%）', meta: 'AI 已生成解读：桌面级设备与教育市场为增量主力', biz: ['查看解读', '已生成战略解读报告（演示）'] },
    { tag: 'policy', title: '美国拟对华 3D 打印机关税上调，征求意见期 30 天', meta: '在美收入占比 38% · 关税敞口已纳入战略风险', biz: ['查看敞口分析', '已打开战略风险预警（演示）'] },
    { tag: 'industry', title: '头部厂商加速东南亚布局：本地化组装 + 关税规避 2.3%', meta: '竞争情报 · 建议评估东南亚区域政策红利', biz: ['查看解读', '已生成竞争解读（演示）'] },
  ],
  admin: [
    { tag: 'sys', title: '资讯采集任务：8 个信源全部在线，今日已抓取 214 条', meta: '按行业词库（3D 打印机 / PLA 耗材）过滤后分发 41 条' },
    { tag: 'sys', title: '行业订阅词库：「树脂耗材」「教育市场」待审核词 2 个', meta: '词库配置 · 审核后生效于每日 8:30 简报', biz: ['配置词库', '已打开资讯源配置（演示）'] },
    { tag: 'sys', title: '每日一句一言 API：近 7 日成功率 99.2%', meta: '失败自动降级为本地 10 句轮换 · 无需处理' },
  ],
}

/* ---- 角色专属模块区（25 个专属模块：销售 6 / 经理 6 / 财务 8 / 高管 6 / 管理员 6） ---- */
const roleModules: Record<WbRole, [string, string][]> = {
  sales: [
    ['跟进优先级队列', 'AI 按意向度 × 时效排序的今日跟进名单，含建议动作和话术'],
    ['我的业绩进度', '目标完成率进度条、月度趋势、与团队均值对比'],
    ['样品协同', '寄样申请、物流跟踪、客户测试反馈跟进'],
    ['开发信 & 客户沟通工具', 'AI 生成开发信、邮件模板、跟进话术库'],
    ['备忘录 & 个人知识', '仅本人可见（绝对隐私）'],
    ['计划任务 & 训练清单', '个人计划、产品知识训练'],
  ],
  manager: [
    ['晨会视图', '团队昨日战报 + 今日重点 + 待同步事项，一屏投屏'],
    ['团队业绩排行', '成员业绩榜（销售可看自己排名，高管看全局）'],
    ['团队风险预警', '超期跟进、卡点商机、低活跃成员预警'],
    ['团队日报管理', '销售提交日报 / 经理批阅管理'],
    ['商机干预 & 分配', '公海池、商机改派、介入协助'],
    ['团队漏斗分析', '团队漏斗 vs 行业均值（高管可看全局口径）'],
  ],
  finance: [
    ['应收账款账龄分析', '账龄分段表（0-30/31-60/61-90/90+），红黄绿分级'],
    ['收款确认队列', '销售登记水单 → 财务确认核销'],
    ['提成与对账', '销售提成计算、月度对账单（销售可查本人）'],
    ['汇率管理', '汇率版本维护、锁汇、敞口监控'],
    ['合同管理', '合同台账、归档、法务条款'],
    ['财务报表', '现金流、利润、退税报表'],
    ['履约交付监控', '订单履约进度与收款联动'],
    ['发票与税务', '形式发票、商业发票、退税申报'],
  ],
  exec: [
    ['全球市场分布', '全球热力图（销售/经理看自己区域，高管看全球）'],
    ['经营趋势分析', '12 个月销售额/毛利趋势、同比环比'],
    ['战略风险预警', '关税敞口、大客户集中度、汇率敞口'],
    ['客户结构分析', '客户分层（大客户/成长/长尾）、行业分布、集中度'],
    ['产品线贡献度', '3D 打印机 vs 耗材各产品线销售额/毛利贡献'],
    ['销售预测', '基于管道加权 + AI 预测下季度/年度业绩'],
  ],
  admin: [
    ['账号与权限管理', '账号生命周期、角色分配、字段级权限'],
    ['系统配置', '业务参数、审批流、氛围条 API/国家/假期数据配置'],
    ['审计日志', '敏感操作全量审计'],
    ['数据库维护', '备份、归档、性能监控'],
    ['导入导出管控', '数据导入导出审批与水印'],
    ['集成与 API 管理', '邮件/WhatsApp/资讯源/一言 API 等集成配置'],
  ],
}

const roleBadgeName: Record<WbRole, string> = {
  sales: '销售', manager: '经理', finance: '财务', exec: '高管', admin: '管理员',
}
const RM_TONE: Record<WbRole, string> = {
  sales: 'text-[#9A5B00] bg-[#FAEEDA]',
  manager: 'text-[#534AB7] bg-[#EEEDFE]',
  finance: 'text-[#0F6E56] bg-[#DFF2EC]',
  exec: 'text-[#A32D2D] bg-[#FCEBEB]',
  admin: 'text-[#4B5563] bg-muted',
}
const MAP_SCOPE: Record<WbRole, string> = {
  sales: '本人区域', manager: '团队区域', finance: '财务视角', exec: '全球', admin: '全球',
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

      {/* ===== 管道健康度 + AI 经营建议 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                管道健康度
                <span className="text-[10px] font-normal text-muted-foreground bg-muted rounded px-1.5 py-px">通用</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[11px] text-muted-foreground mb-2">各阶段商机平均停留时长（阈值 7 天）</div>
              {stageStay.map((s) => (
                <div key={s.name} className="grid grid-cols-[44px_1fr_120px] gap-2.5 items-center py-[5px] text-xs text-foreground/80">
                  <span>{s.name}</span>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', s.warn ? 'bg-[#EF9F27]' : 'bg-[#A8C5E8]')}
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                  <span className="text-right text-muted-foreground whitespace-nowrap">
                    {s.days} 天{' '}
                    {s.warn && <span className="text-[#B45309] font-semibold">⚠️ {s.warn}</span>}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-baseline mt-3 text-xs text-foreground/80">
                <span>
                  加权预测金额 <b className="text-base text-foreground">$86,200</b>
                </span>
                <span className="text-[11px] text-muted-foreground">按各阶段历史转化率计算</span>
              </div>
              <div className="mt-2.5 px-3 py-[9px] bg-[#EEEDFE] rounded-lg text-[11px] text-[#534AB7] leading-relaxed">
                AI 提示：TechNova Ltd（英国）样品寄出 12 天未反馈，今天电话确认；样品阶段停留 12.4 天为最大卡点
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                AI 经营建议
                <span className="text-[10px] font-normal text-muted-foreground bg-muted rounded px-1.5 py-px">
                  通用 · 按「{ROLE_NAME[roleKey]}」生成
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adviceData[roleKey].map((a) => (
                <div key={a.name} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-[7px]', PRI_COLOR[a.pri])} />
                  <div className="min-w-0">
                    <div className="text-[13px] text-foreground">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-[3px] leading-relaxed">{a.meta}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ===== 全球业务地图 + 外贸资讯 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                全球业务地图
                <span className="text-[10px] font-normal text-muted-foreground bg-muted rounded px-1.5 py-px">
                  通用 · {MAP_SCOPE[roleKey]}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative h-[230px] bg-gradient-to-b from-[#F7FAFD] to-[#F0F5FA] dark:from-muted/40 dark:to-muted/20 border border-border rounded-[10px] overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{ backgroundImage: 'radial-gradient(#d6dfe9 1px, transparent 1px)', backgroundSize: '22px 22px', opacity: 0.6 }}
                />
                {mapBubbles.map((b) => (
                  <div
                    key={b.name}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer"
                    style={{ left: `${b.x}%`, top: `${b.y}%` }}
                    onClick={() =>
                      toast(
                        `${b.name}：本月成交 ${b.amt} · 客户 ${b.cust} 家 · 环比 ${b.mom} · ${
                          b.risk ? '受关税影响市场，注意报价与交期' : '增长健康'
                        }`
                      )
                    }
                  >
                    <div
                      className={cn(
                        'rounded-full flex items-center justify-center text-white text-[10px] font-semibold',
                        b.risk
                          ? 'bg-[#EF9F27]/90 shadow-[0_0_0_5px_rgba(239,159,39,.16)]'
                          : 'bg-[#185FA5]/85 shadow-[0_0_0_5px_rgba(24,95,165,.14)]'
                      )}
                      style={{ width: b.size, height: b.size }}
                    >
                      {b.amt}
                    </div>
                    <div className="text-[10px] text-foreground/80 mt-[5px] bg-card/90 px-1.5 py-px rounded-md whitespace-nowrap">
                      {b.name}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 text-[11px] text-muted-foreground mt-2.5 items-center flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#185FA5]/85 inline-block" />
                  增长健康
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EF9F27] inline-block" />
                  关税/风险市场
                </span>
                <span>气泡大小 = 本月成交额 · 点击查看详情</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                外贸资讯 · 行业资讯推送
                <span className="text-[10px] font-normal text-muted-foreground bg-muted rounded px-1.5 py-px">
                  每日 8:30 · 按「{ROLE_NAME[roleKey]}」定制
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {newsData[roleKey].map((n) => (
                <div key={n.title} className="py-2.5 border-b border-border last:border-0">
                  <span className={cn('text-[10px] px-[7px] py-px rounded font-medium mr-2 align-[1px]', NEWS_TAG_TONE[n.tag])}>
                    {NEWS_TAG_LABEL[n.tag]}
                  </span>
                  <span className="text-[13px] text-foreground">{n.title}</span>
                  <div className="text-[11px] text-muted-foreground mt-[3px]">
                    {n.meta}
                    {n.biz && (
                      <>
                        {' · '}
                        <button className="text-[#0F6E56] hover:underline" onClick={() => toast(n.biz![1])}>
                          {n.biz![0]} →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ===== 多币种汇率看板 ===== */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              多币种汇率看板
              <span className="text-[10px] font-normal text-muted-foreground bg-muted rounded px-1.5 py-px">
                对 USD · 快照 {String(today.getHours()).padStart(2, '0')}:{String(today.getMinutes()).padStart(2, '0')}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {wbFxRates.map((f) => (
                <div key={f[0]} className="border border-border rounded-[10px] px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground flex justify-between">
                    <span>USD/{f[0]}</span>
                  </div>
                  <div className="text-base font-semibold mt-1 flex items-baseline justify-between text-foreground">
                    <span>{f[1]}</span>
                    <span className="text-[11px] font-semibold" style={{ color: f[2] === 'up' ? UP_COLOR : DOWN_COLOR }}>
                      {f[3]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ===== 角色专属模块区（25 个专属模块按角色显示） ===== */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <div className="text-sm font-semibold mb-2.5 flex items-center gap-2">
          角色专属模块
          <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-px font-normal">
            {ROLE_NAME[roleKey]}可见 · {roleModules[roleKey].length} 个
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {roleModules[roleKey].map((m) => (
            <div
              key={m[0]}
              className="bg-card border border-border rounded-[10px] px-3.5 py-3 cursor-pointer hover:border-[#85B7EB] transition-colors"
              onClick={() => toast(`演示原型：${m[0]} 页面`)}
            >
              <span className={cn('text-[10px] px-[7px] py-px rounded font-medium inline-block mb-1.5', RM_TONE[roleKey])}>
                {roleBadgeName[roleKey]}专属
              </span>
              <div className="text-[13px] font-medium text-foreground">{m[0]}</div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{m[1]}</div>
            </div>
          ))}
        </div>
      </motion.div>

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

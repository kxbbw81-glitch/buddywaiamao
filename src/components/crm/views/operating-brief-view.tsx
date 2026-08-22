'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Users, Target, ShoppingCart, Wallet, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, CalendarClock, FileWarning, UserCheck, Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROLE_LABELS } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'

// ============ 数据类型 ============
interface PipelineStage { stage: string; count: number; amount: number }
interface TeamRow { salesId: string; salesName: string; salesRole: string; orderCount: number; totalAmount: number; totalPaid: number; collectionRate: number }
interface RiskAlert { type: string; level: 'danger' | 'warning' | 'info'; message: string }
interface BriefData {
  scope: 'global' | 'self'
  overview: {
    customerCount: number; activeCustomerCount: number; monthNewCustomers: number
    oppCount: number; monthNewOpps: number; pipelineAmount: number; wonAmount: number
    orderCount: number; monthNewOrders: number; orderTotalAmount: number; totalPaid: number; monthOrderAmount: number
    inquiryCount: number; monthNewInquiries: number; collectionRate: number
  }
  pipeline: PipelineStage[]
  teamRanking: TeamRow[]
  followupStats: { pending: number; todayDue: number; overdue: number; done: number }
  riskAlerts: RiskAlert[]
  generatedAt: string
}

const STAGE_LABELS: Record<string, string> = {
  prospect: '潜在', qualified: '已验证', proposal: '方案报价', negotiation: '谈判中', won: '赢单', lost: '输单',
}
const STAGE_COLORS: Record<string, string> = {
  prospect: 'bg-slate-400', qualified: 'bg-sky-400', proposal: 'bg-indigo-400', negotiation: 'bg-amber-400', won: 'bg-emerald-500',
}
const RISK_STYLES: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  danger: { color: 'text-rose-600 border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950', icon: AlertTriangle },
  warning: { color: 'text-amber-600 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950', icon: FileWarning },
  info: { color: 'text-sky-600 border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950', icon: UserCheck },
}

async function api<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    const json = await res.json()
    if (!json.success) { toast.error(json.error || '加载失败'); return null }
    return json.data as T
  } catch { toast.error('网络错误'); return null }
}

export function OperatingBriefView() {
  const [data, setData] = useState<BriefData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await api<BriefData>('/api/operating-brief')
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="mx-auto max-w-6xl"><Card><CardContent className="py-12 text-center text-sm text-muted-foreground">生成经营简报…</CardContent></Card></div>
  }
  if (!data) {
    return <div className="mx-auto max-w-6xl"><Card><CardContent className="py-12 text-center text-sm text-muted-foreground">暂无数据</CardContent></Card></div>
  }

  const o = data.overview
  const kpis = [
    { label: '活跃客户', value: o.activeCustomerCount, sub: `共 ${o.customerCount} · 本月+${o.monthNewCustomers}`, icon: Users, color: 'text-indigo-600' },
    { label: '商机管道', value: formatCurrency(o.pipelineAmount), sub: `${o.oppCount} 个商机 · 本月+${o.monthNewOpps}`, icon: Target, color: 'text-emerald-600' },
    { label: '赢单金额', value: formatCurrency(o.wonAmount), sub: '已成交商机', icon: TrendingUp, color: 'text-emerald-600' },
    { label: '订单总额', value: formatCurrency(o.orderTotalAmount), sub: `${o.orderCount} 单 · 本月+${o.monthNewOrders}`, icon: ShoppingCart, color: 'text-sky-600' },
    { label: '已回款', value: formatCurrency(o.totalPaid), sub: `回款率 ${o.collectionRate}%`, icon: Wallet, color: 'text-amber-600' },
    { label: '询盘总数', value: o.inquiryCount, sub: `本月+${o.monthNewInquiries}`, icon: Sparkles, color: 'text-purple-600' },
  ]
  const totalPipelineAmount = data.pipeline.reduce((s, p) => s + p.amount, 0)
  const fs = data.followupStats

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* 简报头部 */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              {data.scope === 'global' ? '全局经营简报' : '我的经营简报'}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              生成于 {new Date(data.generatedAt).toLocaleString('zh-CN')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={data.scope === 'global' ? 'default' : 'secondary'} className="h-6">
              {data.scope === 'global' ? '全局视图' : '个人视图'}
            </Badge>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <Clock className="mr-1 h-4 w-4" /> 刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI 概览 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label}>
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                  <Icon className={cn('h-3.5 w-3.5', k.color)} />
                </div>
                <div className="mt-1 text-lg font-semibold">{k.value}</div>
                <div className="text-[11px] text-muted-foreground">{k.sub}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 销售管道 + 行动项 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4" />销售管道</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.pipeline.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">暂无商机</p>}
            {data.pipeline.map((s) => {
              const pct = totalPipelineAmount > 0 ? (s.amount / totalPipelineAmount) * 100 : 0
              return (
                <div key={s.stage}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{STAGE_LABELS[s.stage] || s.stage}</span>
                    <span className="text-muted-foreground">{s.count} 个 · {formatCurrency(s.amount)}（{pct.toFixed(0)}%）</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', STAGE_COLORS[s.stage] || 'bg-slate-400')} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4" />行动项（跟进任务）</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TaskStat label="待办" value={fs.pending} icon={Clock} color="text-sky-600" />
              <TaskStat label="今日到期" value={fs.todayDue} icon={CalendarClock} color="text-amber-600" />
              <TaskStat label="逾期" value={fs.overdue} icon={AlertTriangle} color={fs.overdue > 0 ? 'text-rose-600' : 'text-muted-foreground'} />
              <TaskStat label="已完成" value={fs.done} icon={CheckCircle2} color="text-emerald-600" />
            </div>
            {(fs.overdue > 0 || fs.todayDue > 0) && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                {fs.overdue > 0 && <div>⚠️ {fs.overdue} 条任务已逾期，请优先处理</div>}
                {fs.todayDue > 0 && <div>📅 {fs.todayDue} 条任务今日到期</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 团队业绩排名（仅全局视图） */}
      {data.scope === 'global' && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><UserCheck className="h-4 w-4" />团队业绩排名</CardTitle></CardHeader>
          <CardContent>
            {data.teamRanking.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">暂无成交订单</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">#</th>
                      <th className="pb-2 px-3 font-medium">销售</th>
                      <th className="pb-2 px-3 font-medium text-right">订单数</th>
                      <th className="pb-2 px-3 font-medium text-right">订单总额</th>
                      <th className="pb-2 px-3 font-medium text-right">已回款</th>
                      <th className="pb-2 pl-3 font-medium text-right">回款率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.teamRanking.map((r, i) => (
                      <tr key={r.salesId} className="border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <Badge variant={i === 0 ? 'default' : 'outline'} className="h-5 w-5 justify-center text-[10px]">{i + 1}</Badge>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium">{r.salesName}</div>
                          <div className="text-[11px] text-muted-foreground">{ROLE_LABELS[r.salesRole as keyof typeof ROLE_LABELS] || r.salesRole || ''}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right">{r.orderCount}</td>
                        <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(r.totalAmount)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600">{formatCurrency(r.totalPaid)}</td>
                        <td className="py-2.5 pl-3 text-right">{r.collectionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 风险预警 */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4" />风险预警（{data.riskAlerts.length}）</CardTitle></CardHeader>
        <CardContent>
          {data.riskAlerts.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">当前无风险预警</p>
          ) : (
            <div className="space-y-1.5">
              {data.riskAlerts.map((a, i) => {
                const st = RISK_STYLES[a.level] || RISK_STYLES.info
                const Icon = st.icon
                return (
                  <div key={i} className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-xs', st.color)}>
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{a.message}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TaskStat({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Clock; color: string }) {
  return (
    <div className="rounded-lg border p-2.5 text-center">
      <Icon className={cn('mx-auto h-4 w-4', color)} />
      <div className="mt-1 text-lg font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}

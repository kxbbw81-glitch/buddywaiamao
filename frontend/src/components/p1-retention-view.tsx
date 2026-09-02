'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Users, AlertTriangle, Clock, Wallet } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { RetentionReport, RetentionRow } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// 修复说明：[P1-台账外]，原因：导航"售后与复购"原命中通用占位提示，现补真实消费视图（后端 /api/retention 已实现复购窗口聚合）。
function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}`
  return '加载失败，请检查权限或后端服务。'
}

function money(value: number) {
  return `USD ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const WINDOW_OPTIONS = [60, 90, 180, 365]
const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'overdue', label: '已逾期' },
  { key: 'near', label: '30天内' },
  { key: 'upcoming', label: '待复购' },
]
const WINDOW_BADGE: Record<string, { tone: 'red' | 'amber' | 'blue'; label: string }> = {
  overdue: { tone: 'red', label: '已逾期' },
  near: { tone: 'amber', label: '临近' },
  upcoming: { tone: 'blue', label: '待复购' },
}

export function RetentionView({ active }: { active: { moduleId: string; subName: string } }) {
  const [windowDays, setWindowDays] = useState(90)
  const [filter, setFilter] = useState('all')
  const [report, setReport] = useState<RetentionReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (days: number) => {
    setLoading(true); setError(null)
    try {
      setReport(await api.retention(`window=${days}`))
    } catch (err) {
      setError(errorText(err)); setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh(windowDays) }, [windowDays, refresh])

  const rows: RetentionRow[] = (report?.rows || []).filter((r) => filter === 'all' || r.window === filter)
  const stats = report?.stats

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <b>{active.subName}</b>
        <div className="text-xs">按客户聚合赢单商机与已交付订单，推算复购窗口（最近成交日 + 消耗周期）；权限按角色数据范围过滤（销售本人 / 经理本团队 / 管理员全量）。</div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}

      {/* 统计卡 */}
      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <Stat icon={Users} label="成交客户" value={stats?.total ?? 0} />
        <Stat icon={AlertTriangle} label="已逾期" value={stats?.overdue ?? 0} highlight={!!stats?.overdue} />
        <Stat icon={Clock} label="30天内复购" value={stats?.near ?? 0} />
        <Stat icon={Wallet} label="累计成交额" value={money(stats?.totalAmount ?? 0)} />
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">复购窗口</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted">消耗周期</span>
              {WINDOW_OPTIONS.map((d) => (
                <button key={d} onClick={() => setWindowDays(d)}
                  className={`rounded-md border px-2 py-0.5 ${windowDays === d ? 'border-brand bg-active font-medium text-brand' : 'border-slate-200 text-muted hover:bg-slate-50'}`}>
                  {d}天
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs">
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`rounded-md border px-2 py-0.5 ${filter === f.key ? 'border-brand bg-active font-medium text-brand' : 'border-slate-200 text-muted hover:bg-slate-50'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" disabled={loading} onClick={() => void refresh(windowDays)}>
              <RefreshCw className="h-3.5 w-3.5" />刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-xs text-muted">统计中…</div> : rows.length ? (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.customerId} className="rounded-lg border border-slate-200 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{r.name}</b>
                    {r.country ? <span className="text-muted">{r.country}</span> : null}
                    <Badge tone={WINDOW_BADGE[r.window]?.tone || 'blue'}>{WINDOW_BADGE[r.window]?.label || r.window}</Badge>
                    <span className="ml-auto text-muted">{r.daysLeft < 0 ? `逾期 ${Math.abs(r.daysLeft)} 天` : `剩余 ${r.daysLeft} 天`}</span>
                  </div>
                  <div className="mt-1 text-slate-600">
                    最近成交 {r.lastDealAt?.slice(0, 10)} · {r.dealCount} 笔 · 累计 {money(r.totalAmount)} · 归属 {r.ownerName}
                    · 复购窗口 {r.repurchaseAt?.slice(0, 10)}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-muted">当前范围内暂无复购窗口数据。</div>}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ icon: Icon, label, value, highlight }: { icon: typeof Users; label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <div className="flex items-center justify-between"><span className="text-muted">{label}</span><Icon className={`h-3.5 w-3.5 ${highlight ? 'text-rose-500' : 'text-slate-400'}`} /></div>
      <div className={`mt-1 text-base font-semibold ${highlight ? 'text-rose-600' : ''}`}>{value}</div>
    </div>
  )
}

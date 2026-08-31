'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Users, Target, ShoppingCart, Wallet, MessageSquare } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { Customer, CustomerProfile } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// 修复说明：[P1-台账外]，原因：导航"客户画像"原命中通用占位提示，现补真实消费视图（后端 /api/customers/:id/profile 已实现聚合）。
function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}`
  return '加载失败，请检查权限或后端服务。'
}

function money(value: number, currency = 'USD') {
  return `${currency} ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STAGE_LABELS: Record<string, string> = {
  NEW: '新建', QUOTED: '已报价', SAMPLE: '样品', NEGOTIATION: '谈判中', WON: '赢单', LOST: '输单',
}
const STAGE_BAR: Record<string, string> = {
  NEW: 'bg-slate-300', QUOTED: 'bg-sky-400', SAMPLE: 'bg-indigo-400', NEGOTIATION: 'bg-amber-400', WON: 'bg-emerald-500', LOST: 'bg-rose-400',
}

export function CustomerProfileView({ active }: { active: { moduleId: string; subName: string } }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.customers('pageSize=200').then((res) => {
      setCustomers(res.items)
      if (res.items[0]) setCustomerId(res.items[0].id)
    }).catch((err) => setError(errorText(err)))
  }, [])

  const refresh = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      setProfile(await api.customerProfile(id))
    } catch (err) {
      setError(errorText(err)); setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (customerId) void refresh(customerId) }, [customerId, refresh])

  const o = profile?.opportunityStats
  const ord = profile?.orderStats

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <b>{active.subName}</b>
        <div className="text-xs">按客户聚合商机阶段、订单回款、联系人与沟通时间线；权限按角色数据范围过滤（销售本人 / 经理本团队 / 管理员全量）。</div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-sm">选择客户</CardTitle>
          <select className="rounded-md border border-slate-200 px-2 py-1 text-xs" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.country ? ` · ${c.country}` : ''}</option>)}
          </select>
        </CardHeader>
      </Card>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}

      {!profile && !loading && !error ? <div className="text-xs text-muted">请选择客户查看画像。</div> : null}
      {loading ? <div className="text-xs text-muted">加载画像…</div> : null}

      {profile && !loading ? (
        <>
          {/* 基本信息 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-slate-400" />
                  <div>
                    <div className="font-semibold">{profile.customer.name}</div>
                    <div className="text-xs text-muted">{profile.customer.country || '未知地区'}{profile.customer.website ? ` · ${profile.customer.website}` : ''}</div>
                  </div>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>归属：{profile.customer.owner?.name || '未分配'}</div>
                  <div>建档：{profile.customer.createdAt?.slice(0, 10)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI */}
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <Kpi icon={Target} label="商机总数" value={o?.total ?? 0} sub={`赢单 ${o?.wonCount ?? 0}`} />
            <Kpi icon={ShoppingCart} label="订单总额" value={money(ord?.totalAmount ?? 0)} sub={`${ord?.total ?? 0} 单`} />
            <Kpi icon={Wallet} label="回款率" value={`${ord?.collectionRate ?? 0}%`} sub={`已回款 ${money(ord?.totalPaid ?? 0)}`} />
            <Kpi icon={Users} label="联系人" value={profile.contacts.length} sub={`沟通 ${profile.timeline.length} 条`} />
          </div>

          {/* 商机阶段分布 + 订单回款 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4" />商机阶段分布</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {o?.stageBreakdown.length ? o.stageBreakdown.map((s) => {
                  const pct = (o?.totalAmount ?? 0) > 0 ? (s.amount / (o?.totalAmount ?? 1)) * 100 : 0
                  return (
                    <div key={s.stage}>
                      <div className="flex items-center justify-between text-xs"><span>{STAGE_LABELS[s.stage] || s.stage}</span><span className="text-muted">{s.count} 个 · {money(s.amount)}（{pct.toFixed(0)}%）</span></div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${STAGE_BAR[s.stage] || 'bg-slate-300'}`} style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                }) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-muted">暂无商机</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4" />订单回款</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs"><span className="text-muted">总回款率</span><b className="text-emerald-600">{ord?.collectionRate ?? 0}%</b></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${ord?.collectionRate ?? 0}%` }} /></div>
                <div className="flex items-center justify-between text-xs text-muted"><span>已回款 {money(ord?.totalPaid ?? 0)}</span><span>待收 {money(ord?.outstanding ?? 0)}</span></div>
                <div className="mt-2 space-y-1 border-t pt-2">
                  {ord?.statusBreakdown.map((s) => (
                    <div key={s.status} className="flex items-center justify-between text-xs"><span>{s.status}</span><span className="text-muted">{s.count} 单 · {money(s.amount)}</span></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 联系人 + 沟通时间线 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">联系人（{profile.contacts.length}）</CardTitle></CardHeader>
              <CardContent>
                {profile.contacts.length ? profile.contacts.map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                    <div className="flex items-center gap-2"><b>{c.name}</b>{c.title ? <Badge tone="blue">{c.title}</Badge> : null}</div>
                    <div className="mt-1 text-muted">{c.email || ''}{c.email && c.phone ? ' · ' : ''}{c.phone || ''}</div>
                  </div>
                )) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-muted">暂无联系人</div>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4" />沟通时间线（{profile.timeline.length}）</CardTitle></CardHeader>
              <CardContent>
                {profile.timeline.length ? profile.timeline.slice(0, 12).map((e) => (
                  <div key={e.id} className="flex gap-2 border-b border-slate-100 py-1.5 text-xs last:border-0">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2"><b>{e.type}</b><span className="shrink-0 text-[10px] text-muted">{e.occurredAt?.slice(0, 10)}</span></div>
                      {e.summary ? <div className="text-slate-600">{e.summary}</div> : null}
                      <div className="text-[10px] text-muted">— {e.userName}</div>
                    </div>
                  </div>
                )) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-muted">暂无沟通记录</div>}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Target; label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <div className="flex items-center justify-between"><span className="text-muted">{label}</span><Icon className="h-3.5 w-3.5 text-slate-400" /></div>
      <div className="mt-1 text-base font-semibold">{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  )
}

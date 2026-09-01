'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { Customer, CustomerProfile, ProductRecommendation, RepurchaseStatus } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// 修复说明：[P1-台账外]，原因：客户画像与售后复购入口之前只显示未接入说明；改为消费最小确定性后端聚合，不把评分或产品候选当作自动报价、审批或外发结论。
function errorText(error: unknown) { return error instanceof ApiError ? `${error.status} ${error.code}：${error.message}` : '操作失败，请检查权限或后端服务。' }

export function CustomerLifecycleView({ active }: { active: { moduleId: string; subName: string } }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([])
  const [repurchase, setRepurchase] = useState<RepurchaseStatus | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const list = await api.customers('pageSize=50'); setCustomers(list.items)
      const id = customerId || list.items[0]?.id || ''
      if (!id) { setProfile(null); setRecommendations([]); setRepurchase(null); return }
      if (id !== customerId) setCustomerId(id)
      const [nextProfile, nextRecommendations, nextRepurchase] = await Promise.all([api.customerProfile(id), api.customerProductRecommendations(id, query), api.customerRepurchase(id)])
      setProfile(nextProfile); setRecommendations(nextRecommendations.items); setRepurchase(nextRepurchase)
    } catch (err) { setError(errorText(err)) } finally { setLoading(false) }
  }, [customerId, query])

  useEffect(() => { void refresh() }, [refresh])

  async function createRepurchaseFollowUp() {
    if (!customerId) return
    setLoading(true); setError(null)
    try { await api.createRepurchaseFollowUp(customerId, '已签收订单客户的人工复购跟进。'); await refresh() } catch (err) { setError(errorText(err)); setLoading(false) }
  }

  return <div className="space-y-5">
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900"><b>{active.subName}</b><div className="text-xs">评分、产品候选和复购建议均为确定性辅助结果；报价、MOQ、利润和审批规则不受此页面影响。</div></div>
    {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
    <Card><CardHeader className="flex items-center justify-between"><CardTitle className="text-sm">客户选择</CardTitle><div className="flex gap-2"><select className="rounded-md border border-slate-200 px-2 py-1 text-xs" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">请选择客户</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><Button size="sm" variant="secondary" disabled={loading} onClick={() => void refresh()}><RefreshCw className="h-3.5 w-3.5" />刷新</Button></div></CardHeader></Card>
    {profile ? <><div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="p-4"><div className="text-xs text-muted">客户评分</div><div className="mt-1 text-2xl font-semibold">{profile.profile.score}<span className="text-sm text-muted"> / 100</span></div><Badge tone={profile.profile.level === 'HIGH' ? 'purple' : profile.profile.level === 'MEDIUM' ? 'blue' : 'gray'}>{profile.profile.level}</Badge></CardContent></Card><Card><CardContent className="p-4 text-xs leading-6">资料完整度：{profile.profile.factors.profileCompletion}<br />商业活跃度：{profile.profile.factors.commercialActivity}<br />联系人 / 商机 / 订单：{profile.counts.contacts} / {profile.counts.opportunities} / {profile.counts.orders}</CardContent></Card><Card><CardContent className="p-4 text-xs leading-6">缺失资料：{profile.profile.missing.length ? profile.profile.missing.join('、') : '无'}<br />签收订单：{repurchase?.deliveredOrders ?? 0}<br />{repurchase?.recommendation}</CardContent></Card></div>
    <Card><CardHeader className="flex items-center justify-between"><CardTitle className="text-sm">产品候选推荐</CardTitle><input className="w-44 rounded-md border border-slate-200 px-2 py-1 text-xs" value={query} placeholder="需求关键词" onChange={(event) => setQuery(event.target.value)} /></CardHeader><CardContent className="space-y-2">{recommendations.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-3 text-xs"><b>{item.sku} · {item.name}</b><div className="mt-1 text-muted">{item.reason}</div></div>)}{!recommendations.length ? <div className="text-xs text-muted">暂无匹配候选，请调整关键词或维护产品资料。</div> : null}</CardContent></Card>
    <Card><CardHeader><CardTitle className="text-sm">售后与复购</CardTitle></CardHeader><CardContent className="flex items-center justify-between gap-3 text-xs"><span>{repurchase?.recommendation}</span><Button size="sm" disabled={loading || !repurchase?.eligible} onClick={() => void createRepurchaseFollowUp()}>创建人工复购跟进</Button></CardContent></Card></> : null}
  </div>
}

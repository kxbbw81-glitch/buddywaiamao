'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Users, DollarSign, TrendingUp, Sparkles, Phone, Mail, Building2,
  Globe, Tag, Crown, Activity as ActivityIcon, Target, ShoppingCart,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ROLE_LABELS } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'

// ============ 数据类型 ============
interface Contact { id: string; name: string; email?: string | null; phone?: string | null; whatsapp?: string | null; position?: string | null; isDecisionMaker: boolean; notes?: string | null }
interface ProfileCustomer {
  id: string; companyName: string; companyNameEn?: string | null; country?: string | null; city?: string | null;
  website?: string | null; industry?: string | null; customerLevel: string; source: string; status: string;
  notes?: string | null; aiScore: number; lastContactAt?: string | null; createdAt: string;
  owner?: { id: string; name: string; email: string; primaryRole: string } | null;
  tags: string[]; aiProfile: Record<string, unknown> | null;
}
interface OppBreakdown { stage: string; count: number; amount: number }
interface ProfileOpp { id: string; title: string; stage: string; amount: number; currency: string; probability: number; expectedCloseDate?: string | null; closedAt?: string | null; lostReason?: string | null; ownerName: string; createdAt: string; updatedAt: string }
interface OrderStatusBreakdown { status: string; count: number; amount: number }
interface ProfileOrder { id: string; orderNo: string; status: string; totalAmount: number; currency: string; paidAmount: number; paymentTerm?: string | null; deliveryDate?: string | null; createdAt: string; updatedAt: string }
interface ProfileActivity { id: string; type: string; subject?: string | null; content?: string | null; userName: string; createdAt: string }
interface CustomerProfile {
  customer: ProfileCustomer
  contacts: Contact[]
  decisionMakers: Contact[]
  opportunityStats: { total: number; totalAmount: number; wonCount: number; wonAmount: number; stageBreakdown: OppBreakdown[] }
  opportunities: ProfileOpp[]
  orderStats: { total: number; totalAmount: number; totalPaid: number; outstanding: number; collectionRate: number; statusBreakdown: OrderStatusBreakdown[] }
  orders: ProfileOrder[]
  samples: { id: string; status: string; createdAt: string }[]
  activities: ProfileActivity[]
}

const STAGE_LABELS: Record<string, string> = {
  prospect: '潜在', qualified: '已验证', proposal: '方案报价', negotiation: '谈判中', won: '赢单', lost: '输单',
}
const STAGE_COLORS: Record<string, string> = {
  prospect: 'bg-slate-400', qualified: 'bg-sky-400', proposal: 'bg-indigo-400', negotiation: 'bg-amber-400', won: 'bg-emerald-500', lost: 'bg-rose-400',
}
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待确认', confirmed: '已确认', in_production: '生产中', ready: '待发货', shipped: '已发货', completed: '已完成', cancelled: '已取消',
}
const ACTIVITY_LABELS: Record<string, string> = {
  follow_up: '跟进', email: '邮件', call: '电话', meeting: '会议', note: '备注', system: '系统',
}

// ============ API 封装 ============
async function api<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    const json = await res.json()
    if (!json.success) { toast.error(json.error || '加载失败'); return null }
    return json.data as T
  } catch {
    toast.error('网络错误'); return null
  }
}

// ============ 主视图 ============
export function CustomerProfileView() {
  const [customers, setCustomers] = useState<{ id: string; companyName: string }[]>([])
  const [customerId, setCustomerId] = useState<string>('')
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api<{ items: { id: string; companyName: string }[] }>('/api/customers?limit=200').then((d) => {
      if (d?.items) {
        setCustomers(d.items)
        if (d.items[0] && !customerId) setCustomerId(d.items[0].id)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadProfile = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    const d = await api<CustomerProfile>(`/api/customer-profile?customerId=${id}`)
    setProfile(d)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (customerId) loadProfile(customerId)
  }, [customerId, loadProfile])

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* 顶部：客户选择器 */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-emerald-600" /> 客户画像
          </div>
          <div className="min-w-[260px] flex-1">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="选择客户查看画像" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">加载客户画像…</CardContent></Card>
      )}

      {!loading && !profile && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">请在上方选择客户</CardContent></Card>
      )}

      {profile && !loading && <ProfileBody profile={profile} />}
    </div>
  )
}

// ============ 画像主体 ============
function ProfileBody({ profile }: { profile: CustomerProfile }) {
  const { customer, opportunityStats: opp, orderStats: ord } = profile
  const kpis = [
    { label: '商机总数', value: opp.total, sub: `赢单 ${opp.wonCount}`, icon: Target, color: 'text-indigo-600' },
    { label: '商机金额', value: formatCurrency(opp.totalAmount), sub: `赢单 ${formatCurrency(opp.wonAmount)}`, icon: TrendingUp, color: 'text-emerald-600' },
    { label: '订单总额', value: formatCurrency(ord.totalAmount), sub: `已回款 ${formatCurrency(ord.totalPaid)}`, icon: ShoppingCart, color: 'text-sky-600' },
    { label: '回款率', value: `${ord.collectionRate}%`, sub: `待收 ${formatCurrency(ord.outstanding)}`, icon: DollarSign, color: 'text-amber-600' },
    { label: 'AI 评分', value: customer.aiScore ? customer.aiScore.toFixed(1) : '—', sub: '客户质量评估', icon: Sparkles, color: 'text-purple-600' },
  ]

  return (
    <>
      {/* 基本信息 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">{customer.companyName}</CardTitle>
                {customer.companyNameEn && <span className="text-sm text-muted-foreground">{customer.companyNameEn}</span>}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {customer.country && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{customer.country}{customer.city ? ` · ${customer.city}` : ''}</span>}
                {customer.industry && <span>行业：{customer.industry}</span>}
                <span>来源：{customer.source}</span>
                {customer.owner && <span>归属：{customer.owner.name}（{ROLE_LABELS[customer.owner.primaryRole as keyof typeof ROLE_LABELS] || customer.owner.primaryRole}）</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant="secondary" className="h-6">{customer.customerLevel}级客户</Badge>
              <Badge variant={customer.status === 'active' ? 'default' : 'outline'} className="h-5 text-[10px]">{customer.status === 'active' ? '活跃' : customer.status === 'lost' ? '流失' : '未活跃'}</Badge>
            </div>
          </div>
          {customer.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Tag className="h-3 w-3 text-muted-foreground" />
              {customer.tags.map((t) => <Badge key={t} variant="outline" className="h-5 px-1.5 text-[10px]">{t}</Badge>)}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 空态引导：所选客户无业务数据时，提示切换而非一片 0 */}
      {opp.total === 0 && ord.total === 0 && profile.contacts.length === 0 && profile.activities.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <ActivityIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <b>该客户暂无业务数据</b>——无商机、订单、联系人和沟通记录。可在上方客户选择器中切换到其他客户查看完整画像。
          </div>
        </div>
      )}

      {/* KPI 卡 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 商机阶段分布 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4" />商机阶段分布</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {opp.stageBreakdown.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">暂无商机</p>}
            {opp.stageBreakdown.map((s) => {
              const pct = opp.totalAmount > 0 ? (s.amount / opp.totalAmount) * 100 : 0
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

        {/* 订单回款 */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><DollarSign className="h-4 w-4" />订单回款</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">总回款率</span>
              <span className="font-semibold text-emerald-600">{ord.collectionRate}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${ord.collectionRate}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>已回款 {formatCurrency(ord.totalPaid)}</span><span>待收 {formatCurrency(ord.outstanding)}</span>
            </div>
            <div className="mt-2 space-y-1 border-t pt-2">
              {ord.statusBreakdown.map((s) => (
                <div key={s.status} className="flex items-center justify-between text-xs">
                  <span>{ORDER_STATUS_LABELS[s.status] || s.status}</span>
                  <span className="text-muted-foreground">{s.count} 单 · {formatCurrency(s.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 决策人 + 联系人 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Crown className="h-4 w-4" />联系人（{profile.contacts.length}）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {profile.contacts.map((c) => (
              <div key={c.id} className={cn('rounded-lg border p-3', c.isDecisionMaker && 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950')}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.isDecisionMaker && <Badge variant="secondary" className="h-5 text-[10px]">决策人</Badge>}
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {c.position && <div>{c.position}</div>}
                  {c.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</div>}
                  {c.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</div>}
                  {c.whatsapp && <div>WA: {c.whatsapp}</div>}
                </div>
              </div>
            ))}
            {profile.contacts.length === 0 && <p className="text-xs text-muted-foreground">暂无联系人</p>}
          </div>
        </CardContent>
      </Card>

      {/* 订单列表 + 活动时间线 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">近期订单（{profile.orders.length}）</CardTitle></CardHeader>
          <CardContent>
            {profile.orders.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">暂无订单</p> : (
              <div className="space-y-1.5">
                {profile.orders.slice(0, 8).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium">{o.orderNo}</div>
                      <div className="text-muted-foreground">{new Date(o.createdAt).toLocaleDateString('zh-CN')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(o.totalAmount)}</div>
                      <div className="text-muted-foreground">已付 {formatCurrency(o.paidAmount)} · {ORDER_STATUS_LABELS[o.status] || o.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><ActivityIcon className="h-4 w-4" />活动时间线（{profile.activities.length}）</CardTitle></CardHeader>
          <CardContent>
            {profile.activities.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">暂无活动记录</p> : (
              <div className="space-y-2">
                {profile.activities.slice(0, 12).map((a) => (
                  <div key={a.id} className="flex gap-2.5">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{ACTIVITY_LABELS[a.type] || a.type}{a.subject ? ` · ${a.subject}` : ''}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                      {a.content && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>}
                      <div className="text-[10px] text-muted-foreground">— {a.userName}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

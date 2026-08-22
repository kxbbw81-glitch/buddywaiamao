'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  DollarSign, Users, ShoppingCart, TrendingUp, Wallet, Percent,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROLE_LABELS, ORDER_STATUS_LABELS } from '@/lib/types'
import { formatCurrency, cn } from '@/lib/utils'

// ============ 数据类型 ============
interface CommissionRow {
  salesId: string
  salesName: string
  salesRole: string
  department: string
  orderCount: number
  totalAmount: number
  totalPaid: number
  outstanding: number
  collectionRate: number
  commission: number
  potentialCommission: number
}
interface CommissionStats {
  salesCount: number
  orderCount: number
  totalAmount: number
  totalPaid: number
  outstanding: number
  totalCommission: number
  collectionRate: number
  appliedRate: number
}
interface CommissionData { rows: CommissionRow[]; stats: CommissionStats }

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
export function CommissionView() {
  const [rate, setRate] = useState('1.5')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<CommissionData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (r: string, f: string, t: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    const rateNum = parseFloat(r) / 100
    if (!Number.isNaN(rateNum)) params.set('rate', String(rateNum))
    if (f) params.set('from', f)
    if (t) params.set('to', t)
    const d = await api<CommissionData>(`/api/commission?${params.toString()}`)
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load(rate, from, to) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = data?.stats
  const kpis = stats ? [
    { label: '销售人数', value: stats.salesCount, icon: Users, color: 'text-indigo-600' },
    { label: '成交订单', value: stats.orderCount, icon: ShoppingCart, color: 'text-sky-600' },
    { label: '订单总额', value: formatCurrency(stats.totalAmount), icon: TrendingUp, color: 'text-emerald-600' },
    { label: '已回款', value: formatCurrency(stats.totalPaid), sub: `回款率 ${stats.collectionRate}%`, icon: Wallet, color: 'text-amber-600' },
    { label: '预计提成', value: formatCurrency(stats.totalCommission), sub: `按 ${stats.appliedRate * 100}% 已回款核算`, icon: DollarSign, color: 'text-purple-600' },
  ] : []

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* 顶部：筛选条件 */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">提成率（%）</Label>
            <Input
              type="number" step="0.1" min="0" max="50"
              value={rate} onChange={(e) => setRate(e.target.value)}
              className="w-24"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">起始日期</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">截止日期</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button onClick={() => load(rate, from, to)} disabled={loading}>
            <Percent className="mr-1 h-4 w-4" /> 核算
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">
            提成基于<b className="text-foreground">已回款金额</b>计算；潜在提成基于订单总额（含未回款）
          </div>
        </CardContent>
      </Card>

      {/* KPI 卡 */}
      {kpis.length > 0 && (
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
                  {'sub' in k && k.sub && <div className="text-[11px] text-muted-foreground">{k.sub}</div>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 对账表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">销售提成对账明细</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">核算中…</div>
          ) : !data || data.rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">所选范围内无成交订单</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">销售</th>
                    <th className="pb-2 px-3 font-medium text-right">订单数</th>
                    <th className="pb-2 px-3 font-medium text-right">订单总额</th>
                    <th className="pb-2 px-3 font-medium text-right">已回款</th>
                    <th className="pb-2 px-3 font-medium text-right">待收</th>
                    <th className="pb-2 px-3 font-medium text-right">回款率</th>
                    <th className="pb-2 px-3 font-medium text-right">预计提成</th>
                    <th className="pb-2 pl-3 font-medium text-right">潜在提成</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.salesId} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{r.salesName}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {ROLE_LABELS[r.salesRole as keyof typeof ROLE_LABELS] || r.salesRole || ''}
                          {r.department ? ` · ${r.department}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">{r.orderCount}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(r.totalAmount)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-600">{formatCurrency(r.totalPaid)}</td>
                      <td className="py-2.5 px-3 text-right text-amber-600">{formatCurrency(r.outstanding)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge variant={r.collectionRate >= 80 ? 'default' : r.collectionRate >= 50 ? 'secondary' : 'outline'} className="h-5">
                          {r.collectionRate}%
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-purple-600">{formatCurrency(r.commission)}</td>
                      <td className="py-2.5 pl-3 text-right text-muted-foreground">{formatCurrency(r.potentialCommission)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2.5 pr-3">合计</td>
                    <td className="py-2.5 px-3 text-right">{data.stats.orderCount}</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(data.stats.totalAmount)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600">{formatCurrency(data.stats.totalPaid)}</td>
                    <td className="py-2.5 px-3 text-right text-amber-600">{formatCurrency(data.stats.outstanding)}</td>
                    <td className="py-2.5 px-3 text-right">{data.stats.collectionRate}%</td>
                    <td className="py-2.5 px-3 text-right text-purple-600">{formatCurrency(data.stats.totalCommission)}</td>
                    <td className="py-2.5 pl-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        说明：提成率可在顶部调整后点击「核算」重算；预计提成 = 该销售已回款 × 提成率，潜在提成 = 订单总额 × 提成率。
        取消的订单不计入。本表为辅助核算工具，实际发放以财务终审为准。
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { CommissionReport, CommissionRecord } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// 修复说明：[P1-台账外]，原因：导航"提成与对账"原命中通用占位提示，而后端 /api/commissions 与 /api/commission-records 已存在且 smoke 通过；补真实消费视图。
function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}`
  return '操作失败，请检查权限或后端服务。'
}

function money(value: number, currency: string) {
  return `${currency} ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function CommissionView({ active }: { active: { moduleId: string; subName: string } }) {
  const [report, setReport] = useState<CommissionReport | null>(null)
  const [records, setRecords] = useState<CommissionRecord[]>([])
  const [rate, setRate] = useState('0.02')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rateValue = Number(rate)
      const rateParam = Number.isFinite(rateValue) && rateValue >= 0 && rateValue <= 0.5 ? `rate=${rateValue}` : ''
      const [reportResult, recordResult] = await Promise.all([
        api.commissions(rateParam),
        api.commissionRecords('pageSize=15'),
      ])
      setReport(reportResult)
      setRecords(recordResult.items)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [rate])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <b>{active.subName}</b>
        <div className="text-xs">提成仅基于财务已确认（CONFIRMED）回款；报表按当前角色数据范围过滤（销售本人 / 经理本团队 / 财务与管理员全量）。结算与审批属写操作，遵循后端期间与角色门禁。</div>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-sm">提成报表</CardTitle>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-muted">提成率
              <input className="w-20 rounded-md border border-slate-200 px-2 py-1 text-xs" value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" />
            </label>
            <Button size="sm" variant="secondary" disabled={loading} onClick={() => void refresh()}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {report ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                <div className="rounded-lg border border-slate-200 p-2"><div className="text-muted">确认回款</div><b>{money(report.stats.confirmedPaidAmount, 'USD')}</b></div>
                <div className="rounded-lg border border-slate-200 p-2"><div className="text-muted">提成金额</div><b>{money(report.stats.commissionAmount, 'USD')}</b></div>
                <div className="rounded-lg border border-slate-200 p-2"><div className="text-muted">潜在提成</div><b>{money(report.stats.potentialCommission, 'USD')}</b></div>
                <div className="rounded-lg border border-slate-200 p-2"><div className="text-muted">回款率</div><b>{report.stats.collectionRate}%</b></div>
              </div>
              {report.stats.byCurrency?.length > 1 ? (
                <div className="rounded-lg bg-slate-50 p-2 text-xs text-muted">分币种：{report.stats.byCurrency.map((row) => `${row.currency} 确认 ${row.confirmedPaidAmount} / 提成 ${row.commissionAmount}`).join(' · ')}</div>
              ) : null}
              <div className="space-y-2">
                {report.rows.length ? report.rows.map((row) => (
                  <div key={`${row.salesId}:${row.currency}`} className="rounded-lg border border-slate-200 p-3 text-xs">
                    <div className="flex items-center gap-2"><b>{row.sales.name || row.salesId}</b><Badge tone="blue">{row.currency}</Badge><span className="ml-auto text-muted">订单 {row.orderCount} · 回款率 {row.collectionRate}%</span></div>
                    <div className="mt-1 text-slate-600">订单额 {money(row.totalAmount, row.currency)} · 确认回款 {money(row.confirmedPaidAmount, row.currency)} · 提成 {money(row.commissionAmount, row.currency)} · 未回款 {money(row.outstandingAmount, row.currency)}</div>
                  </div>
                )) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-muted">当前范围内暂无提成数据。</div>}
              </div>
            </>
          ) : <div className="text-xs text-muted">加载中…</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">结算记录</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {records.length ? records.map((record) => (
            <div key={record.id} className="rounded-lg border border-slate-200 p-3 text-xs">
              <div className="flex items-center gap-2">
                <b>{record.sales?.name || record.salesId}</b>
                <Badge tone={record.status === 'APPROVED' ? 'purple' : record.status === 'REJECTED' ? 'red' : 'amber'}>{record.status}</Badge>
                <span className="ml-auto text-muted">{record.periodStart ? `${record.periodStart.slice(0, 10)} ~ ${record.periodEnd?.slice(0, 10)}` : '全量期间'}</span>
              </div>
              <div className="mt-1 text-slate-600">费率 {(record.rate * 100).toFixed(2)}% · 确认回款 {money(record.confirmedPaidAmount, record.currency)} · 提成 {money(record.commissionAmount, record.currency)} · 订单 {record.orderCount}</div>
            </div>
          )) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-muted">暂无结算记录。</div>}
        </CardContent>
      </Card>
    </div>
  )
}

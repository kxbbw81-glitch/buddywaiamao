'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { TimelineEvent } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// 修复说明：[P1-台账外]，原因：导航"沟通时间线"原命中通用占位提示，而后端 /api/timeline 已存在且 smoke 通过；补真实消费视图。
function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}`
  return '操作失败，请检查权限或后端服务。'
}

type Customer = { id: string; name: string }

export function TimelineView({ active }: { active: { moduleId: string; subName: string } }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (targetPage = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: '15' })
      if (customerId) params.set('customerId', customerId)
      const [result, customerList] = await Promise.all([
        api.timeline(params.toString()),
        customerId ? Promise.resolve(null) : api.customers('pageSize=50'),
      ])
      setEvents(result.items)
      setTotal(result.total)
      setPage(result.page)
      if (customerList) setCustomers(customerList.items)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => { void refresh(1) }, [refresh])

  const totalPages = Math.max(1, Math.ceil(total / 15))

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900">
        <b>{active.subName}</b>
        <div className="text-xs">聚合邮件、WhatsApp、电话、会议、备注等沟通留痕；数据来自后端 CommunicationEvent，按当前角色数据范围过滤。</div>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-sm">沟通记录{total ? `（共 ${total} 条）` : ''}</CardTitle>
          <div className="flex items-center gap-2">
            <select className="rounded-md border border-slate-200 px-2 py-1 text-xs" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">全部客户</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
            <Button size="sm" variant="secondary" disabled={loading} onClick={() => void refresh(1)}><RefreshCw className="h-3.5 w-3.5" />刷新</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.length ? events.map((event) => (
            <div key={event.id} className="rounded-lg border border-slate-200 p-3 text-xs leading-5">
              <div className="flex items-center gap-2">
                <Badge tone={event.direction === 'INBOUND' ? 'blue' : 'gray'}>{event.type}</Badge>
                <span className="text-muted">{event.direction}</span>
                <b className="text-slate-700">{event.customer?.name || event.customerId}</b>
                {event.opportunity ? <span className="text-muted">/ {event.opportunity.name}</span> : null}
                <span className="ml-auto text-muted">{new Date(event.occurredAt).toLocaleString()}</span>
              </div>
              {event.summary ? <p className="mt-1 text-slate-700">{event.summary}</p> : null}
            </div>
          )) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-muted">当前范围内暂无沟通记录。</div>}
        </CardContent>
      </Card>
      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => void refresh(page - 1)}>上一页</Button>
          <span className="text-muted">{page} / {totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages || loading} onClick={() => void refresh(page + 1)}>下一页</Button>
        </div>
      ) : null}
    </div>
  )
}

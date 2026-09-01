'use client'

import type { DashboardData } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DashboardView({ dashboard }: { dashboard: DashboardData | null }) {
  if (!dashboard) {
    return (
      <Card>
        <CardContent className="text-sm leading-7 text-muted">
          工作台数据未加载。请确认已登录，且后端 `/api/dashboard` 可用。
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <Card key={metric.id}>
            <CardContent>
              <div className="text-xs text-muted">{metric.label}</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{metric.value}</div>
              <div className="mt-2 text-[11px] text-slate-400">scope: {metric.scope}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {dashboard.business ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>基础经营看板</CardTitle>
            <Badge tone="amber">{dashboard.business.rangeLabel}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">{dashboard.business.note}</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[...dashboard.business.funnel, ...dashboard.business.revenue, ...dashboard.business.operations, ...dashboard.business.risks].map((item) => (
                <div key={item.id} className="rounded-lg border border-line bg-slate-50 p-3">
                  <div className="text-xs text-muted">{item.label}</div>
                  <div className="mt-2 text-xl font-semibold text-ink">{item.value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>角色工作台</CardTitle>
          <Badge tone="blue">{dashboard.aiMode}</Badge>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {dashboard.actionCards.map((card) => (
            <div key={card.id} className="rounded-lg border border-line bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <b>{card.title}</b>
                <Badge tone={card.status === 'ACTION_REQUIRED' ? 'red' : 'gray'}>{card.count}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted">{card.status} · {card.href}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

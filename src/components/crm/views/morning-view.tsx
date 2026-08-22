'use client'

import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Presentation, ShieldAlert, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCRMStore } from '@/store/use-crm-store'

interface RiskAlert {
  type: string
  level: 'danger' | 'warning' | 'info'
  message: string
}

interface DashboardData {
  kpis: {
    todayInquiries: number
    pendingFollow: number
    overduePaymentsCount: number
    expiringQuotesCount: number
    pendingSamples: number
  }
  riskAlerts: RiskAlert[]
}

/** 从「客户名 逾期款项 $12,000」消息中解析金额 */
function parseOverdueAmount(message: string): number {
  const m = message.match(/\$([\d,]+)/)
  return m ? Number(m[1].replace(/,/g, '')) : 0
}

export function MorningView() {
  const { currentUser } = useCRMStore()

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', 'morning-view'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard')
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '加载失败')
      return json.data
    },
    staleTime: 60000,
  })

  const kpis = data?.kpis
  const alerts = data?.riskAlerts || []
  const overdueAlerts = alerts.filter((a) => a.type === 'overdue_payment')
  const lowMarginAlerts = alerts.filter((a) => a.type === 'low_margin')
  const expiringAlerts = alerts.filter((a) => a.type === 'expiring_quotation')
  const highRiskAmount = overdueAlerts.reduce((s, a) => s + parseOverdueAmount(a.message), 0)

  const conclusion = (() => {
    const parts: string[] = []
    if (overdueAlerts.length) parts.push(`先催 ${overdueAlerts.length} 笔逾期回款`)
    if (lowMarginAlerts.length) parts.push(`再处理 ${lowMarginAlerts.length} 个低毛利报价审批`)
    if (expiringAlerts.length) parts.push(`跟进 ${expiringAlerts.length} 个即将到期报价`)
    if (kpis?.todayInquiries) parts.push(`响应今日 ${kpis.todayInquiries} 条新询盘`)
    if (!parts.length) return '当前无高风险事项，按计划推进重点客户与报价跟进'
    return parts.join('，')
  })()

  const todayActions =
    (kpis?.overduePaymentsCount || 0) +
    (kpis?.expiringQuotesCount || 0) +
    (kpis?.todayInquiries || 0) +
    lowMarginAlerts.length

  const now = new Date()
  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日`

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Presentation className="h-5 w-5 text-blue-700" /> 晨会四卡 · {dateLabel} 09:00
          </CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            主管 / 管理层视角：开晨会前 AI 已生成优先级结论、高风险金额、待协同事项与今日动作，会前 10 分钟扫完。
            {currentUser && ` 当前视角：${currentUser.name}。`}
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !kpis ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">优先级结论</div>
                <div className="mt-1.5 text-sm font-medium leading-relaxed">{conclusion}</div>
                <div className="mt-2 text-xs text-purple-700">
                  AI 结论 · 依据 {alerts.length + 4} 项数据
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">高风险金额</div>
                <div className={`mt-1.5 text-2xl font-bold ${highRiskAmount > 0 ? 'text-red-600' : 'text-foreground'}`}>
                  {highRiskAmount > 0 ? `$${Math.round(highRiskAmount / 1000)}K` : '$0'}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {kpis.overduePaymentsCount} 笔逾期应收
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">待协同</div>
                <div className="mt-1.5 text-2xl font-bold">{kpis.pendingSamples}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  样品 / 交期确认 ×{kpis.pendingSamples} · 财务确认待办 ×{kpis.overduePaymentsCount}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">今日动作</div>
                <div className="mt-1.5 text-2xl font-bold">{todayActions}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {kpis.todayInquiries} 个新询盘 · {lowMarginAlerts.length} 个审批 · {kpis.expiringQuotesCount} 个到期报价
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" /> 客户动态明细
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4 text-emerald-600" />
              暂无高风险客户动态——逾期应收、低毛利报价与到期报价会实时进入此列表。
            </div>
          ) : (
            <div className="space-y-1">
              {alerts.map((a, i) => (
                <div key={`${a.type}-${i}`} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      a.level === 'danger' ? 'bg-[#E24B4A]' : a.level === 'warning' ? 'bg-[#EFA01F]' : 'bg-[#185FA5]'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{a.message}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {a.type === 'overdue_payment' && '今日动作：财务发起催收提醒 + 负责人邮件同步跟进'}
                      {a.type === 'low_margin' && '今日动作：晨会同步低毛利报价，走审批中心复核'}
                      {a.type === 'expiring_quotation' && '今日动作：联系客户确认报价意向，避免过期失效'}
                      {a.type === 'unassigned_inquiry' && '今日动作：完成询盘分配，避免响应超时'}
                    </div>
                  </div>
                  {a.level === 'danger' && <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

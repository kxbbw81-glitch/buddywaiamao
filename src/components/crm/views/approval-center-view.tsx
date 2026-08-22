'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, ClipboardCheck, History, ShieldAlert, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/crm/empty-state'
import { useCRMStore } from '@/store/use-crm-store'

interface ApprovalCard {
  id: string
  type: 'LOW_MARGIN' | 'DISCOUNT' | 'RELEASE'
  typeLabel: string
  title: string
  aiRisk?: string
  meta: string
  requester: string
  createdAt?: string
}

interface ApprovalRecord {
  id: string
  type: string
  refId: string
  status: string
  aiRisk?: string | null
  updatedAt: string
}

const TYPE_STYLE: Record<ApprovalCard['type'], string> = {
  LOW_MARGIN: 'bg-blue-50 text-blue-800 border-blue-200',
  DISCOUNT: 'bg-amber-50 text-amber-800 border-amber-200',
  RELEASE: 'bg-teal-50 text-teal-800 border-teal-200',
}

const TYPE_LABEL: Record<string, string> = {
  LOW_MARGIN: '报价',
  DISCOUNT: '折扣',
  RELEASE: '放行',
  QUOTE: '报价',
  DOC: '单证',
}

function timeAgo(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return '刚刚'
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return d === 1 ? '昨日提交' : `${d} 天前`
}

export function ApprovalCenterView() {
  const { currentUser } = useCRMStore()
  const queryClient = useQueryClient()
  const [acting, setActing] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ pending: ApprovalCard[]; history: ApprovalRecord[] }>({
    queryKey: ['approvals'],
    queryFn: async () => {
      const res = await fetch('/api/approvals')
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '加载失败')
      return json.data
    },
    staleTime: 15000,
  })

  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) => {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '操作失败')
      return json.data
    },
    onSuccess: (_, vars) => {
      toast.success(vars.decision === 'APPROVED' ? '已通过审批' : '已驳回')
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const pending = data?.pending || []
  const history = data?.history || []

  const handle = (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setActing(`${id}:${decision}`)
    decide.mutate(
      { id, decision },
      { onSettled: () => setActing(null) }
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-5 w-5 text-blue-700" /> 审批中心
          </CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            所有对外发送、价格调整、低毛利放行、交期承诺和正式单证确认必须经人工或确定性规则审批。AI 仅标注风险，不做决定。
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            待我审批
            <Badge variant="secondary" className={pending.length ? 'bg-red-100 text-red-700' : undefined}>
              {pending.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-10 flex-1" />
                </div>
              ))}
            </div>
          ) : pending.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-10 w-10 text-emerald-600" />}
              title="暂无待审批事项"
              description="低毛利报价、价格偏差与收款门禁放行会实时进入此处。当前没有命中确定性规则的待审批项。"
            />
          ) : (
            pending.map((a) => (
              <div key={a.id} className="flex items-start gap-3 border-b py-3 last:border-b-0">
                <span
                  className={`mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[a.type]}`}
                >
                  {a.typeLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{a.title}</span>
                    {a.aiRisk && (
                      <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                        <ShieldAlert className="h-3 w-3" />
                        {a.aiRisk}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {a.meta}
                    {a.createdAt && ` · ${timeAgo(a.createdAt)}`}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    disabled={acting !== null}
                    onClick={() => handle(a.id, 'REJECTED')}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" /> 驳回
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 bg-blue-700 hover:bg-blue-800"
                    disabled={acting !== null}
                    onClick={() => handle(a.id, 'APPROVED')}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    {acting === `${a.id}:APPROVED` ? '处理中…' : '通过'}
                  </Button>
                </div>
              </div>
            ))
          )}
          {currentUser && pending.length > 0 && (
            <p className="pt-2 text-xs text-muted-foreground">
              审批人：{currentUser.name} · 审批结果将回写业务单据（低毛利/折扣 → 报价单审批状态；放行 → 订单确认放行生产）
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4 text-muted-foreground" /> 审批历史
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">暂无审批记录。通过的审批会记录在案并回写单据。</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-3 text-xs">
                  <Badge
                    variant="outline"
                    className={h.status === 'APPROVED' ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-700'}
                  >
                    {h.status === 'APPROVED' ? '已通过' : '已驳回'}
                  </Badge>
                  <span className="font-medium">{TYPE_LABEL[h.type] || h.type}</span>
                  <span className="text-muted-foreground">{h.refId.slice(0, 12)}…</span>
                  {h.aiRisk && <span className="truncate text-muted-foreground">{h.aiRisk}</span>}
                  <span className="ml-auto shrink-0 text-muted-foreground">
                    {new Date(h.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, Database, HardDrive, RefreshCw, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { OpsStatus } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}`
  return '运行状态暂不可用。'
}

export function P3OpsStatusView() {
  const [status, setStatus] = useState<OpsStatus | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setStatus(await api.opsStatus()) } catch (reason) { setError(errorText(reason)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  return <div className="space-y-5" data-testid="p3-ops-status-view">
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"><div className="flex items-start gap-2"><ShieldCheck className="mt-1 h-4 w-4 text-emerald-600" /><div><b>P3 运行状态与发布门禁</b><div className="text-xs text-muted">只显示脱敏健康指标；此页面不会执行迁移、备份、发布、连接器调用或任何外部操作。</div></div><Button className="ml-auto" size="sm" variant="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button></div></div>
    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
    <div className="grid gap-4 lg:grid-cols-3">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-4 w-4 text-brand" />数据库</CardTitle></CardHeader><CardContent className="space-y-2 text-xs"><div className="flex justify-between"><span>连通性</span><Badge tone={status?.database.reachable ? 'blue' : 'red'}>{status?.database.reachable ? '正常' : '未确认'}</Badge></div><div>模式：{status?.database.mode || '—'}</div><div>探针：{status?.database.probe || '—'} · {status ? `${status.database.latencyMs}ms` : '—'}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-purple-600" />队列与配置</CardTitle></CardHeader><CardContent className="space-y-2 text-xs"><div className="flex justify-between"><span>队列</span><Badge tone={status?.queue.productionReady ? 'blue' : 'amber'}>{status?.queue.backend || '—'}</Badge></div><div>发布就绪：{status?.configuration.ready ? '是' : '否'}</div><div>AI 配置：{status?.configuration.ai || '—'} · PII：{status?.configuration.pii || '—'}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-amber-600" />进程与备份</CardTitle></CardHeader><CardContent className="space-y-2 text-xs"><div>运行：{status ? `${status.process.uptimeSeconds}s` : '—'}</div><div>RSS：{status ? `${status.process.rssMiB} MiB` : '—'} · Heap：{status ? `${status.process.heapUsedMiB} MiB` : '—'}</div><div>备份：{status?.backup.mode || '—'}（不会自动执行）</div></CardContent></Card>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900"><b>发布前仍需人工门禁：</b>{status?.backup.note || '先备份并在隔离测试库验证。'} 真实数据库迁移、备份、发布和连接器授权不由本页面触发。</div>
  </div>
}

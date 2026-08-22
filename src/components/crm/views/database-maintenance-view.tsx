'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Database, HardDriveDownload, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface MaintData {
  counts: Record<string, number>
  backups: { name: string; size: number; mtime: string }[]
  keepBackups: number
}

type Mode = 'migration' | 'backup'

function fmtSize(n: number) {
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
}

export function DatabaseMaintenanceView() {
  const [mode, setMode] = useState<Mode>('backup')
  const [token, setToken] = useState('')
  const [runLog, setRunLog] = useState<string[]>([])

  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<MaintData>({
    queryKey: ['db-maintenance'],
    queryFn: async () => {
      const res = await fetch('/api/admin/db/maintenance')
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '加载失败')
      return json.data
    },
  })

  const backup = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/db/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup', token }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '备份失败')
      return json.data as { name: string; size: number; kept: number }
    },
    onSuccess: (d) => {
      const line = `✓ 备份成功 · ${d.name} · ${fmtSize(d.size)} · 保留 ${d.kept} 份`
      setRunLog((prev) => [`${new Date().toLocaleTimeString('zh-CN')} ${line}`, ...prev].slice(0, 8))
      toast.success(`备份成功：${d.name}`)
      queryClient.invalidateQueries({ queryKey: ['db-maintenance'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const totalRows = data ? Object.values(data.counts).reduce((s, n) => s + n, 0) : 0
  const lastBackup = data?.backups[0]
  const canStart = token.trim().length > 0 && !backup.isPending

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-gray-600" /> 数据库维护
          </CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            迁移数据（导入 MySQL .sql/.sql.gz，仅在浏览器解析）与本地备份双模式；所有操作需数据库维护授权码；运行记录实时流。仅超级管理员。
          </p>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {isLoading || !data ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">数据库连接</div>
                <div className="mt-1 text-lg font-semibold text-emerald-700">SQLite · 已连接</div>
                <div className="mt-1 text-xs text-muted-foreground">Prisma · {totalRows.toLocaleString()} 行业务数据</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">备份策略</div>
                <div className="mt-1 text-lg font-semibold">允许 · {data.keepBackups} 份</div>
                <div className="mt-1 text-xs text-muted-foreground">超期自动清理</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">最近备份</div>
                <div className="mt-1 truncate text-lg font-semibold">
                  {lastBackup ? lastBackup.name.replace('nexfab-backup-', '').replace('.db', '') : '暂无'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {lastBackup ? `${fmtSize(lastBackup.size)} · ${new Date(lastBackup.mtime).toLocaleString('zh-CN')}` : '尚未创建备份'}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex rounded-lg bg-muted p-1">
              {(
                [
                  ['migration', '迁移数据'],
                  ['backup', '本地备份'],
                ] as [Mode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    mode === m ? 'bg-background shadow text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'backup' ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
                  <b>服务器允许写入备份文件</b>
                  <br />
                  备份由部署配置决定是否开放；格式 SQLite 文件级复制，保留策略最近 {data?.keepBackups ?? 7} 份，超期自动清理。
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                  <div className="rounded-lg bg-muted/50 p-2">
                    格式
                    <b className="mt-0.5 block text-sm text-foreground">.db</b>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    保留
                    <b className="mt-0.5 block text-sm text-foreground">{data?.keepBackups ?? 7} 份</b>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    已有备份
                    <b className="mt-0.5 block text-sm text-foreground">{data?.backups.length ?? 0}</b>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed py-8 text-center">
                  <HardDriveDownload className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium">选择 MySQL 备份文件</p>
                  <p className="text-xs text-muted-foreground">.sql / .sql.gz · 仅在浏览器解析，不上传第三方</p>
                  <Badge variant="secondary" className="text-[10px]">
                    迁移引擎待后端接入
                  </Badge>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">重复数据处理</label>
                  <select className="w-full rounded-lg border bg-background px-3 py-2 text-xs" disabled>
                    <option>跳过已有记录</option>
                    <option>覆盖相同 ID</option>
                  </select>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-xs text-muted-foreground">数据库维护授权码</label>
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="输入授权码后可执行维护操作"
                className="h-9 text-xs"
              />
            </div>

            <Button
              className="mt-3 w-full bg-purple-700 hover:bg-purple-800 disabled:bg-purple-300"
              size="sm"
              disabled={!canStart || mode === 'migration'}
              onClick={() => backup.mutate()}
            >
              {backup.isPending ? '任务执行中…' : mode === 'migration' ? '开始迁移' : '创建备份'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">数据表状态</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !data ? (
                <Skeleton className="h-40" />
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">数据表</th>
                        <th className="px-3 py-2 text-right font-medium">记录数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.counts).map(([t, n]) => (
                        <tr key={t} className="border-t">
                          <td className="px-3 py-1.5 text-blue-700">{t}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{n.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" /> 运行记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              {runLog.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无运行记录。执行备份后会在此实时输出。</p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {runLog.map((l, i) => (
                    <div key={i} className="rounded bg-muted/50 px-2 py-1">
                      {l}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

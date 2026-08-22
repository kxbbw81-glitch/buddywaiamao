'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCcw, TrendingUp, TriangleAlert, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface RepurchaseRow {
  customerId: string
  companyName: string
  country: string
  customerLevel: string
  ownerName: string
  lastDealAt: string
  lastDealAmount: number
  dealCount: number
  totalAmount: number
  repurchaseAt: string
  daysLeft: number
  window: 'overdue' | 'near' | 'upcoming'
}

interface Stats { total: number; overdue: number; near: number; totalAmount: number }

const WINDOW_META: Record<string, { label: string; cls: string }> = {
  overdue: { label: '已到复购窗口', cls: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' },
  near: { label: '30 天内到期', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400' },
  upcoming: { label: '观察中', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
}

/** 商机中心 → 售后与复购：按客户聚合成交记录，推算复购窗口 */
export function AftersalesRetentionView() {
  const [rows, setRows] = useState<RepurchaseRow[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, overdue: 0, near: 0, totalAmount: 0 })
  const [cycleDays, setCycleDays] = useState('90')
  const [loading, setLoading] = useState(true)
  const [windowFilter, setWindowFilter] = useState('all')

  const load = useCallback(async (cycle: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/repurchase?cycleDays=${cycle}`)
      const json = await res.json()
      if (json.success) {
        setRows(json.data)
        setStats(json.stats)
      }
    } catch {
      toast.error('加载复购数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(cycleDays)
  }, [cycleDays, load])

  const filtered = rows.filter((r) => windowFilter === 'all' || r.window === windowFilter)

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* 统计栏 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-semibold">{stats.total}</div><div className="text-xs text-muted-foreground">成交客户</div></div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-semibold text-red-600">{stats.overdue}</div><div className="text-xs text-muted-foreground">已到复购窗口</div></div>
            <TriangleAlert className="h-8 w-8 text-red-500" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-semibold text-amber-600">{stats.near}</div><div className="text-xs text-muted-foreground">30 天内到期</div></div>
            <RefreshCcw className="h-8 w-8 text-amber-500" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-semibold">${stats.totalAmount.toLocaleString()}</div><div className="text-xs text-muted-foreground">累计成交金额</div></div>
            <Wallet className="h-8 w-8 text-emerald-500" />
          </div>
        </CardContent></Card>
      </div>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={windowFilter} onValueChange={setWindowFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部客户</SelectItem>
            <SelectItem value="overdue">已到复购窗口</SelectItem>
            <SelectItem value="near">30 天内到期</SelectItem>
            <SelectItem value="upcoming">观察中</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          消耗周期假设
          <Select value={cycleDays} onValueChange={setCycleDays}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="60">60 天</SelectItem>
              <SelectItem value="90">90 天</SelectItem>
              <SelectItem value="180">180 天</SelectItem>
              <SelectItem value="365">365 天</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => load(cycleDays)}>刷新</Button>
      </div>

      {/* 复购窗口表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              暂无成交客户。赢单商机或完成订单后，这里会自动出现复购窗口。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>客户</TableHead>
                  <TableHead>级别</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead className="text-right">成交次数</TableHead>
                  <TableHead className="text-right">累计金额</TableHead>
                  <TableHead>最近成交</TableHead>
                  <TableHead>预计复购日</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.customerId}>
                    <TableCell className="font-medium">
                      {r.companyName}
                      {r.country && <span className="ml-1 text-xs text-muted-foreground">{r.country}</span>}
                    </TableCell>
                    <TableCell>{r.customerLevel}</TableCell>
                    <TableCell>{r.ownerName}</TableCell>
                    <TableCell className="text-right">{r.dealCount}</TableCell>
                    <TableCell className="text-right">${r.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(r.lastDealAt).toLocaleDateString('zh-CN')}
                      <span className="ml-1 text-xs text-muted-foreground">（${r.lastDealAmount.toLocaleString()}）</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(r.repurchaseAt).toLocaleDateString('zh-CN')}
                      <span className={cn(
                        'ml-1 text-xs',
                        r.daysLeft < 0 ? 'text-red-600' : r.daysLeft <= 30 ? 'text-amber-600' : 'text-muted-foreground'
                      )}>
                        {r.daysLeft < 0 ? `超窗 ${-r.daysLeft} 天` : `剩 ${r.daysLeft} 天`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px]', WINDOW_META[r.window].cls)}>
                        {WINDOW_META[r.window].label}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        复购窗口 = 最近成交日期 + 消耗周期假设。到期客户建议：优先安排跟进任务（商机中心 → 跟进任务），
        高价值客户可交给 Agent 生成唤醒方案（AI Agent → Agent 对话）。
      </p>
    </div>
  )
}

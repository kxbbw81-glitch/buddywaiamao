'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, CheckCircle2, Circle, Clock, Plus, TriangleAlert, X } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface FollowupTask {
  id: string
  title: string
  type: string
  status: string
  priority: string
  dueDate: string | null
  notes: string | null
  completedAt: string | null
  customerId: string | null
  opportunityId: string | null
  customer?: { id: string; companyName: string; country: string | null } | null
  opportunity?: { id: string; title: string } | null
  assignee?: { id: string; name: string } | null
}

interface CustomerOption { id: string; companyName: string }
interface OpportunityOption { id: string; title: string }

const TYPE_LABELS: Record<string, string> = {
  follow_up: '跟进', call: '电话', email: '邮件', meeting: '会面', aftersales: '售后', other: '其他',
}
const STATUS_LABELS: Record<string, string> = {
  pending: '待处理', in_progress: '进行中', done: '已完成', cancelled: '已取消',
}
const PRIORITY_LABELS: Record<string, string> = { low: '低', normal: '普通', high: '高', urgent: '紧急' }
const PRIORITY_CLASS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400',
  normal: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  high: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  urgent: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
}

const TYPE_OPTIONS = Object.entries(TYPE_LABELS)
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS)

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

export function FollowupTaskView() {
  const { currentUser } = useCRMStore()
  const isManager = ['super_admin', 'management', 'sales_manager'].includes(currentUser?.primaryRole || '')

  const [tasks, setTasks] = useState<FollowupTask[]>([])
  const [stats, setStats] = useState({ pending: 0, todayDue: 0, overdue: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FollowupTask | null>(null)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [opportunities, setOpportunities] = useState<OpportunityOption[]>([])

  // 表单
  const [title, setTitle] = useState('')
  const [type, setType] = useState('follow_up')
  const [priority, setPriority] = useState('normal')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [customerId, setCustomerId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const status = statusFilter === 'active' ? '' : statusFilter
      const res = await fetch(`/api/followup-tasks${status ? `?status=${status}` : ''}`)
      const json = await res.json()
      if (json.success) {
        setTasks(json.data)
        setStats(json.stats)
      }
    } catch {
      toast.error('加载跟进任务失败')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  // 打开弹窗时加载客户与商机选项
  const openDialog = async (task: FollowupTask | null) => {
    setEditing(task)
    setTitle(task?.title || '')
    setType(task?.type || 'follow_up')
    setPriority(task?.priority || 'normal')
    setDueDate(task?.dueDate ? task.dueDate.slice(0, 10) : '')
    setNotes(task?.notes || '')
    setCustomerId(task?.customerId || '')
    setDialogOpen(true)
    if (customers.length === 0) {
      try {
        const res = await fetch('/api/customers?pageSize=100')
        const json = await res.json()
        if (json.success) setCustomers(json.data.map((c: { id: string; companyName: string }) => ({ id: c.id, companyName: c.companyName })))
      } catch { /* ignore */ }
    }
    if (opportunities.length === 0) {
      try {
        const res = await fetch('/api/opportunities?pageSize=100')
        const json = await res.json()
        if (json.success) setOpportunities(json.data.map((o: { id: string; title: string }) => ({ id: o.id, title: o.title })))
      } catch { /* ignore */ }
    }
  }

  const submit = async () => {
    if (!title.trim()) return
    const payload = {
      title: title.trim(),
      type,
      priority,
      dueDate: dueDate || null,
      notes: notes.trim() || null,
      customerId: customerId && customerId !== 'none' ? customerId : null,
    }
    try {
      const res = await fetch(editing ? `/api/followup-tasks/${editing.id}` : '/api/followup-tasks', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(editing ? '任务已更新' : '任务已创建')
        setDialogOpen(false)
        load()
      } else {
        toast.error(json.error || '保存失败')
      }
    } catch {
      toast.error('网络错误，请重试')
    }
  }

  const setStatus = async (task: FollowupTask, status: string) => {
    try {
      const res = await fetch(`/api/followup-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (json.success) load()
      else toast.error(json.error || '操作失败')
    } catch {
      toast.error('网络错误，请重试')
    }
  }

  const removeTask = async (task: FollowupTask) => {
    try {
      const res = await fetch(`/api/followup-tasks/${task.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('任务已删除')
        load()
      } else toast.error(json.error || '删除失败')
    } catch {
      toast.error('网络错误，请重试')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* 统计栏 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-semibold">{stats.pending}</div><div className="text-xs text-muted-foreground">待办任务</div></div>
            <Circle className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-semibold">{stats.todayDue}</div><div className="text-xs text-muted-foreground">今日到期</div></div>
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-semibold text-red-600">{stats.overdue}</div><div className="text-xs text-muted-foreground">已逾期</div></div>
            <TriangleAlert className="h-8 w-8 text-red-500" />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div><div className="text-2xl font-semibold">{tasks.filter((t) => t.status === 'done').length}</div><div className="text-xs text-muted-foreground">已完成（当前筛选）</div></div>
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
        </CardContent></Card>
      </div>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">进行中（待办+超期）</SelectItem>
            <SelectItem value="pending">待处理</SelectItem>
            <SelectItem value="in_progress">进行中</SelectItem>
            <SelectItem value="done">已完成</SelectItem>
            <SelectItem value="cancelled">已取消</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button size="sm" onClick={() => openDialog(null)}>
          <Plus className="mr-1 h-4 w-4" /> 新建任务
        </Button>
      </div>

      {/* 任务列表 */}
      <div className="space-y-2">
        {loading && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">加载中…</CardContent></Card>}
        {!loading && tasks.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            暂无任务。点击右上角「新建任务」开始安排跟进。
          </CardContent></Card>
        )}
        {tasks.map((task) => {
          const days = daysUntil(task.dueDate)
          const isActive = task.status === 'pending' || task.status === 'in_progress'
          return (
            <Card key={task.id} className={cn(task.status === 'done' && 'opacity-60')}>
              <CardContent className="flex items-center gap-3 p-4">
                {/* 状态切换 */}
                <button
                  className="shrink-0"
                  title={task.status === 'done' ? '标记为待处理' : '标记完成'}
                  onClick={() => setStatus(task, task.status === 'done' ? 'pending' : 'done')}
                >
                  {task.status === 'done'
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    : <Circle className="h-5 w-5 text-muted-foreground hover:text-emerald-600" />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('font-medium', task.status === 'done' && 'line-through')}>{task.title}</span>
                    <Badge variant="secondary" className="h-5 text-[10px]">{TYPE_LABELS[task.type] || task.type}</Badge>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px]', PRIORITY_CLASS[task.priority] || PRIORITY_CLASS.normal)}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                    {task.customer && (
                      <span className="text-xs text-muted-foreground">👤 {task.customer.companyName}</span>
                    )}
                  </div>
                  {task.notes && <p className="mt-1 truncate text-xs text-muted-foreground">{task.notes}</p>}
                </div>

                <div className="shrink-0 text-right text-xs">
                  {task.dueDate ? (
                    <div className={cn(
                      'flex items-center gap-1',
                      isActive && days !== null && days < 0 && 'font-medium text-red-600',
                      isActive && days === 0 && 'font-medium text-amber-600'
                    )}>
                      <CalendarClock className="h-3.5 w-3.5" />
                      {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                      {isActive && days !== null && (
                        <span>{days < 0 ? `逾期 ${-days} 天` : days === 0 ? '今天' : `${days} 天后`}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">无截止日</span>
                  )}
                  <div className="mt-0.5 text-muted-foreground">
                    {STATUS_LABELS[task.status]}{task.assignee ? ` · ${task.assignee.name}` : ''}
                  </div>
                </div>

                {isManager && task.status !== 'cancelled' && task.status !== 'done' && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setStatus(task, 'cancelled')}>
                    取消
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openDialog(task)}>
                  编辑
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeTask(task)} title="删除任务"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 新建/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑任务' : '新建跟进任务'}</DialogTitle>
            <DialogDescription>
              {isManager ? '可关联客户与商机；任务创建后可在列表中一键完成。' : '可关联客户；任务自动归属为你本人。'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="task-title">标题</Label>
              <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：给 AutoParts 发节前催单邮件" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>类型</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>优先级</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-due">截止日期</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>关联客户</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="不关联" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-notes">备注</Label>
              <Textarea id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="执行要点、话术提醒等" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button disabled={!title.trim()} onClick={submit}>{editing ? '保存' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

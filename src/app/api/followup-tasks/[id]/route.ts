import { db } from '@/lib/db'
import { requireAuth, isManager } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const STATUSES = ['pending', 'in_progress', 'done', 'cancelled']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

/** PATCH /api/followup-tasks/[id] — 更新（状态流转：done 自动记录 completedAt，回退清空；sales 仅本人任务） */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params

  let body: {
    title?: string
    status?: string
    priority?: string
    dueDate?: string | null
    notes?: string
    assigneeId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体格式错误' }, { status: 400 })
  }

  const task = await db.followupTask.findUnique({ where: { id } })
  if (!task) {
    return NextResponse.json({ success: false, error: '任务不存在' }, { status: 404 })
  }
  if (auth.user.primaryRole === 'sales' && task.assigneeId !== auth.user.id) {
    return NextResponse.json({ success: false, error: '无权修改他人任务' }, { status: 403 })
  }

  const patch: Record<string, unknown> = {}
  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) return NextResponse.json({ success: false, error: '标题不能为空' }, { status: 400 })
    patch.title = title
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ success: false, error: '无效优先级' }, { status: 400 })
    }
    patch.priority = body.priority
  }
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ success: false, error: '无效状态' }, { status: 400 })
    }
    patch.status = body.status
    // 状态流转副作用：完成记录时间，回退清空
    if (body.status === 'done' && task.status !== 'done') patch.completedAt = new Date()
    if (body.status !== 'done' && task.status === 'done') patch.completedAt = null
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === '') {
      patch.dueDate = null
    } else {
      const d = new Date(body.dueDate)
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ success: false, error: '日期格式错误' }, { status: 400 })
      }
      patch.dueDate = d
    }
  }
  // 转派仅管理角色
  if (body.assigneeId !== undefined && isManager(auth.user)) {
    patch.assigneeId = body.assigneeId || null
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: '无更新内容' }, { status: 400 })
  }

  const updated = await db.followupTask.update({ where: { id }, data: patch })
  return NextResponse.json({ success: true, data: updated })
}

/** DELETE /api/followup-tasks/[id] — 删除（sales 仅本人任务） */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  const { id } = await params

  const task = await db.followupTask.findUnique({ where: { id } })
  if (!task) {
    return NextResponse.json({ success: false, error: '任务不存在' }, { status: 404 })
  }
  if (auth.user.primaryRole === 'sales' && task.assigneeId !== auth.user.id) {
    return NextResponse.json({ success: false, error: '无权删除他人任务' }, { status: 403 })
  }

  await db.followupTask.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

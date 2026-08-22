import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const TYPES = ['follow_up', 'call', 'email', 'meeting', 'aftersales', 'other']
const STATUSES = ['pending', 'in_progress', 'done', 'cancelled']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

/** GET /api/followup-tasks — 列表（sales 仅本人任务；支持 status/priority/类型筛选） */
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const priority = searchParams.get('priority') || ''
  const type = searchParams.get('type') || ''
  const search = searchParams.get('search') || ''

  const where: Record<string, unknown> = {}
  if (auth.user.primaryRole === 'sales') where.assigneeId = auth.user.id
  if (status) where.status = status
  if (priority) where.priority = priority
  if (type) where.type = type
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { notes: { contains: search } },
    ]
  }

  const [tasks, total] = await Promise.all([
    db.followupTask.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        customer: { select: { id: true, companyName: true, country: true } },
        opportunity: { select: { id: true, title: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    db.followupTask.count({ where }),
  ])

  // 统计（截止日按整天计算：当天到期的任务无论几点都不算逾期）
  const scopeBase = auth.user.primaryRole === 'sales' ? { assigneeId: auth.user.id } : {}
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const [pendingCount, todayDueCount, overdueCount] = await Promise.all([
    db.followupTask.count({ where: { ...scopeBase, status: { in: ['pending', 'in_progress'] } } }),
    db.followupTask.count({
      where: { ...scopeBase, status: { in: ['pending', 'in_progress'] }, dueDate: { lte: todayEnd, gte: todayStart } },
    }),
    db.followupTask.count({
      where: { ...scopeBase, status: { in: ['pending', 'in_progress'] }, dueDate: { lt: todayStart } },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: tasks,
    total,
    stats: { pending: pendingCount, todayDue: todayDueCount, overdue: overdueCount },
  })
}

/** POST /api/followup-tasks — 新建（sales 自动归属自己） */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  let body: {
    title?: string
    customerId?: string
    opportunityId?: string
    type?: string
    priority?: string
    dueDate?: string
    notes?: string
    assigneeId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: '请求体格式错误' }, { status: 400 })
  }

  const title = (body.title || '').trim()
  if (!title) {
    return NextResponse.json({ success: false, error: '任务标题不能为空' }, { status: 400 })
  }

  const type = TYPES.includes(body.type || '') ? body.type! : 'follow_up'
  const priority = PRIORITIES.includes(body.priority || '') ? body.priority! : 'normal'
  const assigneeId = auth.user.primaryRole === 'sales' ? auth.user.id : body.assigneeId || auth.user.id

  let dueDate: Date | null = null
  if (body.dueDate) {
    dueDate = new Date(body.dueDate)
    if (Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ success: false, error: '截止日期格式错误' }, { status: 400 })
    }
  }

  try {
    const task = await db.followupTask.create({
      data: {
        title,
        customerId: body.customerId || null,
        opportunityId: body.opportunityId || null,
        type,
        priority,
        dueDate,
        notes: body.notes?.trim() || null,
        assigneeId,
      },
    })
    return NextResponse.json({ success: true, data: task }, { status: 201 })
  } catch (error) {
    console.error('FollowupTask POST error:', error)
    return NextResponse.json({ success: false, error: '创建失败，请检查关联的客户/商机是否存在' }, { status: 400 })
  }
}

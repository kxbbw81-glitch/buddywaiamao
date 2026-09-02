import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { isManager, requireAuth } from '@/lib/auth'
import { inquiryScopeWhere, SALES_OPERATION_ROLES } from '@/lib/commercial-access'

const INQUIRY_STATUSES = ['new', 'assigned', 'following', 'quoted', 'won', 'lost', 'pooled', 'closed']

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const inquiry = await db.inquiry.findFirst({
      where: { id, ...inquiryScopeWhere(auth.user) },
      include: {
        customer: { select: { id: true, companyName: true, companyNameEn: true, country: true, customerLevel: true } },
        assignee: { select: { id: true, name: true, email: true } },
        quotations: { include: { items: true, creator: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        samples: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!inquiry) return NextResponse.json({ success: false, error: '询盘不存在或无权访问' }, { status: 404 })
    const activities = await db.activity.findMany({
      where: { entityType: 'inquiry', entityId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json({ success: true, data: { ...inquiry, activities } })
  } catch (error) {
    console.error('Inquiry GET error:', error)
    return NextResponse.json({ success: false, error: '获取询盘详情失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(SALES_OPERATION_ROLES)
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const existing = await db.inquiry.findFirst({ where: { id, ...inquiryScopeWhere(auth.user) }, select: { id: true } })
    if (!existing) return NextResponse.json({ success: false, error: '询盘不存在或无权操作' }, { status: 404 })
    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) {
      const status = String(body.status)
      if (!INQUIRY_STATUSES.includes(status)) return NextResponse.json({ success: false, error: '无效的询盘状态' }, { status: 400 })
      updateData.status = status
    }
    if (body.priority !== undefined) updateData.priority = String(body.priority)
    if (body.lastFollowUpAt !== undefined) updateData.lastFollowUpAt = body.lastFollowUpAt ? new Date(body.lastFollowUpAt) : null
    if (body.subject !== undefined) updateData.subject = body.subject ? String(body.subject) : null
    if (body.content !== undefined) updateData.content = body.content ? String(body.content) : null
    if (body.assignedTo !== undefined) {
      if (!isManager(auth.user)) return NextResponse.json({ success: false, error: '仅管理角色可分配询盘' }, { status: 403 })
      const assignee = body.assignedTo ? await db.user.findFirst({ where: { id: String(body.assignedTo), isActive: true }, select: { id: true } }) : null
      if (body.assignedTo && !assignee) return NextResponse.json({ success: false, error: '分配对象不存在或已停用' }, { status: 400 })
      updateData.assignedTo = assignee?.id || null
      updateData.assignedAt = assignee ? new Date() : null
    }
    if (Object.keys(updateData).length === 0) return NextResponse.json({ success: false, error: '没有可更新字段' }, { status: 400 })

    const inquiry = await db.$transaction(async (tx) => {
      const updated = await tx.inquiry.update({ where: { id }, data: updateData })
      await tx.activity.create({
        data: { type: 'system', subject: 'INQUIRY_UPDATED', entityType: 'inquiry', entityId: id, userId: auth.user.id },
      })
      return updated
    })
    return NextResponse.json({ success: true, data: inquiry })
  } catch (error) {
    console.error('Inquiry PUT error:', error)
    return NextResponse.json({ success: false, error: '更新询盘失败' }, { status: 500 })
  }
}

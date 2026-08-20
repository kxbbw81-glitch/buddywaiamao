import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const inquiry = await db.inquiry.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, companyName: true, companyNameEn: true, country: true, customerLevel: true } },
        assignee: { select: { id: true, name: true, email: true } },
        quotations: { include: { items: true, creator: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        samples: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!inquiry) {
      return NextResponse.json({ success: false, error: '询盘不存在' }, { status: 404 })
    }
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
  try {
    const { id } = await params
    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.assignedTo !== undefined) {
      updateData.assignedTo = body.assignedTo
      updateData.assignedAt = body.assignedTo ? new Date() : null
    }
    if (body.lastFollowUpAt !== undefined) updateData.lastFollowUpAt = body.lastFollowUpAt ? new Date(body.lastFollowUpAt) : null
    if (body.subject !== undefined) updateData.subject = body.subject
    if (body.content !== undefined) updateData.content = body.content
    if (body.customerId !== undefined) updateData.customerId = body.customerId

    const inquiry = await db.inquiry.update({ where: { id }, data: updateData })
    return NextResponse.json({ success: true, data: inquiry })
  } catch (error) {
    console.error('Inquiry PUT error:', error)
    return NextResponse.json({ success: false, error: '更新询盘失败' }, { status: 500 })
  }
}

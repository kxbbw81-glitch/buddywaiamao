import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const activities = await db.activity.findMany({
      where: {},
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    // Enrich with entity info
    const enriched = await Promise.all(
      activities.map(async (activity) => {
        let entityName = ''
        let entitySubject = ''

        if (activity.entityType && activity.entityId) {
          if (activity.entityType === 'customer') {
            const customer = await db.customer.findUnique({
              where: { id: activity.entityId },
              select: { companyName: true },
            })
            if (customer) entityName = customer.companyName
          } else if (activity.entityType === 'inquiry') {
            const inquiry = await db.inquiry.findUnique({
              where: { id: activity.entityId },
              select: { subject: true, customer: { select: { companyName: true } } },
            })
            if (inquiry) {
              entitySubject = inquiry.subject || ''
              entityName = inquiry.customer?.companyName || ''
            }
          } else if (activity.entityType === 'quotation') {
            const quotation = await db.quotation.findUnique({
              where: { id: activity.entityId },
              select: { quoteNo: true, customer: { select: { companyName: true } } },
            })
            if (quotation) {
              entitySubject = quotation.quoteNo
              entityName = quotation.customer?.companyName || ''
            }
          } else if (activity.entityType === 'order') {
            const order = await db.order.findUnique({
              where: { id: activity.entityId },
              select: { orderNo: true, customer: { select: { companyName: true } } },
            })
            if (order) {
              entitySubject = order.orderNo
              entityName = order.customer?.companyName || ''
            }
          }
        }

        return {
          ...activity,
          entityName,
          entitySubject,
        }
      })
    )

    // Count unread
    const unreadCount = await db.activity.count({
      where: { readAt: null },
    })

    return NextResponse.json({
      success: true,
      data: enriched,
      unreadCount,
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json(
      { success: false, error: '获取通知失败' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { markAll } = body

    if (markAll) {
      // Mark all unread notifications as read
      await db.activity.updateMany({
        where: { readAt: null },
        data: { readAt: new Date() },
      })

      return NextResponse.json({
        success: true,
        message: '已全部标记为已读',
      })
    }

    // Mark a specific notification as read
    const { id } = body
    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少通知ID' },
        { status: 400 }
      )
    }

    await db.activity.update({
      where: { id },
      data: { readAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      message: '已标记为已读',
    })
  } catch (error) {
    console.error('Notifications PUT error:', error)
    return NextResponse.json(
      { success: false, error: '更新通知状态失败' },
      { status: 500 }
    )
  }
}

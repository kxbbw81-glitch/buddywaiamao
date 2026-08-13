import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type') || ''
    const dateRange = searchParams.get('dateRange') || ''
    const entityType = searchParams.get('entityType') || ''
    const entityId = searchParams.get('entityId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '20')))

    const where: Record<string, unknown> = {}

    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (type) where.type = type

    // Search in subject or content
    if (search) {
      where.OR = [
        { subject: { contains: search } },
        { content: { contains: search } },
      ]
    }

    // Date range filter
    if (dateRange) {
      const now = new Date()
      let startDate: Date | undefined

      if (dateRange === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        startDate = start
      } else if (dateRange === 'week') {
        const day = now.getDay() || 7
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
        startDate = start
      } else if (dateRange === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate = start
      }

      if (startDate) {
        where.createdAt = { gte: startDate }
      }
    }

    const [activities, total] = await Promise.all([
      db.activity.findMany({
        where,
        include: {
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.activity.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: activities,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('Activities GET error:', error)
    return NextResponse.json({ success: false, error: '获取活动记录失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const activity = await db.activity.create({
      data: {
        type: body.type || 'note',
        subject: body.subject || null,
        content: body.content || null,
        entityType: body.entityType || null,
        entityId: body.entityId || null,
        userId: body.userId || null,
      },
      include: {
        user: { select: { name: true } },
      },
    })

    return NextResponse.json({ success: true, data: activity }, { status: 201 })
  } catch (error) {
    console.error('Activities POST error:', error)
    return NextResponse.json({ success: false, error: '创建活动记录失败' }, { status: 500 })
  }
}

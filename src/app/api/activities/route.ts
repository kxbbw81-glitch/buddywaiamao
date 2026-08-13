import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType') || ''
    const entityId = searchParams.get('entityId') || ''
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId

    const activities = await db.activity.findMany({
      where,
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, data: activities })
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

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || ''
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const month = searchParams.get('month') || '' // YYYY-MM for calendar

    const where: Record<string, unknown> = {}
    if (platform) where.platform = platform
    if (status) where.status = status
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ]
    }
    if (month) {
      const startDate = new Date(month + '-01')
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)
      where.scheduledAt = { gte: startDate, lt: endDate }
    }

    const [posts, total] = await Promise.all([
      db.socialPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          customer: { select: { id: true, companyName: true, country: true } },
          product: { select: { id: true, name: true, productCode: true } },
          creator: { select: { id: true, name: true } },
        },
      }),
      db.socialPost.count({ where }),
    ])

    return NextResponse.json({ success: true, data: posts, total, page, pageSize })
  } catch (error) {
    console.error('SocialPosts GET error:', error)
    return NextResponse.json({ success: false, error: '获取社媒帖子失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const tags = typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || [])
    const mediaUrls = typeof body.mediaUrls === 'string' ? body.mediaUrls : JSON.stringify(body.mediaUrls || [])

    const post = await db.socialPost.create({
      data: {
        title: body.title,
        content: body.content,
        platform: body.platform,
        status: body.status || 'draft',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        publishedAt: body.status === 'published' ? new Date() : null,
        customerId: body.customerId || null,
        productId: body.productId || null,
        tags,
        mediaUrls,
        createdById: body.createdById || null,
      },
    })
    return NextResponse.json({ success: true, data: post }, { status: 201 })
  } catch (error) {
    console.error('SocialPosts POST error:', error)
    return NextResponse.json({ success: false, error: '创建社媒帖子失败' }, { status: 500 })
  }
}

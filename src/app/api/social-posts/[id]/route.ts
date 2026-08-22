import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const post = await db.socialPost.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, companyName: true, country: true } },
        product: { select: { id: true, name: true, productCode: true } },
        creator: { select: { id: true, name: true } },
      },
    })
    if (!post) {
      return NextResponse.json({ success: false, error: '帖子不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    console.error('SocialPost GET error:', error)
    return NextResponse.json({ success: false, error: '获取帖子失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const tags = typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || [])
    const mediaUrls = typeof body.mediaUrls === 'string' ? body.mediaUrls : JSON.stringify(body.mediaUrls || [])

    const updateData: Record<string, unknown> = {
      title: body.title,
      content: body.content,
      platform: body.platform,
      status: body.status,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      customerId: body.customerId || null,
      productId: body.productId || null,
      tags,
      mediaUrls,
    }

    if (body.status === 'published') {
      updateData.publishedAt = new Date()
    }

    const post = await db.socialPost.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, companyName: true, country: true } },
        product: { select: { id: true, name: true, productCode: true } },
        creator: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    console.error('SocialPost PUT error:', error)
    return NextResponse.json({ success: false, error: '更新帖子失败' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.socialPost.delete({ where: { id } })
    return NextResponse.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('SocialPost DELETE error:', error)
    return NextResponse.json({ success: false, error: '删除帖子失败' }, { status: 500 })
  }
}

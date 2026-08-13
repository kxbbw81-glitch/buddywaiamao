import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, primaryRole: true } },
        contacts: { orderBy: { createdAt: 'asc' } },
        inquiries: { include: { assignee: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
        quotations: { include: { creator: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
        orders: { orderBy: { createdAt: 'desc' }, take: 20 },
        activities: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 30 },
      },
    })
    if (!customer) {
      return NextResponse.json({ success: false, error: '客户不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: customer })
  } catch (error) {
    console.error('Customer GET error:', error)
    return NextResponse.json({ success: false, error: '获取客户详情失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const customer = await db.customer.update({
      where: { id },
      data: {
        companyName: body.companyName,
        companyNameEn: body.companyNameEn,
        country: body.country,
        city: body.city,
        website: body.website,
        industry: body.industry,
        customerLevel: body.customerLevel,
        source: body.source,
        tags: body.tags,
        notes: body.notes,
        status: body.status,
        ownerId: body.ownerId,
        lastContactAt: body.lastContactAt,
      },
    })
    return NextResponse.json({ success: true, data: customer })
  } catch (error) {
    console.error('Customer PUT error:', error)
    return NextResponse.json({ success: false, error: '更新客户失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.customer.delete({ where: { id } })
    return NextResponse.json({ success: true, message: '客户已删除' })
  } catch (error) {
    console.error('Customer DELETE error:', error)
    return NextResponse.json({ success: false, error: '删除客户失败' }, { status: 500 })
  }
}

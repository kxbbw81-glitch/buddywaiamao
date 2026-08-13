import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const order = await db.order.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, companyName: true, country: true } },
        creator: { select: { name: true } },
        quotation: { include: { items: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!order) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Order GET error:', error)
    return NextResponse.json({ success: false, error: '获取订单详情失败' }, { status: 500 })
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
    if (body.paymentTerm !== undefined) updateData.paymentTerm = body.paymentTerm
    if (body.deliveryDate !== undefined) updateData.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null
    if (body.paidAmount !== undefined) updateData.paidAmount = body.paidAmount
    if (body.notes !== undefined) updateData.notes = body.notes

    const order = await db.order.update({ where: { id }, data: updateData })
    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Order PUT error:', error)
    return NextResponse.json({ success: false, error: '更新订单失败' }, { status: 500 })
  }
}

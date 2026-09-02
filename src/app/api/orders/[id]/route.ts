import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { orderScopeWhere, SALES_OPERATION_ROLES } from '@/lib/commercial-access'

async function accessibleOrder(id: string, user: Parameters<typeof orderScopeWhere>[0]) {
  return db.order.findFirst({ where: { id, ...orderScopeWhere(user) } })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const order = await db.order.findFirst({
      where: { id, ...orderScopeWhere(auth.user) },
      include: {
        customer: { select: { id: true, companyName: true, country: true } },
        creator: { select: { name: true } },
        quotation: { include: { items: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        orderItems: true,
        fulfillmentEvents: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!order) return NextResponse.json({ success: false, error: '订单不存在或无权访问' }, { status: 404 })
    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('Order GET error:', error)
    return NextResponse.json({ success: false, error: '获取订单详情失败' }, { status: 500 })
  }
}

/**
 * 普通订单编辑不允许直接推进状态、改回款、物流或金额；这些动作必须走财务确认/履约专用入口。
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(SALES_OPERATION_ROLES)
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const order = await accessibleOrder(id, auth.user)
    if (!order) return NextResponse.json({ success: false, error: '订单不存在或无权操作' }, { status: 404 })
    const body = await request.json()
    const updateData: Record<string, unknown> = {}
    if (body.paymentTerm !== undefined) updateData.paymentTerm = body.paymentTerm ? String(body.paymentTerm) : null
    if (body.deliveryDate !== undefined) updateData.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null
    if (body.notes !== undefined) updateData.notes = body.notes ? String(body.notes) : null
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '订单金额、回款、物流和状态必须通过专用流程更新' }, { status: 400 })
    }
    const updated = await db.$transaction(async (tx) => {
      const value = await tx.order.update({ where: { id }, data: updateData })
      await tx.activity.create({
        data: { type: 'system', subject: 'ORDER_UPDATED', entityType: 'order', entityId: id, userId: auth.user.id },
      })
      return value
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Order PUT error:', error)
    return NextResponse.json({ success: false, error: '更新订单失败' }, { status: 500 })
  }
}

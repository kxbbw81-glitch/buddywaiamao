import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * GET /api/orders/[id]/gate — 收款门禁（移植自旧主线）
 * 算 canShip（需 confirmed + paid + fulfillment ready）+ requirements 阻塞项
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const order = await db.order.findUnique({
      where: { id },
      select: { id: true, orderNo: true, totalAmount: true, currency: true, status: true, paymentStatus: true, fulfillmentStatus: true },
    })
    if (!order) return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 })

    const payments = await db.payment.findMany({
      where: { orderId: id },
      select: { amount: true, status: true },
    })
    const confirmedAmount = payments
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + p.amount, 0)

    const totalAmount = order.totalAmount
    const paidAmount = Math.min(confirmedAmount, totalAmount)
    const pendingAmount = Number((totalAmount - paidAmount).toFixed(2))
    const paymentStatus = paidAmount >= totalAmount && totalAmount > 0
      ? 'paid'
      : paidAmount > 0
        ? 'partial'
        : order.paymentStatus

    const canShip =
      order.status === 'confirmed' &&
      paymentStatus === 'paid' &&
      ['ready_to_ship', 'shipped', 'delivered'].includes(order.fulfillmentStatus)

    const requirements: string[] = []
    if (paymentStatus !== 'paid') requirements.push('WAITING_PAYMENT_CONFIRMATION')
    if (!['ready_to_ship', 'shipped', 'delivered'].includes(order.fulfillmentStatus)) {
      requirements.push('WAITING_FULFILLMENT_READY')
    }
    if (order.status !== 'confirmed') requirements.push('ORDER_NOT_CONFIRMED')

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        currency: order.currency,
        totalAmount,
        paidAmount,
        pendingAmount,
        canShip,
        paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        requirements,
      },
    })
  } catch (error) {
    console.error('Order gate error:', error)
    return NextResponse.json({ success: false, error: '获取收款门禁失败' }, { status: 500 })
  }
}

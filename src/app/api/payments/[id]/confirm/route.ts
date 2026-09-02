import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { FINANCE_CONFIRM_ROLES } from '@/lib/commercial-access'

/** 财务确认到账，并在同一事务内回写订单收款汇总。 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(FINANCE_CONFIRM_ROLES)
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const payment = await db.payment.findUnique({ where: { id }, select: { id: true, orderId: true, status: true } })
    if (!payment) return NextResponse.json({ success: false, error: '回款记录不存在' }, { status: 404 })
    if (payment.status === 'completed') return NextResponse.json({ success: false, error: '该回款已确认' }, { status: 409 })

    const result = await db.$transaction(async (tx) => {
      const confirmed = await tx.payment.update({ where: { id }, data: { status: 'completed' } })
      const order = await tx.order.findUnique({ where: { id: payment.orderId }, select: { id: true, totalAmount: true } })
      if (!order) throw new Error('ORDER_NOT_FOUND')
      const completed = await tx.payment.aggregate({ where: { orderId: payment.orderId, status: 'completed' }, _sum: { amount: true } })
      const paidAmount = Number(Math.min(completed._sum.amount || 0, order.totalAmount).toFixed(2))
      const paymentStatus = paidAmount >= order.totalAmount && order.totalAmount > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'
      await tx.order.update({ where: { id: order.id }, data: { paidAmount, paymentStatus } })
      await tx.activity.create({
        data: { type: 'system', subject: 'PAYMENT_CONFIRMED', entityType: 'payment', entityId: id, userId: auth.user.id },
      })
      return { payment: confirmed, paidAmount, paymentStatus }
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Payment confirmation error:', error)
    return NextResponse.json({ success: false, error: '确认回款失败' }, { status: 500 })
  }
}

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { orderScopeWhere, paymentScopeWhere, SALES_OPERATION_ROLES } from '@/lib/commercial-access'

const PAYMENT_RECORD_ROLES = [...SALES_OPERATION_ROLES, 'finance']

function pageValue(value: string | null, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const page = pageValue(searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER)
    const pageSize = pageValue(searchParams.get('pageSize'), 50, 100)
    const where: Record<string, unknown> = { ...paymentScopeWhere(auth.user) }
    if (status) where.status = status

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          order: {
            select: {
              orderNo: true,
              piNo: true,
              customer: { select: { companyName: true, country: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.payment.count({ where }),
    ])
    return NextResponse.json({ success: true, data: payments, total, page, pageSize })
  } catch (error) {
    console.error('Payments GET error:', error)
    return NextResponse.json({ success: false, error: '获取付款列表失败' }, { status: 500 })
  }
}

/** 登记回款只创建待财务确认记录，客户端不能直接写 completed/paidAmount。 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(PAYMENT_RECORD_ROLES)
  if (!auth.ok) return auth.response
  try {
    const body = await request.json()
    const orderId = typeof body.orderId === 'string' ? body.orderId : ''
    const amount = Number(body.amount)
    if (!orderId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: '订单与正数回款金额为必填项' }, { status: 400 })
    }
    const order = await db.order.findFirst({ where: { id: orderId, ...orderScopeWhere(auth.user) }, select: { id: true, currency: true } })
    if (!order) return NextResponse.json({ success: false, error: '订单不存在或无权操作' }, { status: 404 })

    const payment = await db.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          orderId,
          amount: Number(amount.toFixed(2)),
          currency: String(body.currency || order.currency || 'USD').toUpperCase(),
          paymentMethod: body.paymentMethod ? String(body.paymentMethod) : null,
          paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          status: 'pending',
          notes: body.notes ? String(body.notes) : null,
        },
      })
      await tx.activity.create({
        data: { type: 'system', subject: 'PAYMENT_RECORDED_PENDING_CONFIRMATION', entityType: 'payment', entityId: created.id, userId: auth.user.id },
      })
      return created
    })
    return NextResponse.json({ success: true, data: payment }, { status: 201 })
  } catch (error) {
    console.error('Payments POST error:', error)
    return NextResponse.json({ success: false, error: '创建付款记录失败' }, { status: 500 })
  }
}

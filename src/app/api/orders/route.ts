import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { orderScopeWhere, SALES_OPERATION_ROLES } from '@/lib/commercial-access'
import { createOrderFromQuote } from '@/lib/order-from-quote'

function pageValue(value: string | null, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = pageValue(searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER)
    const pageSize = pageValue(searchParams.get('pageSize'), 20, 100)
    const scope = orderScopeWhere(auth.user)
    const where: Record<string, unknown> = { ...scope }
    if (search) where.AND = [scope, { OR: [{ orderNo: { contains: search } }, { piNo: { contains: search } }] }]
    if (status) where.status = status

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          customer: { select: { id: true, companyName: true, country: true } },
          creator: { select: { name: true } },
          quotation: { select: { quoteNo: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.order.count({ where }),
    ])
    return NextResponse.json({ success: true, data: orders, total, page, pageSize })
  } catch (error) {
    console.error('Orders GET error:', error)
    return NextResponse.json({ success: false, error: '获取订单列表失败' }, { status: 500 })
  }
}

/** 兼容原入口，但只接受 quotationId，忽略客户端金额、客户和状态字段。 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(SALES_OPERATION_ROLES)
  if (!auth.ok) return auth.response
  try {
    const body = await request.json()
    const quotationId = typeof body.quotationId === 'string' ? body.quotationId : ''
    if (!quotationId) {
      return NextResponse.json({ success: false, error: '订单必须从已接受报价生成' }, { status: 400 })
    }
    const result = await createOrderFromQuote(quotationId, auth.user)
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, data: result.order }, { status: 201 })
  } catch (error) {
    console.error('Orders POST error:', error)
    return NextResponse.json({ success: false, error: '创建订单失败' }, { status: 500 })
  }
}

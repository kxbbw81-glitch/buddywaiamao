import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { SALES_OPERATION_ROLES } from '@/lib/commercial-access'
import { createOrderFromQuote } from '@/lib/order-from-quote'

/** POST /api/orders/from-quote/:id — 已接受报价转订单。 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(SALES_OPERATION_ROLES)
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const result = await createOrderFromQuote(id, auth.user)
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, data: result.order }, { status: 201 })
  } catch (error) {
    console.error('From-quote error:', error)
    return NextResponse.json({ success: false, error: '报价转订单失败' }, { status: 500 })
  }
}

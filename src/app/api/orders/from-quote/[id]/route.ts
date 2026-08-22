import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * POST /api/orders/from-quote/[id] — 报价转订单（移植自旧主线）
 * 取报价最新 QuoteVersion，快照明细建 Order + OrderItem[] + FulfillmentEvent(PENDING)
 */
function genOrderNo(): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
  return `ORD-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { id } = await params // quotation id
    const quote = await db.quotation.findUnique({
      where: { id },
      select: { id: true, customerId: true, currency: true, totalAmount: true, ownerId: true },
    })
    if (!quote) return NextResponse.json({ success: false, error: '报价不存在' }, { status: 404 })
    if (!quote.customerId) {
      return NextResponse.json({ success: false, error: '报价未关联客户，无法转订单' }, { status: 400 })
    }

    const [version] = await db.quoteVersion.findMany({
      where: { quotationId: id },
      orderBy: { version: 'desc' },
      take: 1,
    })
    if (!version) {
      return NextResponse.json({ success: false, error: '报价没有版本明细，无法转订单' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let items: any[] = []
    try {
      items = JSON.parse(version.itemsJson || '[]')
    } catch {
      items = []
    }
    if (!items.length) {
      return NextResponse.json({ success: false, error: '报价版本无明细' }, { status: 400 })
    }

    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNo: genOrderNo(),
          quotationId: quote.id,
          customerId: quote.customerId,
          currency: quote.currency || 'USD',
          totalAmount: quote.totalAmount,
          status: 'confirmed',
          paymentStatus: 'unpaid',
          fulfillmentStatus: 'pending',
          createdById: auth.user.id,
        },
      })
      for (const item of items) {
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            productId: item.productId || null,
            sku: item.sku || null,
            name: String(item.name || item.productName || '行'),
            quantity: Number(item.quantity ?? 1),
            unitPrice: Number(item.unitPrice ?? 0),
            unitCost: Number(item.unitCost ?? 0),
            amount: Number(item.amount ?? item.totalPrice ?? 0),
            cost: Number(item.cost ?? 0),
            snapshotJson: JSON.stringify(item),
          },
        })
      }
      await tx.fulfillmentEvent.create({
        data: { orderId: created.id, type: 'PENDING', note: 'ORDER_CREATED_FROM_QUOTE', createdById: auth.user.id },
      })
      return created
    })

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (error) {
    console.error('From-quote error:', error)
    return NextResponse.json({ success: false, error: '报价转订单失败' }, { status: 500 })
  }
}

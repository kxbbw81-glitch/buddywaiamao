import { db } from '@/lib/db'
import type { PublicUser } from '@/lib/auth'
import { quotationScopeWhere } from '@/lib/commercial-access'

export type OrderFromQuoteResult =
  | { ok: true; order: Awaited<ReturnType<typeof db.order.create>> }
  | { ok: false; status: 400 | 404 | 409; error: string }

function orderNumber(): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  return `ORD-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

/**
 * 从已接受且满足毛利审批门禁的报价生成订单。
 * 修复说明：[P0-订单金额与状态绕过]，原因：旧订单接口信任前端金额/状态，且可绕开报价与审批。
 */
export async function createOrderFromQuote(quotationId: string, user: PublicUser): Promise<OrderFromQuoteResult> {
  const quote = await db.quotation.findFirst({
    where: { id: quotationId, ...quotationScopeWhere(user) },
    select: {
      id: true,
      customerId: true,
      currency: true,
      totalAmount: true,
      totalCost: true,
      profitRate: true,
      status: true,
      marginCheckPassed: true,
      approvedAt: true,
    },
  })
  if (!quote) return { ok: false, status: 404, error: '报价不存在或无权操作' }
  if (!quote.customerId) return { ok: false, status: 400, error: '报价未关联客户，无法转订单' }
  if (quote.status !== 'accepted') return { ok: false, status: 409, error: '仅客户已接受的报价可以转订单' }
  if (quote.marginCheckPassed === false && !quote.approvedAt) {
    return { ok: false, status: 409, error: '低毛利报价必须审批后才能转订单' }
  }

  const existing = await db.order.findFirst({ where: { quotationId: quote.id }, select: { id: true } })
  if (existing) return { ok: false, status: 409, error: '该报价已生成订单' }

  const version = await db.quoteVersion.findFirst({
    where: { quotationId: quote.id },
    orderBy: { version: 'desc' },
    select: { itemsJson: true },
  })
  if (!version) return { ok: false, status: 400, error: '报价没有版本快照，无法转订单' }

  let rawItems: Array<Record<string, unknown>>
  try {
    rawItems = JSON.parse(version.itemsJson) as Array<Record<string, unknown>>
  } catch {
    rawItems = []
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) return { ok: false, status: 400, error: '报价版本无明细' }

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNo: orderNumber(),
        quotationId: quote.id,
        customerId: quote.customerId,
        currency: quote.currency || 'USD',
        totalAmount: quote.totalAmount,
        status: 'confirmed',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'pending',
        createdById: user.id,
      },
    })
    await tx.orderItem.createMany({
      data: rawItems.map((item) => {
        const quantity = Number(item.quantity ?? 0)
        const unitPrice = Number(item.unitPrice ?? 0)
        const unitCost = Number(item.cost ?? item.unitCost ?? 0)
        return {
          orderId: created.id,
          productId: item.productId ? String(item.productId) : null,
          sku: item.sku ? String(item.sku) : null,
          name: String(item.productName || item.name || '报价明细'),
          quantity,
          unitPrice,
          unitCost,
          amount: Number(item.totalPrice ?? quantity * unitPrice),
          cost: Number(item.costTotal ?? quantity * unitCost),
          snapshotJson: JSON.stringify(item),
        }
      }),
    })
    await tx.fulfillmentEvent.create({
      data: { orderId: created.id, type: 'PENDING', note: 'ORDER_CREATED_FROM_ACCEPTED_QUOTE', createdById: user.id },
    })
    await tx.activity.create({
      data: { type: 'system', subject: 'ORDER_CREATED_FROM_QUOTE', entityType: 'order', entityId: created.id, userId: user.id },
    })
    return created
  })

  return { ok: true, order }
}

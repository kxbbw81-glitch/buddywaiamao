import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/**
 * POST /api/quotations/quick — 秒报价（移植自旧主线）
 * body: { customerId, opportunityId?, items:[{productId,name,quantity,unitPrice,unitCost?,unit?}], currency?, tradeTerm?, notes?, validUntil? }
 * 自动算 totalAmount/totalCost/profitRate，建 Quotation + QuotationItem[] + QuoteVersion(v1 快照)
 */
function genQuoteNo(): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `QUO-${stamp}-${rand}`
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const body = await request.json()
    const { customerId, opportunityId, items, currency, tradeTerm, notes, validUntil } = body

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId 必填' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
      return NextResponse.json({ success: false, error: '报价明细必须是 1-50 行' }, { status: 400 })
    }

    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, ownerId: true } })
    if (!customer) return NextResponse.json({ success: false, error: '客户不存在' }, { status: 404 })

    const lineItems: Array<{
      productId: string | null
      productName: string
      productSpec: string | null
      quantity: number
      unit: string
      unitPrice: number
      cost: number
      totalPrice: number
    }> = []
    let totalAmount = 0
    let totalCost = 0

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const quantity = Math.max(1, Math.round(Number(item.quantity ?? 1)))
      const unitPrice = Number(item.unitPrice ?? 0)
      const unitCost = Number(item.unitCost ?? 0)
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return NextResponse.json({ success: false, error: `第${i + 1}行单价无效` }, { status: 400 })
      }
      if (item.productId) {
        const p = await db.product.findUnique({ where: { id: item.productId }, select: { id: true } })
        if (!p) return NextResponse.json({ success: false, error: `第${i + 1}行产品不存在` }, { status: 404 })
      }
      const amount = Number((quantity * unitPrice).toFixed(2))
      const cost = Number((quantity * unitCost).toFixed(2))
      totalAmount += amount
      totalCost += cost
      lineItems.push({
        productId: item.productId || null,
        productName: String(item.name || item.productName || `行 ${i + 1}`),
        productSpec: item.spec || null,
        quantity,
        unit: item.unit || 'PCS',
        unitPrice,
        cost: unitCost,
        totalPrice: amount,
      })
    }

    totalAmount = Number(totalAmount.toFixed(2))
    totalCost = Number(totalCost.toFixed(2))
    const grossMargin = Number((totalAmount - totalCost).toFixed(2))
    const profitRate = totalAmount > 0 ? Number(((grossMargin / totalAmount) * 100).toFixed(2)) : 0

    const quoteNo = genQuoteNo()
    const result = await db.$transaction(async (tx) => {
      const created = await tx.quotation.create({
        data: {
          quoteNo,
          customerId,
          inquiryId: opportunityId || null,
          tradeTerm: tradeTerm || 'FOB',
          currency: (currency || 'USD').toUpperCase(),
          totalAmount,
          totalCost,
          profitRate,
          status: 'draft',
          notes: notes || null,
          validUntil: validUntil ? new Date(validUntil) : null,
          createdById: auth.user.id,
          ownerId: customer.ownerId || null,
          version: 1,
        },
      })
      await tx.quotationItem.createMany({
        data: lineItems.map((it) => ({
          quotationId: created.id,
          productId: it.productId,
          productName: it.productName,
          productSpec: it.productSpec,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          cost: it.cost,
          totalPrice: it.totalPrice,
        })),
      })
      const version = await tx.quoteVersion.create({
        data: {
          quotationId: created.id,
          version: 1,
          itemsJson: JSON.stringify(lineItems),
          notes: notes || null,
          totalAmount,
          totalCost,
          grossMargin,
          createdById: auth.user.id,
        },
      })
      return { created, version }
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('Quick quote error:', error)
    return NextResponse.json({ success: false, error: '秒报价失败' }, { status: 500 })
  }
}

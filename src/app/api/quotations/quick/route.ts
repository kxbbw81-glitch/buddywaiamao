import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { customerScopeWhere, requireAuth } from '@/lib/auth'
import { SALES_OPERATION_ROLES } from '@/lib/commercial-access'

const MIN_MARGIN_RATE = 10

function quoteNumber(): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `QUO-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

/**
 * 秒报价：只接受产品 ID，成本从产品库读取，金额由服务端重算。
 * 修复说明：[P0-报价成本篡改]，原因：旧秒报价信任客户端 unitCost，销售可伪造利润与审批结果。
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(SALES_OPERATION_ROLES)
  if (!auth.ok) return auth.response
  try {
    const body = await request.json()
    const { customerId, items, currency, tradeTerm, notes, validUntil } = body
    if (!customerId) return NextResponse.json({ success: false, error: 'customerId 必填' }, { status: 400 })
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
      return NextResponse.json({ success: false, error: '报价明细必须是 1-50 行' }, { status: 400 })
    }

    const customer = await db.customer.findFirst({
      where: { id: String(customerId), ...customerScopeWhere(auth.user) },
      select: { id: true, ownerId: true },
    })
    if (!customer) return NextResponse.json({ success: false, error: '客户不存在或无权操作' }, { status: 404 })

    const lineItems: Array<{
      productId: string
      productName: string
      productSpec: string | null
      quantity: number
      unit: string
      unitPrice: number
      cost: number
      totalPrice: number
      priceDeviationFlag: boolean
    }> = []
    let totalAmount = 0
    let totalCost = 0

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index] as Record<string, unknown>
      const productId = typeof item.productId === 'string' ? item.productId : ''
      const quantity = Number(item.quantity)
      const unitPrice = Number(item.unitPrice)
      if (!productId || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        return NextResponse.json({ success: false, error: `第${index + 1}行必须选择产品、填写正整数数量和正数单价` }, { status: 400 })
      }
      const product = await db.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, specification: true, unit: true, costPrice: true, minPrice: true, isActive: true },
      })
      if (!product || !product.isActive) return NextResponse.json({ success: false, error: `第${index + 1}行产品不存在或已下架` }, { status: 404 })
      const amount = Number((quantity * unitPrice).toFixed(2))
      const cost = Number((quantity * product.costPrice).toFixed(2))
      totalAmount += amount
      totalCost += cost
      lineItems.push({
        productId: product.id,
        productName: product.name,
        productSpec: product.specification,
        quantity,
        unit: product.unit || 'PCS',
        unitPrice,
        cost: product.costPrice,
        totalPrice: amount,
        priceDeviationFlag: product.minPrice > 0 && unitPrice < product.minPrice,
      })
    }

    totalAmount = Number(totalAmount.toFixed(2))
    totalCost = Number(totalCost.toFixed(2))
    const grossMargin = Number((totalAmount - totalCost).toFixed(2))
    const profitRate = totalAmount > 0 ? Number(((grossMargin / totalAmount) * 100).toFixed(2)) : 0
    const result = await db.$transaction(async (tx) => {
      const created = await tx.quotation.create({
        data: {
          quoteNo: quoteNumber(),
          customerId: customer.id,
          tradeTerm: tradeTerm || 'FOB',
          currency: String(currency || 'USD').toUpperCase(),
          totalAmount,
          totalCost,
          profitRate,
          status: 'draft',
          notes: notes || null,
          validUntil: validUntil ? new Date(validUntil) : null,
          createdById: auth.user.id,
          ownerId: customer.ownerId || auth.user.id,
          version: 1,
          marginCheckPassed: profitRate >= MIN_MARGIN_RATE,
        },
      })
      await tx.quotationItem.createMany({ data: lineItems.map((item) => ({ ...item, quotationId: created.id })) })
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
      await tx.activity.create({
        data: { type: 'system', subject: 'QUICK_QUOTE_CREATED', entityType: 'quotation', entityId: created.id, userId: auth.user.id },
      })
      return { created, version }
    })
    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('Quick quote error:', error)
    return NextResponse.json({ success: false, error: '秒报价失败' }, { status: 500 })
  }
}

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { customerScopeWhere, requireAuth } from '@/lib/auth'
import { quotationScopeWhere, SALES_OPERATION_ROLES } from '@/lib/commercial-access'

const MAX_PAGE_SIZE = 100
const MIN_MARGIN_RATE = 10

function validPage(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? Math.max(1, parsed) : fallback
}

function quoteNumber(): string {
  const now = new Date()
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  return `QT-${timestamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

/** 报价列表：统一会话与销售数据范围。 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const tradeTerm = searchParams.get('tradeTerm') || ''
    const customerId = searchParams.get('customerId') || ''
    const page = validPage(searchParams.get('page'), 1)
    const pageSize = Math.min(validPage(searchParams.get('pageSize'), 20), MAX_PAGE_SIZE)
    const where: Record<string, unknown> = { ...quotationScopeWhere(auth.user) }

    if (search) {
      where.AND = [
        quotationScopeWhere(auth.user),
        { OR: [{ quoteNo: { contains: search } }, { notes: { contains: search } }] },
      ]
      delete where.OR
    }
    if (status) where.status = status
    if (tradeTerm) where.tradeTerm = tradeTerm
    if (customerId) where.customerId = customerId

    const [quotations, total] = await Promise.all([
      db.quotation.findMany({
        where,
        include: {
          customer: { select: { id: true, companyName: true, country: true } },
          creator: { select: { name: true } },
          approver: { select: { name: true } },
          inquiry: { select: { inquiryNo: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.quotation.count({ where }),
    ])

    return NextResponse.json({ success: true, data: quotations, total, page, pageSize })
  } catch (error) {
    console.error('Quotations GET error:', error)
    return NextResponse.json({ success: false, error: '获取报价列表失败' }, { status: 500 })
  }
}

/**
 * 新建报价：金额由服务端按明细重算，创建人/归属只能来自会话。
 * 低毛利仍可保存草稿，但不能借此接口写入已审批、已发送或已接受状态。
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(SALES_OPERATION_ROLES)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    if (!body.customerId || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
      return NextResponse.json({ success: false, error: '客户和 1-50 条报价明细为必填项' }, { status: 400 })
    }

    const customer = await db.customer.findFirst({
      where: { id: String(body.customerId), ...customerScopeWhere(auth.user) },
      select: { id: true, ownerId: true },
    })
    if (!customer) return NextResponse.json({ success: false, error: '客户不存在或无权操作' }, { status: 404 })

    const exchangeRate = Number(body.exchangeRate ?? 1)
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      return NextResponse.json({ success: false, error: '汇率必须为正数' }, { status: 400 })
    }

    const items: Array<{ productId: string | null; productName: string; productSpec: string | null; quantity: number; unit: string; unitPrice: number; cost: number; totalPrice: number }> = []
    let totalAmount = 0
    let totalCost = 0
    for (let index = 0; index < body.items.length; index += 1) {
      const raw = body.items[index] as Record<string, unknown>
      const quantity = Number(raw.quantity)
      const unitPrice = Number(raw.unitPrice)
      const cost = Number(raw.cost)
      const productName = String(raw.productName || '').trim()
      if (!productName || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(cost) || cost < 0) {
        return NextResponse.json({ success: false, error: `第 ${index + 1} 行报价明细无效` }, { status: 400 })
      }
      const productId = raw.productId ? String(raw.productId) : null
      if (productId) {
        const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } })
        if (!product) return NextResponse.json({ success: false, error: `第 ${index + 1} 行产品不存在` }, { status: 404 })
      }
      const totalPrice = Number((quantity * unitPrice).toFixed(2))
      items.push({
        productId,
        productName,
        productSpec: raw.productSpec ? String(raw.productSpec) : null,
        quantity,
        unit: raw.unit ? String(raw.unit) : 'PCS',
        unitPrice,
        cost,
        totalPrice,
      })
      totalAmount += totalPrice
      totalCost += quantity * cost
    }

    totalAmount = Number(totalAmount.toFixed(2))
    totalCost = Number(totalCost.toFixed(2))
    const profitRate = totalCost > 0 ? Number((((totalAmount - totalCost) / totalCost) * 100).toFixed(2)) : 0
    const quotation = await db.$transaction(async (tx) => {
      const created = await tx.quotation.create({
        data: {
          quoteNo: quoteNumber(),
          customerId: customer.id,
          inquiryId: body.inquiryId ? String(body.inquiryId) : null,
          tradeTerm: body.tradeTerm || 'FOB',
          currency: String(body.currency || 'USD').toUpperCase(),
          exchangeRate,
          totalAmount,
          totalCost,
          profitRate,
          validUntil: body.validUntil ? new Date(body.validUntil) : null,
          notes: body.notes ? String(body.notes) : null,
          marginCheckPassed: profitRate >= MIN_MARGIN_RATE,
          createdById: auth.user.id,
          ownerId: customer.ownerId || auth.user.id,
          status: 'draft',
          items: { create: items },
        },
      })
      await tx.quoteVersion.create({
        data: {
          quotationId: created.id,
          version: 1,
          itemsJson: JSON.stringify(items),
          notes: created.notes,
          totalAmount,
          totalCost,
          grossMargin: Number((totalAmount - totalCost).toFixed(2)),
          createdById: auth.user.id,
        },
      })
      await tx.activity.create({
        data: { type: 'system', subject: 'QUOTE_CREATED', entityType: 'quotation', entityId: created.id, userId: auth.user.id },
      })
      return created
    })

    return NextResponse.json({ success: true, data: quotation }, { status: 201 })
  } catch (error) {
    console.error('Quotations POST error:', error)
    return NextResponse.json({ success: false, error: '创建报价失败' }, { status: 500 })
  }
}

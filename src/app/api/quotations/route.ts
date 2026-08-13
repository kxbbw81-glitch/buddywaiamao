import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const tradeTerm = searchParams.get('tradeTerm') || ''
    const customerId = searchParams.get('customerId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { quoteNo: { contains: search } },
        { notes: { contains: search } },
      ]
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const count = await db.quotation.count()
    const quoteNo = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`

    let totalAmount = 0
    let totalCost = 0
    if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        totalAmount += item.quantity * item.unitPrice
        totalCost += item.quantity * item.cost
      }
    }
    const profitRate = totalCost > 0 ? ((totalAmount - totalCost) / totalCost) * 100 : 0

    const quotation = await db.quotation.create({
      data: {
        quoteNo,
        customerId: body.customerId,
        inquiryId: body.inquiryId || null,
        tradeTerm: body.tradeTerm || 'FOB',
        currency: body.currency || 'USD',
        exchangeRate: body.exchangeRate || 7.24,
        totalAmount,
        totalCost,
        profitRate,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        notes: body.notes,
        marginCheckPassed: profitRate >= 10,
        createdById: body.createdById,
        items: {
          create: body.items.map((item: Record<string, unknown>) => ({
            productId: item.productId || null,
            productName: item.productName,
            productSpec: item.productSpec,
            quantity: item.quantity,
            unit: item.unit || 'PCS',
            unitPrice: item.unitPrice,
            cost: item.cost,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
    })

    return NextResponse.json({ success: true, data: quotation }, { status: 201 })
  } catch (error) {
    console.error('Quotations POST error:', error)
    return NextResponse.json({ success: false, error: '创建报价失败' }, { status: 500 })
  }
}

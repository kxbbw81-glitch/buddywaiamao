import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { orderNo: { contains: search } },
        { piNo: { contains: search } },
      ]
    }
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const count = await db.order.count()
    const orderNo = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
    const piNo = body.piNo || `PI-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`

    const order = await db.order.create({
      data: {
        orderNo,
        piNo,
        quotationId: body.quotationId || null,
        customerId: body.customerId,
        status: body.status || 'pending',
        totalAmount: body.totalAmount,
        currency: body.currency || 'USD',
        paymentTerm: body.paymentTerm,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        createdById: body.createdById,
      },
    })
    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (error) {
    console.error('Orders POST error:', error)
    return NextResponse.json({ success: false, error: '创建订单失败' }, { status: 500 })
  }
}

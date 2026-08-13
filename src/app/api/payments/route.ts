import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    const where: Record<string, unknown> = {}
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payment = await db.payment.create({
      data: {
        orderId: body.orderId,
        amount: body.amount,
        currency: body.currency || 'USD',
        paymentMethod: body.paymentMethod || null,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        status: body.status || 'pending',
        notes: body.notes || null,
      },
    })
    return NextResponse.json({ success: true, data: payment }, { status: 201 })
  } catch (error) {
    console.error('Payments POST error:', error)
    return NextResponse.json({ success: false, error: '创建付款记录失败' }, { status: 500 })
  }
}

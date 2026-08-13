import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { productName: { contains: search } },
        { trackingNo: { contains: search } },
        { customer: { companyName: { contains: search } } },
      ]
    }
    if (status) where.status = status

    const [samples, total] = await Promise.all([
      db.sample.findMany({
        where,
        include: {
          customer: { select: { id: true, companyName: true, country: true } },
          inquiry: { select: { id: true, inquiryNo: true, subject: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.sample.count({ where }),
    ])

    return NextResponse.json({ success: true, data: samples, total, page, pageSize })
  } catch (error) {
    console.error('Samples GET error:', error)
    return NextResponse.json({ success: false, error: '获取样品列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const sample = await db.sample.create({
      data: {
        customerId: body.customerId || null,
        inquiryId: body.inquiryId || null,
        productName: body.productName,
        quantity: body.quantity || 1,
        status: body.status || 'pending',
        trackingNo: body.trackingNo || null,
        shippingMethod: body.shippingMethod || null,
        notes: body.notes || null,
      },
    })
    return NextResponse.json({ success: true, data: sample }, { status: 201 })
  } catch (error) {
    console.error('Samples POST error:', error)
    return NextResponse.json({ success: false, error: '创建样品失败' }, { status: 500 })
  }
}

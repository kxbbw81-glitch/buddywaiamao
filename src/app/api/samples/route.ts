import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { customerScopeWhere, requireAuth } from '@/lib/auth'
import { inquiryScopeWhere, SALES_OPERATION_ROLES, sampleScopeWhere } from '@/lib/commercial-access'

function pageValue(value: string | null, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = pageValue(searchParams.get('page'), 1, Number.MAX_SAFE_INTEGER)
    const pageSize = pageValue(searchParams.get('pageSize'), 50, 100)
    const scope = sampleScopeWhere(auth.user)
    const where: Record<string, unknown> = { ...scope }
    if (search) {
      where.AND = [
        scope,
        {
          OR: [
            { productName: { contains: search } },
            { trackingNo: { contains: search } },
            { customer: { companyName: { contains: search } } },
          ],
        },
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

/** 创建样品只能作为待处理申请；物流和签收状态由后续履约流程更新。 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(SALES_OPERATION_ROLES)
  if (!auth.ok) return auth.response
  try {
    const body = await request.json()
    const productName = typeof body.productName === 'string' ? body.productName.trim() : ''
    const quantity = Number(body.quantity ?? 1)
    if (!productName || !Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ success: false, error: '样品名称和正整数数量为必填项' }, { status: 400 })
    }
    const customerId = typeof body.customerId === 'string' && body.customerId ? body.customerId : null
    const inquiryId = typeof body.inquiryId === 'string' && body.inquiryId ? body.inquiryId : null
    if (customerId) {
      const customer = await db.customer.findFirst({ where: { id: customerId, ...customerScopeWhere(auth.user) }, select: { id: true } })
      if (!customer) return NextResponse.json({ success: false, error: '客户不存在或无权操作' }, { status: 404 })
    }
    if (inquiryId) {
      const inquiry = await db.inquiry.findFirst({ where: { id: inquiryId, ...inquiryScopeWhere(auth.user) }, select: { id: true } })
      if (!inquiry) return NextResponse.json({ success: false, error: '询盘不存在或无权操作' }, { status: 404 })
    }
    const sample = await db.$transaction(async (tx) => {
      const created = await tx.sample.create({
        data: {
          customerId,
          inquiryId,
          productName,
          quantity,
          status: 'pending',
          notes: body.notes ? String(body.notes) : null,
        },
      })
      await tx.activity.create({
        data: { type: 'system', subject: 'SAMPLE_REQUEST_CREATED', entityType: 'sample', entityId: created.id, userId: auth.user.id },
      })
      return created
    })
    return NextResponse.json({ success: true, data: sample }, { status: 201 })
  } catch (error) {
    console.error('Samples POST error:', error)
    return NextResponse.json({ success: false, error: '创建样品失败' }, { status: 500 })
  }
}

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, opportunityScopeWhere } from '@/lib/auth'

const STAGES = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response
    const scope = opportunityScopeWhere(auth.user)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const stage = searchParams.get('stage') || ''
    const customerId = searchParams.get('customerId') || ''
    const ownerId = searchParams.get('ownerId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '100'), 500)

    const where: Record<string, unknown> = { ...scope }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { notes: { contains: search } },
        { customer: { companyName: { contains: search } } },
      ]
    }
    if (stage) where.stage = stage
    if (customerId) where.customerId = customerId
    // 销售固定只看自己；管理角色可按人筛选
    if (auth.user.primaryRole !== 'sales' && ownerId) where.ownerId = ownerId

    const [opportunities, total] = await Promise.all([
      db.opportunity.findMany({
        where,
        include: {
          customer: { select: { id: true, companyName: true, country: true, customerLevel: true } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.opportunity.count({ where }),
    ])

    return NextResponse.json({ success: true, data: opportunities, total, page, pageSize })
  } catch (error) {
    console.error('Opportunities GET error:', error)
    return NextResponse.json({ success: false, error: '获取商机列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response

    const body = await request.json()
    if (!body.title) {
      return NextResponse.json({ success: false, error: '商机名称不能为空' }, { status: 400 })
    }
    if (body.stage && !STAGES.includes(body.stage)) {
      return NextResponse.json({ success: false, error: '无效的商机阶段' }, { status: 400 })
    }

    // 数据权限：销售创建的商机自动归属自己
    const ownerId = auth.user.primaryRole === 'sales' ? auth.user.id : body.ownerId || auth.user.id

    const opportunity = await db.opportunity.create({
      data: {
        title: body.title,
        customerId: body.customerId || null,
        inquiryId: body.inquiryId || null,
        stage: body.stage || 'prospect',
        amount: Number(body.amount) || 0,
        currency: body.currency || 'USD',
        probability: Math.max(0, Math.min(100, parseInt(body.probability ?? '30') || 0)),
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
        notes: body.notes,
        ownerId,
      },
      include: {
        customer: { select: { id: true, companyName: true, country: true, customerLevel: true } },
        owner: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ success: true, data: opportunity }, { status: 201 })
  } catch (error) {
    console.error('Opportunities POST error:', error)
    return NextResponse.json({ success: false, error: '创建商机失败' }, { status: 500 })
  }
}

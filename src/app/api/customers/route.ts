import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, customerScopeWhere } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response
    const scope = customerScopeWhere(auth.user)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const level = searchParams.get('level') || ''
    const status = searchParams.get('status') || ''
    const country = searchParams.get('country') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    const where: Record<string, unknown> = { ...scope }
    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { companyNameEn: { contains: search } },
        { country: { contains: search } },
      ]
    }
    if (level) where.customerLevel = level
    if (status) where.status = status
    if (country) where.country = country

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          _count: { select: { contacts: true, inquiries: true, quotations: true, orders: true } },
        },
        orderBy: { lastContactAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.customer.count({ where }),
    ])

    return NextResponse.json({ success: true, data: customers, total, page, pageSize })
  } catch (error) {
    console.error('Customers GET error:', error)
    return NextResponse.json({ success: false, error: '获取客户列表失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response

    const body = await request.json()
    // 数据权限：销售创建的客户自动归属自己
    const ownerId = auth.user.primaryRole === 'sales' ? auth.user.id : body.ownerId || auth.user.id
    const customer = await db.customer.create({
      data: {
        companyName: body.companyName,
        companyNameEn: body.companyNameEn,
        country: body.country,
        city: body.city,
        website: body.website,
        industry: body.industry,
        customerLevel: body.customerLevel || 'C',
        source: body.source || 'manual',
        tags: body.tags || '[]',
        notes: body.notes,
        ownerId,
      },
    })

    if (body.contacts && body.contacts.length > 0) {
      await db.contact.createMany({
        data: body.contacts.map((c: Record<string, unknown>) => ({
          customerId: customer.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          whatsapp: c.whatsapp,
          position: c.position,
          isDecisionMaker: c.isDecisionMaker || false,
          notes: c.notes,
        })),
      })
    }

    return NextResponse.json({ success: true, data: customer }, { status: 201 })
  } catch (error) {
    console.error('Customers POST error:', error)
    return NextResponse.json({ success: false, error: '创建客户失败' }, { status: 500 })
  }
}

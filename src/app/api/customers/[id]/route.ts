import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

/** 销售角色访问他人客户时返回 403 */
function canAccessCustomer(user: { id: string; primaryRole: string }, ownerId: string | null): boolean {
  if (user.primaryRole === 'sales') {
    return ownerId === user.id
  }
  return true
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, primaryRole: true } },
        contacts: { orderBy: { createdAt: 'asc' } },
        inquiries: { include: { assignee: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
        quotations: { include: { creator: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
        orders: { orderBy: { createdAt: 'desc' }, take: 20 },
        samples: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!customer) {
      return NextResponse.json({ success: false, error: '客户不存在' }, { status: 404 })
    }
    if (!canAccessCustomer(auth.user, customer.ownerId)) {
      return NextResponse.json({ success: false, error: '无权查看该客户（非本人名下数据）' }, { status: 403 })
    }
    const activities = await db.activity.findMany({
      where: { entityType: 'customer', entityId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    return NextResponse.json({ success: true, data: { ...customer, activities } })
  } catch (error) {
    console.error('Customer GET error:', error)
    return NextResponse.json({ success: false, error: '获取客户详情失败' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const existing = await db.customer.findUnique({ where: { id }, select: { ownerId: true } })
    if (!existing) {
      return NextResponse.json({ success: false, error: '客户不存在' }, { status: 404 })
    }
    if (!canAccessCustomer(auth.user, existing.ownerId)) {
      return NextResponse.json({ success: false, error: '无权修改该客户（非本人名下数据）' }, { status: 403 })
    }

    const body = await request.json()
    // 销售不能把客户转移给他人；ownerId 变更仅管理角色可操作
    const ownerId =
      auth.user.primaryRole === 'sales' ? existing.ownerId : body.ownerId ?? existing.ownerId
    const customer = await db.customer.update({
      where: { id },
      data: {
        companyName: body.companyName,
        companyNameEn: body.companyNameEn,
        country: body.country,
        city: body.city,
        website: body.website,
        industry: body.industry,
        customerLevel: body.customerLevel,
        source: body.source,
        tags: body.tags,
        notes: body.notes,
        status: body.status,
        ownerId,
        lastContactAt: body.lastContactAt,
      },
    })
    return NextResponse.json({ success: true, data: customer })
  } catch (error) {
    console.error('Customer PUT error:', error)
    return NextResponse.json({ success: false, error: '更新客户失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 删除客户仅限管理角色
    const auth = await requireAuth(['super_admin', 'management', 'sales_manager'])
    if (!auth.ok) return auth.response

    const { id } = await params
    await db.customer.delete({ where: { id } })
    return NextResponse.json({ success: true, message: '客户已删除' })
  } catch (error) {
    console.error('Customer DELETE error:', error)
    return NextResponse.json({ success: false, error: '删除客户失败' }, { status: 500 })
  }
}

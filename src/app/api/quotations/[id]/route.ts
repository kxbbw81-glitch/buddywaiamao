import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { MANAGER_ROLES, requireAuth } from '@/lib/auth'
import { quotationScopeWhere, SALES_OPERATION_ROLES } from '@/lib/commercial-access'

const EDITABLE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired']
const MIN_MARGIN_RATE = 10

async function accessibleQuotation(id: string, user: Parameters<typeof quotationScopeWhere>[0]) {
  return db.quotation.findFirst({
    where: { id, ...quotationScopeWhere(user) },
    include: { _count: { select: { orders: true } } },
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const quotation = await db.quotation.findFirst({
      where: { id, ...quotationScopeWhere(auth.user) },
      include: {
        customer: { select: { id: true, companyName: true, companyNameEn: true, country: true } },
        creator: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        inquiry: { select: { inquiryNo: true, subject: true } },
        items: { include: { product: { select: { productCode: true } } } },
        orders: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!quotation) return NextResponse.json({ success: false, error: '报价不存在或无权访问' }, { status: 404 })
    return NextResponse.json({ success: true, data: quotation })
  } catch (error) {
    console.error('Quotation GET error:', error)
    return NextResponse.json({ success: false, error: '获取报价详情失败' }, { status: 500 })
  }
}

/**
 * 仅允许修改报价的非金额元数据和受控状态；金额/成本/审批人由专用计算与审批流程维护。
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(SALES_OPERATION_ROLES)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const existing = await accessibleQuotation(id, auth.user)
    if (!existing) return NextResponse.json({ success: false, error: '报价不存在或无权操作' }, { status: 404 })
    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) {
      const status = String(body.status)
      if (!EDITABLE_STATUSES.includes(status)) {
        return NextResponse.json({ success: false, error: '无效的报价状态' }, { status: 400 })
      }
      if (status === 'accepted' && existing.profitRate < MIN_MARGIN_RATE && !existing.approvedAt) {
        return NextResponse.json({ success: false, error: '低毛利报价必须先完成审批' }, { status: 409 })
      }
      updateData.status = status
    }
    if (body.validUntil !== undefined) updateData.validUntil = body.validUntil ? new Date(body.validUntil) : null
    if (body.notes !== undefined) updateData.notes = body.notes ? String(body.notes) : null

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '仅可更新报价状态、有效期或备注；金额与审批需走专用流程' }, { status: 400 })
    }

    const quotation = await db.$transaction(async (tx) => {
      const updated = await tx.quotation.update({ where: { id }, data: updateData })
      await tx.activity.create({
        data: { type: 'system', subject: 'QUOTE_UPDATED', entityType: 'quotation', entityId: id, userId: auth.user.id },
      })
      return updated
    })
    return NextResponse.json({ success: true, data: quotation })
  } catch (error) {
    console.error('Quotation PUT error:', error)
    return NextResponse.json({ success: false, error: '更新报价失败' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(MANAGER_ROLES)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const quotation = await accessibleQuotation(id, auth.user)
    if (!quotation) return NextResponse.json({ success: false, error: '报价不存在或无权操作' }, { status: 404 })
    if (quotation._count.orders > 0) {
      return NextResponse.json({ success: false, error: '已有关联订单的报价不能删除' }, { status: 409 })
    }
    await db.$transaction(async (tx) => {
      await tx.quotation.delete({ where: { id } })
      await tx.activity.create({
        data: { type: 'system', subject: 'QUOTE_DELETED', entityType: 'quotation', entityId: id, userId: auth.user.id },
      })
    })
    return NextResponse.json({ success: true, message: '报价已删除' })
  } catch (error) {
    console.error('Quotation DELETE error:', error)
    return NextResponse.json({ success: false, error: '删除报价失败' }, { status: 500 })
  }
}

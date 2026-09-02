import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { customerScopeWhere, MANAGER_ROLES, requireAuth } from '@/lib/auth'
import { inquiryScopeWhere, SALES_OPERATION_ROLES } from '@/lib/commercial-access'

type EntityType = 'inquiry' | 'quotation' | 'order' | 'payment' | 'customer'
const INQUIRY_STATUSES = ['new', 'assigned', 'following', 'quoted', 'won', 'lost', 'pooled', 'closed']

/**
 * 仅保留询盘与客户卡片的受控快速操作。
 * 修复说明：[P0-批量状态越权]，原因：旧接口可匿名直接推进报价、订单、回款和履约状态，绕过审批/财务门禁。
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response
  try {
    const body = await request.json()
    const { entityType, id, status, customerLevel } = body as { entityType: EntityType; id: string; status?: string; customerLevel?: string }
    if (!entityType || !id || !['inquiry', 'quotation', 'order', 'payment', 'customer'].includes(entityType)) {
      return NextResponse.json({ success: false, error: '无效的实体类型或参数' }, { status: 400 })
    }
    if (entityType === 'quotation' || entityType === 'order' || entityType === 'payment') {
      return NextResponse.json({ success: false, error: '报价、订单和回款状态必须使用专用审批、履约或财务确认流程' }, { status: 409 })
    }

    if (entityType === 'customer') {
      const write = await requireAuth(MANAGER_ROLES)
      if (!write.ok) return write.response
      if (!customerLevel || !['A', 'B', 'C', 'D'].includes(customerLevel)) {
        return NextResponse.json({ success: false, error: '无效的客户级别' }, { status: 400 })
      }
      const customer = await db.customer.findFirst({ where: { id, ...customerScopeWhere(write.user) }, select: { id: true } })
      if (!customer) return NextResponse.json({ success: false, error: '客户不存在或无权操作' }, { status: 404 })
      await db.$transaction(async (tx) => {
        await tx.customer.update({ where: { id }, data: { customerLevel } })
        await tx.activity.create({ data: { type: 'system', subject: 'CUSTOMER_LEVEL_UPDATED', entityType: 'customer', entityId: id, userId: write.user.id } })
      })
      return NextResponse.json({ success: true })
    }

    const write = await requireAuth(SALES_OPERATION_ROLES)
    if (!write.ok) return write.response
    if (!status || !INQUIRY_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: '无效的询盘状态' }, { status: 400 })
    }
    const inquiry = await db.inquiry.findFirst({ where: { id, ...inquiryScopeWhere(write.user) }, select: { id: true } })
    if (!inquiry) return NextResponse.json({ success: false, error: '询盘不存在或无权操作' }, { status: 404 })
    await db.$transaction(async (tx) => {
      await tx.inquiry.update({ where: { id }, data: { status } })
      await tx.activity.create({ data: { type: 'system', subject: 'INQUIRY_STATUS_UPDATED', entityType: 'inquiry', entityId: id, userId: write.user.id } })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bulk update status error:', error)
    return NextResponse.json({ success: false, error: '更新状态失败' }, { status: 500 })
  }
}

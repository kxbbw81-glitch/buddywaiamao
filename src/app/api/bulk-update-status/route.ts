import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

type EntityType = 'inquiry' | 'quotation' | 'order' | 'payment' | 'customer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entityType, id, status, customerLevel } = body as {
      entityType: EntityType
      id: string
      status?: string
      customerLevel?: string
    }

    if (!entityType || !id) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const validTypes: EntityType[] = ['inquiry', 'quotation', 'order', 'payment', 'customer']
    if (!validTypes.includes(entityType)) {
      return NextResponse.json(
        { success: false, error: '无效的实体类型' },
        { status: 400 }
      )
    }

    switch (entityType) {
      case 'customer': {
        if (!customerLevel) {
          return NextResponse.json(
            { success: false, error: '缺少客户级别' },
            { status: 400 }
          )
        }
        const validLevels = ['A', 'B', 'C', 'D']
        if (!validLevels.includes(customerLevel)) {
          return NextResponse.json(
            { success: false, error: '无效的客户级别' },
            { status: 400 }
          )
        }
        await db.customer.update({
          where: { id },
          data: { customerLevel },
        })
        break
      }

      case 'inquiry': {
        if (!status) {
          return NextResponse.json(
            { success: false, error: '缺少状态' },
            { status: 400 }
          )
        }
        const validStatuses = ['new', 'assigned', 'following', 'quoted', 'won', 'lost', 'pooled', 'closed']
        if (!validStatuses.includes(status)) {
          return NextResponse.json(
            { success: false, error: '无效的询盘状态' },
            { status: 400 }
          )
        }
        await db.inquiry.update({
          where: { id },
          data: { status },
        })
        break
      }

      case 'quotation': {
        if (!status) {
          return NextResponse.json(
            { success: false, error: '缺少状态' },
            { status: 400 }
          )
        }
        const validStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled']
        if (!validStatuses.includes(status)) {
          return NextResponse.json(
            { success: false, error: '无效的报价状态' },
            { status: 400 }
          )
        }
        await db.quotation.update({
          where: { id },
          data: { status },
        })
        break
      }

      case 'order': {
        if (!status) {
          return NextResponse.json(
            { success: false, error: '缺少状态' },
            { status: 400 }
          )
        }
        const validStatuses = ['pending', 'confirmed', 'in_production', 'ready', 'shipped', 'completed', 'cancelled']
        if (!validStatuses.includes(status)) {
          return NextResponse.json(
            { success: false, error: '无效的订单状态' },
            { status: 400 }
          )
        }
        await db.order.update({
          where: { id },
          data: { status },
        })
        break
      }

      case 'payment': {
        if (!status) {
          return NextResponse.json(
            { success: false, error: '缺少状态' },
            { status: 400 }
          )
        }
        const validStatuses = ['pending', 'partial', 'completed', 'overdue']
        if (!validStatuses.includes(status)) {
          return NextResponse.json(
            { success: false, error: '无效的收款状态' },
            { status: 400 }
          )
        }
        await db.payment.update({
          where: { id },
          data: { status },
        })
        break
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bulk update status error:', error)
    return NextResponse.json(
      { success: false, error: '更新状态失败' },
      { status: 500 }
    )
  }
}

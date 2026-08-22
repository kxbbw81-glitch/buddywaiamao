import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

const STAGES = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

function canAccess(user: { id: string; primaryRole: string }, ownerId: string | null): boolean {
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
    const opportunity = await db.opportunity.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, companyName: true, country: true, customerLevel: true } },
        inquiry: { select: { id: true, inquiryNo: true, subject: true } },
        owner: { select: { id: true, name: true } },
      },
    })
    if (!opportunity) {
      return NextResponse.json({ success: false, error: '商机不存在' }, { status: 404 })
    }
    if (!canAccess(auth.user, opportunity.ownerId)) {
      return NextResponse.json({ success: false, error: '无权查看该商机（非本人名下数据）' }, { status: 403 })
    }
    return NextResponse.json({ success: true, data: opportunity })
  } catch (error) {
    console.error('Opportunity GET error:', error)
    return NextResponse.json({ success: false, error: '获取商机详情失败' }, { status: 500 })
  }
}

/**
 * PUT 更新商机（看板拖拽改阶段也走这里）
 * - 阶段流转到 won/lost 时自动记录 closedAt；回到进行中阶段时清空
 * - 阶段变化时按预设映射刷新 probability（显式传入 probability 则优先生效）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const existing = await db.opportunity.findUnique({ where: { id }, select: { ownerId: true, stage: true } })
    if (!existing) {
      return NextResponse.json({ success: false, error: '商机不存在' }, { status: 404 })
    }
    if (!canAccess(auth.user, existing.ownerId)) {
      return NextResponse.json({ success: false, error: '无权修改该商机（非本人名下数据）' }, { status: 403 })
    }

    const body = await request.json()
    if (body.stage && !STAGES.includes(body.stage)) {
      return NextResponse.json({ success: false, error: '无效的商机阶段' }, { status: 400 })
    }

    // 阶段默认概率（未显式传 probability 且阶段发生变化时使用）
    const STAGE_PROBABILITY: Record<string, number> = {
      prospect: 20,
      qualified: 40,
      proposal: 60,
      negotiation: 75,
      won: 100,
      lost: 0,
    }

    const stageChanged = body.stage && body.stage !== existing.stage
    let probability: number | undefined
    if (body.probability !== undefined && body.probability !== null) {
      probability = Math.max(0, Math.min(100, parseInt(String(body.probability)) || 0))
    } else if (stageChanged && body.stage) {
      probability = STAGE_PROBABILITY[body.stage]
    }

    // 销售不能把商机转移给他人
    const ownerId =
      auth.user.primaryRole === 'sales' ? existing.ownerId : body.ownerId ?? existing.ownerId

    const opportunity = await db.opportunity.update({
      where: { id },
      data: {
        title: body.title,
        customerId: body.customerId,
        inquiryId: body.inquiryId,
        stage: body.stage,
        amount: body.amount !== undefined ? Number(body.amount) || 0 : undefined,
        currency: body.currency,
        probability,
        expectedCloseDate: body.expectedCloseDate
          ? new Date(body.expectedCloseDate)
          : body.expectedCloseDate === null
            ? null
            : undefined,
        notes: body.notes,
        lostReason: body.stage === 'lost' ? body.lostReason ?? undefined : body.stage ? null : undefined,
        closedAt:
          body.stage === 'won' || body.stage === 'lost'
            ? new Date()
            : body.stage
              ? null
              : undefined,
        ownerId,
      },
      include: {
        customer: { select: { id: true, companyName: true, country: true, customerLevel: true } },
        owner: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ success: true, data: opportunity })
  } catch (error) {
    console.error('Opportunity PUT error:', error)
    return NextResponse.json({ success: false, error: '更新商机失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 删除商机仅限管理角色
    const auth = await requireAuth(['super_admin', 'management', 'sales_manager'])
    if (!auth.ok) return auth.response

    const { id } = await params
    await db.opportunity.delete({ where: { id } })
    return NextResponse.json({ success: true, message: '商机已删除' })
  } catch (error) {
    console.error('Opportunity DELETE error:', error)
    return NextResponse.json({ success: false, error: '删除商机失败' }, { status: 500 })
  }
}

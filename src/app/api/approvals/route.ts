import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const APPROVER_ROLES = ['sales_manager', 'finance', 'management', 'super_admin']
const LOW_MARGIN_THRESHOLD = 10 // 毛利底线 10%
const RELEASE_GATE_RATIO = 0.3 // 收款门禁：预付款 30%

export interface ApprovalCard {
  id: string // type:refId
  type: 'LOW_MARGIN' | 'DISCOUNT' | 'RELEASE'
  typeLabel: string
  title: string
  aiRisk?: string
  meta: string
  requester: string
  createdAt?: string
}

/**
 * GET /api/approvals
 * 待我审批（由确定性规则从真实数据计算）+ 审批历史（Approval 表）
 * 规则（对照原型与交接文档 §3.7）：
 * - LOW_MARGIN 报价低毛利：draft/sent 且未审批且 profitRate < 10%
 * - DISCOUNT 价格偏差：报价明细含 priceDeviationFlag 且未审批
 * - RELEASE 收款门禁放行：pending 订单预付款已达 30% 门禁
 * AI 只标注风险，不做决定。
 */
export async function GET() {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const [quotations, orders, decided] = await Promise.all([
    db.quotation.findMany({
      where: { status: { in: ['draft', 'sent'] }, approvedAt: null },
      include: {
        customer: { select: { companyName: true, country: true } },
        creator: { select: { name: true } },
        items: { select: { quantity: true, unit: true, priceDeviationFlag: true, productName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.order.findMany({
      where: { status: 'pending', totalAmount: { gt: 0 } },
      include: {
        customer: { select: { companyName: true } },
        creator: { select: { name: true } },
        payments: { select: { amount: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.approval.findMany({ orderBy: { updatedAt: 'desc' }, take: 50 }),
  ])

  const decidedKeys = new Set(
    decided.filter((d) => d.status !== 'PENDING').map((d) => `${d.type}:${d.refId}`)
  )

  const pending: ApprovalCard[] = []

  for (const q of quotations) {
    if (decidedKeys.has(`LOW_MARGIN:${q.id}`)) continue
    const qty = q.items.reduce((s, it) => s + it.quantity, 0)
    if (q.profitRate < LOW_MARGIN_THRESHOLD) {
      pending.push({
        id: `LOW_MARGIN:${q.id}`,
        type: 'LOW_MARGIN',
        typeLabel: '报价',
        title: `${q.quoteNo} · ${q.customer?.companyName || '未知客户'} · ${q.tradeTerm} 报价`,
        aiRisk: `AI：毛利 ${q.profitRate.toFixed(1)}% 低于 ${LOW_MARGIN_THRESHOLD}% 底线`,
        meta: `${qty.toLocaleString()} ${q.items[0]?.unit || 'PCS'} · ${q.currency} ${q.totalAmount.toLocaleString()} · ${q.creator?.name || '未知'} 提交 · 版本 v${q.version}`,
        requester: q.createdById || '',
        createdAt: q.createdAt.toISOString(),
      })
    }
  }

  for (const q of quotations) {
    if (decidedKeys.has(`DISCOUNT:${q.id}`)) continue
    const devItems = q.items.filter((it) => it.priceDeviationFlag)
    if (devItems.length > 0) {
      const names = [...new Set(devItems.map((it) => it.productName))].slice(0, 2).join('、')
      pending.push({
        id: `DISCOUNT:${q.id}`,
        type: 'DISCOUNT',
        typeLabel: '折扣',
        title: `${q.quoteNo} · ${q.customer?.companyName || '未知客户'} · 价格偏差`,
        aiRisk: `AI：${names}等 ${devItems.length} 项报价偏离历史成交价，需人工复核`,
        meta: `规则版本 v2.3 · ${q.creator?.name || '未知'} 提交 · 版本 v${q.version}`,
        requester: q.createdById || '',
        createdAt: q.createdAt.toISOString(),
      })
    }
  }

  for (const o of orders) {
    if (decidedKeys.has(`RELEASE:${o.id}`)) continue
    const ratio = o.paidAmount / o.totalAmount
    if (ratio >= RELEASE_GATE_RATIO) {
      pending.push({
        id: `RELEASE:${o.id}`,
        type: 'RELEASE',
        typeLabel: '放行',
        title: `${o.orderNo} · 提前放行申请`,
        meta: `收款门禁：预付款 ${Math.round(ratio * 100)}% 已到账（约定 ${RELEASE_GATE_RATIO * 100}%）· ${
          o.paymentTerm || 'T/T 30% 预付'
        } · ${o.customer?.companyName || '未知客户'}`,
        requester: o.createdById || '',
        createdAt: o.createdAt.toISOString(),
      })
    }
  }

  const history = decided.slice(0, 20)

  return NextResponse.json({ success: true, data: { pending, history } })
}

/**
 * POST /api/approvals
 * body: { id: 'TYPE:refId', decision: 'APPROVED' | 'REJECTED' }
 * 通过/驳回待审批项：写入 Approval 记录并回写业务单据
 * - LOW_MARGIN / DISCOUNT → 回写 quotation.approvedBy/approvedAt
 * - RELEASE（仅 APPROVED）→ 订单状态置为 confirmed（收款门禁放行生产）
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(APPROVER_ROLES)
  if (!auth.ok) return auth.response
  const user = auth.user

  const body = await request.json().catch(() => null)
  if (!body?.id || (body.decision !== 'APPROVED' && body.decision !== 'REJECTED')) {
    return NextResponse.json({ success: false, error: '参数错误：需 id 与 decision' }, { status: 400 })
  }

  const [type, refId] = String(body.id).split(':')
  if (!refId || !['LOW_MARGIN', 'DISCOUNT', 'RELEASE'].includes(type)) {
    return NextResponse.json({ success: false, error: '未知的审批类型' }, { status: 400 })
  }

  const aiRisk = typeof body.aiRisk === 'string' ? body.aiRisk : null
  const requester = typeof body.requester === 'string' ? body.requester : ''

  const record = await db.approval.upsert({
    where: { type_refId: { type, refId } },
    update: { status: body.decision, approver: user.id, updatedAt: new Date() },
    create: {
      type,
      refId,
      requester,
      status: body.decision,
      approver: user.id,
      aiRisk,
    },
  })

  if (body.decision === 'APPROVED') {
    if (type === 'LOW_MARGIN' || type === 'DISCOUNT') {
      await db.quotation.update({
        where: { id: refId },
        data: { approvedBy: user.id, approvedAt: new Date(), marginCheckPassed: type === 'LOW_MARGIN' ? true : undefined },
      })
    } else if (type === 'RELEASE') {
      await db.order.update({ where: { id: refId }, data: { status: 'confirmed' } })
    }
  }

  return NextResponse.json({ success: true, data: record })
}

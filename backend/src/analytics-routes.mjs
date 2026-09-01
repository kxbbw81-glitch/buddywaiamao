import { getDashboardData } from './dashboard-routes.mjs'
import { HttpError, send } from './http.mjs'
import { scopeFor } from './access.mjs'

const ANALYTICS_ROLES = new Set(['MANAGER', 'EXEC', 'ADMIN'])

function assertAnalyticsAccess(actor) {
  if (!ANALYTICS_ROLES.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问经营分析。')
}

function metric(metrics, id) { return metrics.find((item) => item.id === id)?.value || 0 }

function alert(id, level, title, value, recommendation) { return { id, level, title, value, recommendation, source: 'DETERMINISTIC_RULE', requiresHumanReview: true } }

function daysBetween(from, to = new Date()) { return Math.floor((to.valueOf() - new Date(from).valueOf()) / 86400000) }
const STAGE_WEIGHTS = { NEW: 0.1, QUOTED: 0.35, SAMPLE: 0.55, NEGOTIATION: 0.75, WON: 1, LOST: 0 }

async function pipelineForecast(db, actor) {
  // 修复说明：[中危-查询负载]，原因：预测汇总只使用币种、金额和阶段，原查询会把商机整行载入内存；限定字段投影以降低大数据量下的传输和堆内存压力。
  const rows = await db.opportunity.findMany({ where: scopeFor(actor), orderBy: { updatedAt: 'desc' }, take: 1000, select: { currency: true, amount: true, stage: true } })
  const byCurrency = new Map()
  for (const row of rows) {
    const currency = row.currency || 'USD'; const amount = Number(row.amount || 0); const weight = STAGE_WEIGHTS[row.stage] ?? 0
    const bucket = byCurrency.get(currency) || { currency, pipelineAmount: 0, weightedAmount: 0, byStage: {} }
    bucket.pipelineAmount += amount; bucket.weightedAmount += amount * weight; bucket.byStage[row.stage] = (bucket.byStage[row.stage] || 0) + amount; byCurrency.set(currency, bucket)
  }
  return [...byCurrency.values()].map((item) => ({ ...item, pipelineAmount: Number(item.pipelineAmount.toFixed(2)), weightedAmount: Number(item.weightedAmount.toFixed(2)), method: 'OPPORTUNITY_STAGE_WEIGHT', requiresHumanReview: true }))
}

async function retentionSignals(db, actor) {
  const customerScope = scopeFor(actor)
  // 修复说明：[中危-查询负载]，原因：留存规则只需要客户标识与活动基准时间、沟通事件只需要客户标识与发生时间；避免把客户属性和沟通正文无谓读入分析进程。
  const customers = await db.customer.findMany({ where: customerScope, orderBy: { updatedAt: 'asc' }, take: 500, select: { id: true, createdAt: true, updatedAt: true } })
  if (!customers.length) return []
  const visible = new Set(customers.map((item) => item.id))
  const events = await db.communicationEvent.findMany({ where: { customerId: { in: [...visible] } }, orderBy: { occurredAt: 'desc' }, take: 3000, select: { customerId: true, occurredAt: true } })
  const latestByCustomer = new Map()
  for (const event of events) if (visible.has(event.customerId) && !latestByCustomer.has(event.customerId)) latestByCustomer.set(event.customerId, event.occurredAt)
  return customers.map((customer) => {
    const lastActivityAt = latestByCustomer.get(customer.id) || customer.updatedAt || customer.createdAt
    const inactiveDays = Math.max(0, daysBetween(lastActivityAt))
    return { customerId: customer.id, inactiveDays, lastActivityAt: new Date(lastActivityAt).toISOString(), status: inactiveDays >= 90 ? 'HIGH_RISK' : inactiveDays >= 30 ? 'REVIEW' : 'ACTIVE', source: 'COMMUNICATION_ACTIVITY_RULE', requiresHumanReview: true }
  }).filter((item) => item.status !== 'ACTIVE').slice(0, 50)
}

export async function handleAnalyticsRoute({ req, res, pathname, actor, db }) {
  if (req.method !== 'GET' || pathname !== '/api/analytics/operations-report') return false
  assertAnalyticsAccess(actor)
  const dashboard = await getDashboardData(db, actor, '30d')
  const approvals = metric(dashboard.metrics, 'pendingQuoteApprovals')
  const payments = metric(dashboard.metrics, 'pendingPayments')
  const failedWebhooks = metric(dashboard.metrics, 'failedWebhooks')
  const leads = dashboard.business.funnel.find((item) => item.id === 'leadsTotal')?.value || 0
  const inquiries = dashboard.business.funnel.find((item) => item.id === 'inquiriesTotal')?.value || 0
  const quotes = dashboard.business.revenue.find((item) => item.id === 'quotesTotal')?.value || 0
  const orders = dashboard.business.revenue.find((item) => item.id === 'ordersTotal')?.value || 0
  const retention = await retentionSignals(db, actor)
  const forecast = await pipelineForecast(db, actor)
  const alerts = [
    ...(approvals ? [alert('quote-approval', 'AMBER', '待审批报价', approvals, '由主管人工检查毛利、条款与客户范围后处理。')] : []),
    ...(payments ? [alert('payment-confirmation', 'RED', '待财务确认回款', payments, '由财务在原始凭证中人工确认，不能由分析模块自动入账。')] : []),
    ...(failedWebhooks ? [alert('integration-webhook', 'RED', '渠道 Webhook 失败', failedWebhooks, '检查连接器台账和人工降级流程，不自动重试外部动作。')] : []),
    ...(leads > 0 && inquiries === 0 ? [alert('lead-conversion', 'AMBER', '线索未形成询盘', leads, '核对负责人、跟进节奏和渠道来源；这是运营提示，不是 AI 结论。')] : []),
    ...(quotes > 0 && orders === 0 ? [alert('quote-conversion', 'AMBER', '报价未形成订单', quotes, '人工复核报价有效期、客户回复和跟进计划。')] : []),
    ...(retention.some((item) => item.status === 'HIGH_RISK') ? [alert('retention', 'AMBER', '客户长期无沟通活动', retention.filter((item) => item.status === 'HIGH_RISK').length, '由客户负责人核对近期真实沟通、订单和拒绝联系状态后，再决定是否跟进。')] : []),
  ]
  return send(res, 200, { data: { generatedAt: new Date().toISOString(), scope: actor.role === 'MANAGER' ? 'TEAM' : 'GLOBAL', source: 'CURRENT_CUMULATIVE_OVERVIEW', business: dashboard.business, alerts, retentionSignals: retention, forecast, limitations: ['仅使用当前角色可见的累计业务数据。', '不含 PII、自由 SQL、模型推理或外部数据。', '客户活跃度是沟通时间线规则，不是流失概率；预测是阶段权重汇总，不是承诺或 AI 预测；自动报告推送需有历史数据、评测集与独立授权后实施。'], noExternalSideEffects: true } })
}

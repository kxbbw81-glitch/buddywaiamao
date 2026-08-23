import { assertCustomerScope, assertQuoteAccess, scopeFor } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'
import { auditExcelWorkbook, excelAuditInput } from './quote-excel-audit.mjs'
import { calculateQuote, loadCalculationProducts, quoteCalculationInput, quoteRules } from './quote-engine.mjs'
import { quotePdfBuffer } from './quote-pdf.mjs'

const quoteInclude = {
  customer: { include: { owner: { select: { id: true, name: true, teamId: true } } } },
  opportunity: { select: { id: true, name: true, stage: true, ownerId: true } },
  owner: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { versions: true } },
}
const ruleSetInclude = { createdBy: { select: { id: true, name: true } } }
const RULE_SET_STATUSES = new Set(['DRAFT', 'ACTIVE', 'ARCHIVED'])
const APPROVAL_DECISIONS = new Set(['APPROVED', 'REJECTED'])

function assertQuoteRuleWrite(actor) {
  if (!new Set(['MANAGER', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权维护报价规则版本。')
}

function assertQuoteApprovalDecision(actor) {
  if (!new Set(['MANAGER', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权审批报价。')
}

function currencyValue(value) {
  const currency = text(value || 'USD', '币种', { required: true, max: 3 })?.toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(400, 'VALIDATION_ERROR', '币种必须为三位 ISO 代码。')
  return currency
}

function nonNegativeMoney(value, field, { required = false } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return 0
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须为非负数字。`)
  return Number(number.toFixed(2))
}

function quoteItems(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) throw new HttpError(400, 'VALIDATION_ERROR', '报价明细必须是 1 到 50 行数组。')
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 32 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '报价明细不能超过 32KB。')
  return value.map((item, index) => {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'VALIDATION_ERROR', `第 ${index + 1} 行报价明细无效。`)
    const quantity = nonNegativeMoney(item.quantity ?? 1, `第 ${index + 1} 行数量`, { required: true })
    if (quantity <= 0) throw new HttpError(400, 'VALIDATION_ERROR', `第 ${index + 1} 行数量必须大于 0。`)
    const unitPrice = nonNegativeMoney(item.unitPrice, `第 ${index + 1} 行单价`, { required: true })
    const unitCost = nonNegativeMoney(item.unitCost ?? 0, `第 ${index + 1} 行成本`)
    return {
      productId: text(item.productId, `第 ${index + 1} 行产品`, { required: true, max: 64 }),
      sku: text(item.sku, `第 ${index + 1} 行 SKU`, { max: 80 }),
      name: text(item.name, `第 ${index + 1} 行名称`, { required: true, max: 160 }),
      quantity,
      unitPrice,
      unitCost,
      amount: nonNegativeMoney(item.amount ?? quantity * unitPrice, `第 ${index + 1} 行金额`),
      cost: nonNegativeMoney(item.cost ?? quantity * unitCost, `第 ${index + 1} 行成本金额`),
    }
  })
}

async function assertProductsExist(db, items) {
  const productIds = [...new Set(items.map((item) => item.productId))]
  for (const productId of productIds) {
    const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } })
    if (!product) throw new HttpError(404, 'NOT_FOUND', '报价明细中的产品不存在。')
  }
}

function totalsFrom(items, body) {
  const calculatedAmount = Number(items.reduce((sum, item) => sum + item.amount, 0).toFixed(2))
  const calculatedCost = Number(items.reduce((sum, item) => sum + item.cost, 0).toFixed(2))
  const totalAmount = body.totalAmount == null ? calculatedAmount : nonNegativeMoney(body.totalAmount, '报价金额')
  const totalCost = body.totalCost == null ? calculatedCost : nonNegativeMoney(body.totalCost, '报价成本')
  const grossMargin = body.grossMargin == null ? Number((totalAmount - totalCost).toFixed(2)) : nonNegativeMoney(body.grossMargin, '毛利')
  return { totalAmount, totalCost, grossMargin }
}

async function audit(tx, actor, action, resource, resourceId, detail) {
  await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

function ruleSetStatus(value) {
  const status = text(value || 'ACTIVE', '规则状态', { required: true, max: 20 })?.toUpperCase()
  if (!RULE_SET_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '规则状态仅支持 DRAFT / ACTIVE / ARCHIVED。')
  return status
}

function ruleSetData(body, actor) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'VALIDATION_ERROR', '请求体必须是 JSON 对象。')
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 24 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '报价规则版本不能超过 24KB。')
  const rules = quoteRules(body.rules || {})
  const code = text(body.code || rules.code, '规则编码', { required: true, max: 80 })?.toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(code)) throw new HttpError(400, 'VALIDATION_ERROR', '规则编码只能包含大写字母、数字、点、下划线和连字符。')
  return {
    code,
    name: text(body.name || code, '规则名称', { required: true, max: 120 }),
    status: ruleSetStatus(body.status),
    currency: rules.currency,
    source: text(body.source || rules.source, '规则来源', { max: 160 }),
    rules: { ...rules, code },
    createdById: actor.id,
  }
}

async function ruleSetById(db, id) {
  const ruleSet = await db.quoteRuleSet.findUnique({ where: { id }, include: ruleSetInclude })
  if (!ruleSet) throw new HttpError(404, 'NOT_FOUND', '报价规则版本不存在。')
  return ruleSet
}

async function customerById(db, id) {
  const customer = await db.customer.findUnique({ where: { id }, include: { owner: { select: { id: true, teamId: true } } } })
  if (!customer) throw new HttpError(404, 'NOT_FOUND', '客户不存在。')
  return customer
}

async function opportunityById(db, id) {
  const opportunity = await db.opportunity.findUnique({ where: { id }, include: { customer: { include: { owner: { select: { id: true, teamId: true } } } } } })
  if (!opportunity) throw new HttpError(404, 'NOT_FOUND', '商机不存在。')
  return opportunity
}

async function quoteById(db, actor, id) {
  const quote = await db.quote.findUnique({ where: { id }, include: quoteInclude })
  if (!quote) throw new HttpError(404, 'NOT_FOUND', '报价不存在。')
  assertCustomerScope(actor, quote.customer)
  return quote
}

async function quoteVersionById(db, quoteId, versionId) {
  const version = await db.quoteVersion.findUnique({ where: { id: versionId } })
  if (!version || version.quoteId !== quoteId) throw new HttpError(404, 'NOT_FOUND', '报价版本不存在。')
  return version
}

function decimalNumber(value) {
  if (value == null) return 0
  const number = Number(value)
  return Number.isFinite(number) ? number : Number(value.toString())
}

function marginInfo(version, minimumMarginRate) {
  const totalAmount = decimalNumber(version.totalAmount)
  const grossMargin = decimalNumber(version.grossMargin)
  const grossMarginRate = totalAmount > 0 ? Number((grossMargin / totalAmount).toFixed(4)) : 0
  return { totalAmount, grossMargin, grossMarginRate, minimumMarginRate, lowMargin: grossMarginRate < minimumMarginRate }
}

function minimumMarginInput(body) {
  if (body.minimumMarginRate == null || body.minimumMarginRate === '') return 0.15
  const value = Number(body.minimumMarginRate)
  if (!Number.isFinite(value) || value < 0 || value > 5) throw new HttpError(400, 'VALIDATION_ERROR', '最低毛利率必须是 0 到 5 之间的数字。')
  return value
}

function pdfSnapshotFor(quote, version, actor, body, margin) {
  const validityDays = body.validityDays == null ? 30 : Number(body.validityDays)
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) throw new HttpError(400, 'VALIDATION_ERROR', '报价有效期必须是 1 到 365 天。')
  return {
    type: 'QUOTE_PDF_SNAPSHOT',
    template: text(body.template || 'NEXFAB_STANDARD_QUOTE_V1', 'PDF 模板', { required: true, max: 80 }),
    generatedAt: new Date().toISOString(),
    generatedBy: { id: actor.id, name: actor.name },
    quote: { id: quote.id, status: quote.status, currency: quote.currency, customerId: quote.customerId, opportunityId: quote.opportunityId },
    customer: { id: quote.customer.id, name: quote.customer.name, country: quote.customer.country },
    version: { id: version.id, version: version.version, items: version.items, notes: version.notes },
    totals: { totalAmount: margin.totalAmount, totalCost: decimalNumber(version.totalCost), grossMargin: margin.grossMargin, grossMarginRate: margin.grossMarginRate },
    validityDays,
    disclaimer: '本快照用于后续 PDF 渲染和版本锁定；正式发送仍需按审批与人工确认流程执行。',
  }
}

function sendQuoteInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'VALIDATION_ERROR', '请求体必须是 JSON 对象。')
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 8 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '发送留痕请求不能超过 8KB。')
  const channel = text(body.channel || 'EMAIL', '发送渠道', { required: true, max: 20 })?.toUpperCase()
  if (!new Set(['EMAIL', 'WHATSAPP', 'NOTE']).has(channel)) throw new HttpError(400, 'VALIDATION_ERROR', '发送渠道仅支持 EMAIL / WHATSAPP / NOTE。')
  if (body.confirmedExternalSend !== true) throw new HttpError(400, 'VALIDATION_ERROR', '正式发送留痕必须确认 confirmedExternalSend=true；系统不会代发外部邮件。')
  return {
    versionId: text(body.versionId, '报价版本', { required: true, max: 64 }),
    channel,
    recipient: text(body.recipient, '收件人', { max: 160 }),
    subject: text(body.subject || 'NexFab quotation', '主题', { required: true, max: 160 }),
    message: text(body.message, '发送说明', { max: 2000 }),
  }
}

async function pendingOrCreateApproval(tx, actor, quote, version, margin, note) {
  const existing = await tx.quoteApproval.findFirst({ where: { quoteVersionId: version.id, status: 'PENDING', type: 'LOW_MARGIN' } })
  if (existing) return existing
  const approval = await tx.quoteApproval.create({ data: { quoteId: quote.id, quoteVersionId: version.id, type: 'LOW_MARGIN', status: 'PENDING', reason: 'LOW_MARGIN_BELOW_MINIMUM', requestedById: actor.id, note } })
  await audit(tx, actor, 'CREATE', 'quote_approval', approval.id, { quoteId: quote.id, quoteVersionId: version.id, reason: approval.reason, margin })
  return approval
}

export async function handleQuoteRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/quote-rule-sets') {
    assertQuoteAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const statusParam = url.searchParams.get('status')
    const where = statusParam ? { status: ruleSetStatus(statusParam) } : {}
    const [items, total] = await db.$transaction([db.quoteRuleSet.findMany({ where, include: ruleSetInclude, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.quoteRuleSet.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/quote-rule-sets') {
    assertQuoteAccess(actor, true)
    assertQuoteRuleWrite(actor)
    const data = ruleSetData(await readJson(req), actor)
    const item = await db.$transaction(async (tx) => {
      const created = await tx.quoteRuleSet.create({ data, include: ruleSetInclude })
      await audit(tx, actor, 'CREATE', 'quote_rule_set', created.id, { code: created.code, status: created.status, currency: created.currency })
      return created
    })
    return send(res, 201, { data: item })
  }

  if (req.method === 'POST' && pathname === '/api/quote-rule-sets/excel-audit') {
    assertQuoteAccess(actor, true)
    assertQuoteRuleWrite(actor)
    const result = auditExcelWorkbook(excelAuditInput(await readJson(req)))
    return send(res, 200, { data: result })
  }

  const ruleSetMatch = pathname.match(/^\/api\/quote-rule-sets\/([^/]+)$/)
  if (ruleSetMatch && req.method === 'GET') {
    assertQuoteAccess(actor)
    return send(res, 200, { data: await ruleSetById(db, ruleSetMatch[1]) })
  }

  if (req.method === 'GET' && pathname === '/api/quotes') {
    assertQuoteAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const customerScope = scopeFor(actor)
    const where = Object.keys(customerScope).length ? { customer: customerScope } : {}
    const [items, total] = await db.$transaction([db.quote.findMany({ where, include: quoteInclude, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.quote.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/quotes/quick') {
    assertQuoteAccess(actor, true)
    const body = await readJson(req)
    const customerId = text(body.customerId, '客户', { required: true, max: 64 })
    const opportunityId = text(body.opportunityId, '商机', { max: 64 })
    const customer = await customerById(db, customerId)
    assertCustomerScope(actor, customer)
    if (opportunityId) {
      const opportunity = await opportunityById(db, opportunityId)
      if (opportunity.customerId !== customer.id) throw new HttpError(400, 'VALIDATION_ERROR', '商机不属于所选客户。')
      assertCustomerScope(actor, opportunity.customer)
    }
    const items = quoteItems(body.items)
    await assertProductsExist(db, items)
    const totals = totalsFrom(items, body)
    const data = { customerId, opportunityId, currency: currencyValue(body.currency), notes: text(body.notes, '报价备注', { max: 2000 }), ...totals }
    const quote = await db.$transaction(async (tx) => {
      const created = await tx.quote.create({ data: { ...data, createdById: actor.id, ownerId: customer.ownerId }, include: quoteInclude })
      const version = await tx.quoteVersion.create({ data: { quoteId: created.id, version: 1, items, notes: data.notes, createdById: actor.id, ...totals } })
      await audit(tx, actor, 'CREATE', 'quote', created.id, { customerId, opportunityId, versionId: version.id, totalAmount: totals.totalAmount, currency: data.currency })
      return { ...created, versions: [version] }
    })
    return send(res, 201, { data: quote })
  }

  if (req.method === 'POST' && pathname === '/api/quotes/calculate') {
    assertQuoteAccess(actor)
    const input = quoteCalculationInput(await readJson(req))
    if (input.customerId) {
      const customer = await customerById(db, input.customerId)
      assertCustomerScope(actor, customer)
    }
    const products = await loadCalculationProducts(db, input.items)
    let rules = input.rules
    if (input.ruleSetId) {
      const ruleSet = await ruleSetById(db, input.ruleSetId)
      if (ruleSet.status === 'ARCHIVED') throw new HttpError(400, 'VALIDATION_ERROR', '已归档的报价规则版本不能用于计算。')
      rules = quoteRules(ruleSet.rules)
    }
    return send(res, 200, { data: calculateQuote({ items: input.items, products, tradeTerm: input.tradeTerm, rules }) })
  }

  const lockMatch = pathname.match(/^\/api\/quotes\/([^/]+)\/versions\/([^/]+)\/lock$/)
  if (lockMatch && req.method === 'POST') {
    assertQuoteAccess(actor, true)
    const body = await readJson(req)
    const quote = await quoteById(db, actor, lockMatch[1])
    const version = await quoteVersionById(db, quote.id, lockMatch[2])
    if (version.lockStatus === 'LOCKED') return send(res, 200, { data: version })
    const margin = marginInfo(version, minimumMarginInput(body))
    const approved = margin.lowMargin ? await db.quoteApproval.findFirst({ where: { quoteVersionId: version.id, status: 'APPROVED', type: 'LOW_MARGIN' } }) : null
    if (margin.lowMargin && !approved) {
      const approval = await db.$transaction(async (tx) => pendingOrCreateApproval(tx, actor, quote, version, margin, text(body.note, '审批说明', { max: 1000 })))
      return send(res, 202, { data: { status: 'APPROVAL_REQUIRED', approval, margin } })
    }
    const pdfSnapshot = pdfSnapshotFor(quote, version, actor, body, margin)
    const locked = await db.$transaction(async (tx) => {
      const updated = await tx.quoteVersion.update({ where: { id: version.id }, data: { lockStatus: 'LOCKED', lockedAt: new Date(), lockedById: actor.id, pdfSnapshot } })
      await audit(tx, actor, 'LOCK', 'quote_version', version.id, { quoteId: quote.id, version: version.version, approvalId: approved?.id || null, margin })
      return updated
    })
    return send(res, 200, { data: locked })
  }

  const pdfMatch = pathname.match(/^\/api\/quotes\/([^/]+)\/versions\/([^/]+)\/pdf$/)
  if (pdfMatch && req.method === 'GET') {
    assertQuoteAccess(actor)
    const quote = await quoteById(db, actor, pdfMatch[1])
    const version = await quoteVersionById(db, quote.id, pdfMatch[2])
    if (version.lockStatus !== 'LOCKED' || !version.pdfSnapshot) throw new HttpError(400, 'VALIDATION_ERROR', '报价版本锁定后才能渲染 PDF。')
    const buffer = quotePdfBuffer(version.pdfSnapshot)
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="quote-${quote.id}-v${version.version}.pdf"`,
    })
    return res.end(buffer)
  }

  const sendMatch = pathname.match(/^\/api\/quotes\/([^/]+)\/send$/)
  if (sendMatch && req.method === 'POST') {
    assertQuoteAccess(actor, true)
    const input = sendQuoteInput(await readJson(req))
    const quote = await quoteById(db, actor, sendMatch[1])
    const version = await quoteVersionById(db, quote.id, input.versionId)
    if (version.lockStatus !== 'LOCKED' || !version.pdfSnapshot) throw new HttpError(400, 'VALIDATION_ERROR', '只能发送已锁定并生成 PDF 快照的报价版本。')
    const event = await db.$transaction(async (tx) => {
      const updatedQuote = await tx.quote.update({ where: { id: quote.id }, data: { status: 'SENT' } })
      const created = await tx.communicationEvent.create({
        data: {
          customerId: quote.customerId,
          opportunityId: quote.opportunityId,
          type: input.channel === 'WHATSAPP' ? 'WHATSAPP' : input.channel === 'EMAIL' ? 'EMAIL' : 'NOTE',
          direction: 'OUTBOUND',
          summary: `报价已人工确认发送：${input.subject}`,
          content: JSON.stringify({ quoteId: quote.id, quoteVersionId: version.id, recipient: input.recipient, message: input.message, deliveryMode: 'MANUAL_CONFIRMED_EXTERNAL_SEND', quoteStatus: updatedQuote.status }),
          ownerId: quote.ownerId,
          createdById: actor.id,
        },
      })
      await audit(tx, actor, 'SEND', 'quote', quote.id, { quoteVersionId: version.id, communicationEventId: created.id, channel: input.channel, recipient: input.recipient })
      return created
    })
    return send(res, 200, { data: { status: 'SENT_RECORDED', quoteId: quote.id, quoteVersionId: version.id, communicationEvent: event } })
  }

  const approvalsMatch = pathname.match(/^\/api\/quotes\/([^/]+)\/approvals$/)
  if (approvalsMatch && req.method === 'GET') {
    assertQuoteAccess(actor)
    const quote = await quoteById(db, actor, approvalsMatch[1])
    const { page, pageSize, skip } = listQuery(url)
    const where = { quoteId: quote.id }
    const [items, total] = await db.$transaction([db.quoteApproval.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), db.quoteApproval.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  const approvalDecisionMatch = pathname.match(/^\/api\/quote-approvals\/([^/]+)\/decision$/)
  if (approvalDecisionMatch && req.method === 'POST') {
    assertQuoteApprovalDecision(actor)
    const body = await readJson(req)
    const decision = text(body.decision, '审批决定', { required: true, max: 20 })?.toUpperCase()
    if (!APPROVAL_DECISIONS.has(decision)) throw new HttpError(400, 'VALIDATION_ERROR', '审批决定仅支持 APPROVED / REJECTED。')
    const approval = await db.quoteApproval.findUnique({ where: { id: approvalDecisionMatch[1] } })
    if (!approval) throw new HttpError(404, 'NOT_FOUND', '报价审批不存在。')
    if (approval.status !== 'PENDING') throw new HttpError(400, 'VALIDATION_ERROR', '该报价审批已处理。')
    if (approval.requestedById === actor.id && actor.role !== 'ADMIN') throw new HttpError(400, 'VALIDATION_ERROR', '审批人不能审批自己提交的报价。')
    await quoteById(db, actor, approval.quoteId)
    const decided = await db.$transaction(async (tx) => {
      const updated = await tx.quoteApproval.update({ where: { id: approval.id }, data: { status: decision, decidedById: actor.id, decidedAt: new Date(), note: text(body.note, '审批备注', { max: 1000 }) } })
      await audit(tx, actor, decision, 'quote_approval', approval.id, { quoteId: approval.quoteId, quoteVersionId: approval.quoteVersionId })
      return updated
    })
    return send(res, 200, { data: decided })
  }

  const quoteMatch = pathname.match(/^\/api\/quotes\/([^/]+)$/)
  if (quoteMatch && req.method === 'GET') {
    assertQuoteAccess(actor)
    return send(res, 200, { data: await quoteById(db, actor, quoteMatch[1]) })
  }

  const versionsMatch = pathname.match(/^\/api\/quotes\/([^/]+)\/versions$/)
  if (versionsMatch && req.method === 'GET') {
    assertQuoteAccess(actor)
    const quote = await quoteById(db, actor, versionsMatch[1])
    const { page, pageSize, skip } = listQuery(url)
    const where = { quoteId: quote.id }
    const [items, total] = await db.$transaction([db.quoteVersion.findMany({ where, orderBy: { version: 'desc' }, skip, take: pageSize }), db.quoteVersion.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  return false
}

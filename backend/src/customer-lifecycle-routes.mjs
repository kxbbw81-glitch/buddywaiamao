import { assertCrmAccess, assertCustomerScope, assertProductAccess, scopeFor } from './access.mjs'
import { HttpError, readJson, send, text } from './http.mjs'

// 修复说明：[P1-台账外]，原因：客户画像、产品候选、复购和受控导出/删除只有菜单或需求描述，未形成可审计 API；此处直接复用既有客户、产品、订单、商机与跟进模型，不新增平行业务表。
function csvCell(value) {
  const raw = String(value ?? '')
  // 修复说明：[中危-CSV 公式注入]，原因：业务字段以 =、+、-、@ 开头时，Excel 打开 CSV 会将其当作公式执行；在保持原始可读性的同时前置文本标记。
  const safe = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}

function sendCsv(res, filename, headers, rows) {
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' })
  res.end(csv)
}

async function customerById(db, id) {
  const customer = await db.customer.findUnique({ where: { id } })
  if (!customer) throw new HttpError(404, 'NOT_FOUND', '客户不存在。')
  return customer
}

function profileScore({ customer, contacts, opportunities, orders }) {
  const completed = (customer.country ? 5 : 0) + (customer.website ? 5 : 0) + (contacts.length ? 10 : 0)
  const commercial = Math.min(10, opportunities.length * 5) + Math.min(10, orders.length * 5) + (opportunities.some((item) => item.stage === 'WON') ? 10 : 0) + (orders.some((item) => item.fulfillmentStatus === 'DELIVERED') ? 10 : 0)
  const score = Math.min(100, completed + commercial)
  return {
    score,
    level: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW',
    factors: { profileCompletion: completed, commercialActivity: commercial },
    missing: [!customer.country && 'country', !customer.website && 'website', !contacts.length && 'contact'].filter(Boolean),
  }
}

function productMatches(product, keywords) {
  if (!keywords.length) return true
  const haystack = `${product.sku} ${product.name} ${JSON.stringify(product.specs || {})}`.toLowerCase()
  return keywords.some((keyword) => haystack.includes(keyword))
}

async function audit(tx, actor, action, resource, resourceId, detail) {
  await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

export async function handleCustomerLifecycleRoute({ req, res, url, pathname, actor, db }) {
  const exportMatch = pathname === '/api/customers/export'
  if (req.method === 'GET' && exportMatch) {
    assertCrmAccess(actor)
    // 修复说明：[中危-查询负载]，原因：CSV 只包含五个公开字段，原查询会加载客户整行；限定投影以降低导出内存占用并减少无关字段接触面。
    const items = await db.customer.findMany({ where: scopeFor(actor), take: 1000, select: { id: true, name: true, country: true, website: true, createdAt: true } })
    await audit(db, actor, 'EXPORT', 'customer', 'list', { count: items.length, format: 'CSV' })
    return sendCsv(res, 'customers.csv', ['ID', '客户名称', '国家', '官网', '创建时间'], items.map((item) => [item.id, item.name, item.country, item.website, item.createdAt?.toISOString?.() || item.createdAt]))
  }

  const productExportMatch = pathname === '/api/products/export'
  if (req.method === 'GET' && productExportMatch) {
    assertProductAccess(actor)
    // 修复说明：[中危-查询负载]，原因：产品 CSV 不使用分类、成本版本和关联计数，原整行读取会放大导出开销；仅取实际输出字段。
    const items = await db.product.findMany({ where: {}, take: 1000, select: { id: true, sku: true, name: true, active: true, specs: true, packing: true } })
    await audit(db, actor, 'EXPORT', 'product', 'list', { count: items.length, format: 'CSV' })
    return sendCsv(res, 'products.csv', ['ID', 'SKU', '产品名称', '启用', '规格', '包装'], items.map((item) => [item.id, item.sku, item.name, item.active ? 'true' : 'false', JSON.stringify(item.specs || {}), JSON.stringify(item.packing || {})]))
  }

  const profileMatch = pathname.match(/^\/api\/customers\/([^/]+)\/profile$/)
  if (req.method === 'GET' && profileMatch) {
    assertCrmAccess(actor)
    const customer = await customerById(db, profileMatch[1]); assertCustomerScope(actor, customer)
    // 修复说明：[中危-查询负载]，原因：客户画像评分只依赖关联记录数量、商机阶段和订单履约状态，投影必要字段避免读取联系人 PII 与无关业务快照。
    const [contacts, opportunities, orders] = await Promise.all([
      db.contact.findMany({ where: { customerId: customer.id }, take: 100, select: { id: true } }),
      db.opportunity.findMany({ where: { customerId: customer.id }, take: 100, select: { stage: true } }),
      db.salesOrder.findMany({ where: { customerId: customer.id }, take: 100, select: { fulfillmentStatus: true } }),
    ])
    return send(res, 200, { data: { customer: { id: customer.id, name: customer.name, country: customer.country, website: customer.website }, profile: profileScore({ customer, contacts, opportunities, orders }), counts: { contacts: contacts.length, opportunities: opportunities.length, orders: orders.length } } })
  }

  const recommendationMatch = pathname.match(/^\/api\/customers\/([^/]+)\/product-recommendations$/)
  if (req.method === 'GET' && recommendationMatch) {
    assertCrmAccess(actor)
    const customer = await customerById(db, recommendationMatch[1]); assertCustomerScope(actor, customer)
    const keywords = String(url.searchParams.get('q') || '').toLowerCase().split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8)
    // 修复说明：[中危-查询负载]，原因：候选匹配只读取产品标识、SKU、名称和规格，不加载成本与其他产品扩展字段。
    const products = await db.product.findMany({ where: { active: true }, take: 100, select: { id: true, sku: true, name: true, specs: true } })
    const items = products.filter((product) => productMatches(product, keywords)).slice(0, 12).map((product) => ({ id: product.id, sku: product.sku, name: product.name, reason: keywords.length ? '匹配需求关键词的启用产品' : '启用产品候选；请按客户需求确认' }))
    return send(res, 200, { data: { customerId: customer.id, mode: 'deterministic-candidate', query: keywords, items, limitations: ['候选仅辅助销售选择，不替代价格、MOQ、库存、合规或审批规则。'] } })
  }

  const repurchaseMatch = pathname.match(/^\/api\/customers\/([^/]+)\/repurchase$/)
  if (req.method === 'GET' && repurchaseMatch) {
    assertCrmAccess(actor)
    const customer = await customerById(db, repurchaseMatch[1]); assertCustomerScope(actor, customer)
    // 修复说明：[中危-查询负载]，原因：复购资格只使用履约状态和一个可关联商机 ID，避免读取订单与商机整行。
    const [orders, opportunities] = await Promise.all([db.salesOrder.findMany({ where: { customerId: customer.id }, take: 100, select: { fulfillmentStatus: true } }), db.opportunity.findMany({ where: { customerId: customer.id }, take: 100, select: { id: true } })])
    const delivered = orders.filter((item) => item.fulfillmentStatus === 'DELIVERED')
    return send(res, 200, { data: { customerId: customer.id, deliveredOrders: delivered.length, eligible: delivered.length > 0, recommendation: delivered.length ? '建议创建一次人工复购跟进。' : '客户暂无已签收订单，暂不创建复购提醒。', opportunityId: opportunities[0]?.id || null } })
  }

  const repurchaseFollowUpMatch = pathname.match(/^\/api\/customers\/([^/]+)\/repurchase\/follow-ups$/)
  if (req.method === 'POST' && repurchaseFollowUpMatch) {
    assertCrmAccess(actor, true)
    const customer = await customerById(db, repurchaseFollowUpMatch[1]); assertCustomerScope(actor, customer)
    // 修复说明：[中危-查询负载]，原因：创建复购跟进只需验证已签收订单并取一个商机 ID；限定字段以减少写入前的读放大。
    const orders = await db.salesOrder.findMany({ where: { customerId: customer.id }, take: 100, select: { fulfillmentStatus: true } })
    if (!orders.some((item) => item.fulfillmentStatus === 'DELIVERED')) throw new HttpError(409, 'REPURCHASE_NOT_ELIGIBLE', '客户暂无已签收订单，不能创建复购跟进。')
    const opportunities = await db.opportunity.findMany({ where: { customerId: customer.id }, take: 1, select: { id: true } })
    if (!opportunities[0]) throw new HttpError(409, 'REPURCHASE_OPPORTUNITY_REQUIRED', '客户缺少可关联商机，不能创建复购跟进。')
    const body = await readJson(req)
    const content = text(body.content || '已签收订单客户的人工复购跟进。', '复购跟进内容', { required: true, max: 4000 })
    const item = await db.$transaction(async (tx) => { const followUp = await tx.followUp.create({ data: { opportunityId: opportunities[0].id, authorId: actor.id, type: 'NOTE', content, dueAt: null } }); await audit(tx, actor, 'CREATE', 'repurchase_follow_up', followUp.id, { customerId: customer.id, opportunityId: opportunities[0].id }); return followUp })
    return send(res, 201, { data: item })
  }

  const customerDeleteMatch = pathname.match(/^\/api\/customers\/([^/]+)$/)
  if (req.method === 'DELETE' && customerDeleteMatch) {
    if (actor.role !== 'ADMIN') throw new HttpError(403, 'FORBIDDEN', '仅管理员可删除无业务记录的客户。')
    const customer = await customerById(db, customerDeleteMatch[1])
    const [opportunities, orders] = await Promise.all([db.opportunity.count({ where: { customerId: customer.id } }), db.salesOrder.count({ where: { customerId: customer.id } })])
    if (opportunities || orders) throw new HttpError(409, 'CUSTOMER_HAS_BUSINESS_HISTORY', '客户已有商机或订单，禁止删除；请保留审计记录。')
    await db.$transaction(async (tx) => { await tx.customer.delete({ where: { id: customer.id } }); await audit(tx, actor, 'DELETE', 'customer', customer.id, { mode: 'no-business-history' }) })
    return send(res, 204, {})
  }

  const productDeleteMatch = pathname.match(/^\/api\/products\/([^/]+)$/)
  if (req.method === 'DELETE' && productDeleteMatch) {
    assertProductAccess(actor, true)
    const product = await db.product.findUnique({ where: { id: productDeleteMatch[1] } })
    if (!product) throw new HttpError(404, 'NOT_FOUND', '产品不存在。')
    const item = await db.$transaction(async (tx) => { const updated = await tx.product.update({ where: { id: product.id }, data: { active: false } }); await audit(tx, actor, 'ARCHIVE', 'product', product.id, { mode: 'soft-delete' }); return updated })
    return send(res, 200, { data: item })
  }
  return false
}

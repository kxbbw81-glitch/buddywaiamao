import { assertCrmAccess, assertProductAccess, assertQuoteAccess, scopeFor } from './access.mjs'
import { HttpError, readJson, send, text } from './http.mjs'
import { quoteRules } from './quote-engine.mjs'
import { findDuplicateCustomers, fingerprintsFromCustomer, fingerprintsFromLead, registerCustomerFingerprints } from './customer-fingerprint.mjs'
import { prepareEncryptedContact, prepareEncryptedLead, publicPiiStorageSummary } from './pii.mjs'

const IMPORT_TYPES = new Set(['leads', 'customers', 'products', 'supplier-costs', 'quote-rules'])
const MAX_IMPORT_ROWS = 100
const TEMPLATE_COLUMNS = {
  leads: [
    ['source', '线索来源，如 EMAIL/B2B/EXHIBITION/WEBSITE/MANUAL，必填', '文本，最长 80'],
    ['channel', '渠道，如 LINKEDIN/ALIBABA/官网表单', '文本，最长 80，可空'],
    ['companyName', '公司名称，必填', '文本，最长 180'],
    ['contactName', '联系人', '文本，最长 120，可空'],
    ['email', '联系人邮箱', '合法邮箱，可空；导入时加密存储'],
    ['phone', '联系人电话', '文本，最长 80，可空；导入时加密存储'],
    ['country', '国家/地区', '文本，最长 80，可空'],
    ['language', '沟通语言', '文本，最长 40，可空'],
    ['estimatedQuantity', '预计采购量', '文本，最长 120，可空'],
    ['buyerRole', '采购身份', '文本，最长 120，可空'],
    ['priority', '优先级 LOW/NORMAL/HIGH/URGENT', '枚举，默认 NORMAL'],
  ],
  customers: [
    ['name', '客户名称，必填', '文本，最长 160'],
    ['country', '国家/地区', '文本，最长 80，可空'],
    ['website', '官网', 'URL 或域名，可空；用于域名查重'],
    ['contactName', '首要联系人姓名', '文本，最长 120，可空'],
    ['contactTitle', '首要联系人职位', '文本，最长 120，可空'],
    ['email', '首要联系人邮箱', '合法邮箱，可空；导入时加密存储'],
    ['phone', '首要联系人电话', '文本，最长 64，可空；导入时加密存储'],
  ],
  products: [
    ['sku', 'SKU，必填且唯一', '大写字母/数字/点/下划线/连字符'],
    ['name', '产品名称，必填', '文本，最长 160'],
    ['categoryName', '产品分类名称，必填', '不存在时导入可创建分类'],
    ['specsJson', '规格 JSON', 'JSON 对象，如 {"model":"A"}'],
    ['packingJson', '包装 JSON', 'JSON 对象，如 {"carton":"10pcs"}'],
    ['costVersionsJson', '成本版本 JSON', 'JSON 对象，如 {"current":12.5}'],
    ['active', '是否启用', 'true/false，默认 true'],
  ],
  'supplier-costs': [
    ['sku', '产品 SKU，必填', '必须匹配现有产品'],
    ['supplierName', '供应商名称', '写入 Product.costVersions.suppliers[]，不新建供应商模型'],
    ['cost', '采购成本，必填', '非负数字'],
    ['currency', '币种', '三位 ISO，默认 CNY'],
    ['effectiveFrom', '生效日期', 'YYYY-MM-DD，可空'],
    ['moq', 'MOQ', '非负数字，可空'],
    ['note', '备注', '文本，可空'],
  ],
  'quote-rules': [
    ['code', '规则编码，必填且唯一', '大写字母/数字/点/下划线/连字符'],
    ['name', '规则名称', '文本，最长 120'],
    ['status', '状态 DRAFT/ACTIVE/ARCHIVED', '默认 DRAFT'],
    ['currency', '报价币种', '三位 ISO，默认 USD'],
    ['fxRateCnyPerUsd', '汇率 CNY/USD', '正数'],
    ['marginRate', '目标毛利率', '0-1 小数'],
    ['minimumMarginRate', '最低毛利率', '0-1 小数'],
    ['rulesJson', '完整报价规则 JSON', 'JSON 对象；如提供则优先使用'],
  ],
}

function assertImportAccess(actor, type, write = false) {
  if (type === 'leads' || type === 'customers') return assertCrmAccess(actor, write)
  if (type === 'products' || type === 'supplier-costs') return assertProductAccess(actor, write)
  if (type === 'quote-rules') return assertQuoteAccess(actor, write)
  throw new HttpError(400, 'UNKNOWN_IMPORT_TYPE', '未知导入类型。')
}
function assertQuoteRuleWrite(actor) {
  if (!new Set(['MANAGER', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权导入报价规则。')
}
function csvEscape(value) {
  const textValue = String(value ?? '')
  return /[",\n]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue
}
function templateFor(type) {
  if (!IMPORT_TYPES.has(type)) throw new HttpError(400, 'UNKNOWN_TEMPLATE', '未知模板类型。')
  const columns = TEMPLATE_COLUMNS[type].map(([field, description, constraint]) => ({ field, description, constraint }))
  return { type, version: 'v2.0-p1.4', noBusinessSampleData: true, columns, csvHeader: columns.map((item) => item.field).join(','), csvDictionary: ['field,description,constraint', ...columns.map((item) => [item.field, item.description, item.constraint].map(csvEscape).join(','))].join('\n') }
}
function asRows(body) {
  if (!Array.isArray(body.rows) || !body.rows.length) throw new HttpError(400, 'VALIDATION_ERROR', '导入 rows 必须是非空数组。')
  if (body.rows.length > MAX_IMPORT_ROWS) throw new HttpError(400, 'VALIDATION_ERROR', `单次最多导入 ${MAX_IMPORT_ROWS} 条。`)
  return body.rows
}
function boolValue(value, fallback = false) {
  if (value == null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y'].includes(lowered)) return true
    if (['false', '0', 'no', 'n'].includes(lowered)) return false
  }
  throw new HttpError(400, 'VALIDATION_ERROR', '布尔字段格式不正确。')
}
function nonNegativeNumber(value, field, { required = false } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return null
  }
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须为非负数字。`)
  return Number(number.toFixed(6))
}
function parseJsonObject(value, field, fallback = {}) {
  if (value == null || value === '') return fallback
  const parsed = typeof value === 'string' ? JSON.parse(value) : value
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是 JSON 对象。`)
  if (Buffer.byteLength(JSON.stringify(parsed), 'utf8') > 16 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', `${field} 不能超过 16KB。`)
  return parsed
}
function importMode(body) {
  const dryRun = body.dryRun !== false
  const confirmImport = body.confirmImport === true
  if (!dryRun && !confirmImport) throw new HttpError(400, 'CONFIRM_IMPORT_REQUIRED', '正式导入必须显式确认 confirmImport=true。')
  return { dryRun, confirmImport }
}
function emptyReport(type, dryRun) {
  return { type, dryRun, total: 0, created: [], updated: [], skipped: [], conflicts: [], errors: [], summary: { created: 0, updated: 0, skipped: 0, conflicts: 0, errors: 0 }, noBusinessSampleData: true }
}
function finalize(report) {
  report.total = report.total || 0
  report.summary = { created: report.created.length, updated: report.updated.length, skipped: report.skipped.length, conflicts: report.conflicts.length, errors: report.errors.length }
  return report
}
function rowError(report, index, error) {
  if (error instanceof SyntaxError) report.errors.push({ row: index + 1, code: 'INVALID_JSON', message: 'JSON 字段格式不正确。' })
  else if (error instanceof HttpError) report.errors.push({ row: index + 1, code: error.code, message: error.message })
  else throw error
}
async function audit(db, actor, action, resource, resourceId, detail) {
  await db.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}
async function activeUser(db, id) {
  const user = await db.user.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!user || user.status !== 'ACTIVE') throw new HttpError(400, 'INVALID_OWNER', '负责人不存在或已停用。')
  return user
}
function cleanLead(row) {
  return {
    source: text(row.source || 'MANUAL', '线索来源', { required: true, max: 80 })?.toUpperCase(),
    channel: text(row.channel, '渠道', { max: 80 })?.toUpperCase() || null,
    companyName: text(row.companyName, '公司名称', { required: true, max: 180 }),
    contactName: text(row.contactName, '联系人', { max: 120 }),
    email: text(row.email, '邮箱', { max: 160 }),
    phone: text(row.phone, '电话', { max: 80 }),
    country: text(row.country, '国家', { max: 80 }),
    language: text(row.language, '语言', { max: 40 }),
    estimatedQuantity: text(row.estimatedQuantity, '预计采购量', { max: 120 }),
    buyerRole: text(row.buyerRole, '采购身份', { max: 120 }),
    priority: text(row.priority || 'NORMAL', '优先级', { required: true, max: 20 })?.toUpperCase(),
  }
}
function safeDuplicateCandidates(duplicates) {
  return duplicates.map((item) => ({ customerId: item.customer.id, matchTypes: item.matches.map((match) => match.type) }))
}
async function importLeads(db, actor, body) {
  assertImportAccess(actor, 'leads', true)
  const { dryRun, confirmImport } = importMode(body)
  const rows = asRows(body)
  const ownerId = Object.prototype.hasOwnProperty.call(body, 'ownerId') ? text(body.ownerId, '负责人', { max: 120 }) : actor.id
  if (ownerId) await activeUser(db, ownerId)
  if (ownerId && actor.role === 'SALES' && ownerId !== actor.id) throw new HttpError(403, 'FORBIDDEN', '销售只能导入并归属给自己的线索。')
  // 修复说明：[低危-数据范围]，原因：MANAGER 导入时可将线索挂到其他团队用户名下；限制为本团队成员。
  if (ownerId && actor.role === 'MANAGER' && ownerId !== actor.id) {
    const owner = await activeUser(db, ownerId)
    if (owner.teamId !== actor.teamId) throw new HttpError(403, 'FORBIDDEN', '经理只能将导入线索归属本团队成员。')
  }
  const duplicateCheckConfirmed = body.duplicateCheckConfirmed === true
  const report = emptyReport('leads', dryRun); report.total = rows.length
  for (const [index, candidate] of rows.entries()) {
    try {
      const data = cleanLead(candidate || {})
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new HttpError(400, 'VALIDATION_ERROR', '邮箱格式不正确。')
      const fingerprints = fingerprintsFromLead(data, 'LEAD_IMPORT')
      const visibleDuplicates = await findDuplicateCustomers(db, fingerprints, { customerScope: scopeFor(actor) })
      if (visibleDuplicates.length && !duplicateCheckConfirmed) {
        report.conflicts.push({ row: index + 1, code: 'DUPLICATE_CHECK_REQUIRED', message: '发现可能重复客户，需人工确认。', candidates: safeDuplicateCandidates(visibleDuplicates) })
        continue
      }
      if (dryRun) report.created.push({ row: index + 1, preview: true, code: candidate?.code || null, companyName: data.companyName, pii: { email: data.email ? 'encrypted-on-confirm' : null, phone: data.phone ? 'encrypted-on-confirm' : null } })
      else {
        // 修复说明：[中危-数据一致性]，原因：导入建线索与审计分离；改为事务内写入，编号冲突按行级冲突处理而非整请求 500。
        const { created } = await db.$transaction(async (tx) => {
          const created = await tx.lead.create({ data: { ...prepareEncryptedLead(data), code: text(candidate?.code, '线索编号', { max: 80 }) || `LEAD-${Date.now()}-${index + 1}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, ownerId, createdById: actor.id } })
          await audit(tx, actor, 'IMPORT_CREATE', 'lead', created.id, { row: index + 1, source: data.source, channel: data.channel, ownerId, duplicateCheckConfirmed: confirmImport && duplicateCheckConfirmed, pii: publicPiiStorageSummary(created) })
          return { created }
        })
        report.created.push({ row: index + 1, id: created.id, code: created.code, status: created.status })
      }
    } catch (error) { rowError(report, index, error) }
  }
  return finalize(report)
}
async function importCustomers(db, actor, body) {
  assertImportAccess(actor, 'customers', true)
  const { dryRun } = importMode(body)
  const rows = asRows(body)
  const duplicateCheckConfirmed = body.duplicateCheckConfirmed === true
  const report = emptyReport('customers', dryRun); report.total = rows.length
  for (const [index, candidate] of rows.entries()) {
    try {
      const customerData = { name: text(candidate?.name, '客户名称', { required: true, max: 160 }), country: text(candidate?.country, '国家', { max: 80 }), website: text(candidate?.website, '官网', { max: 255 }) }
      const contactData = { name: text(candidate?.contactName, '联系人姓名', { max: 120 }), title: text(candidate?.contactTitle, '职位', { max: 120 }), email: text(candidate?.email, '邮箱', { max: 160 }), phone: text(candidate?.phone, '电话', { max: 64 }) }
      if (contactData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) throw new HttpError(400, 'VALIDATION_ERROR', '邮箱格式不正确。')
      const duplicateFingerprints = [...fingerprintsFromCustomer(customerData, 'CUSTOMER_IMPORT'), ...fingerprintsFromLead({ companyName: customerData.name, email: contactData.email, phone: contactData.phone }, 'CUSTOMER_IMPORT')]
      const visibleDuplicates = await findDuplicateCustomers(db, duplicateFingerprints, { customerScope: scopeFor(actor) })
      if (visibleDuplicates.length && !duplicateCheckConfirmed) {
        report.conflicts.push({ row: index + 1, code: 'DUPLICATE_CHECK_REQUIRED', message: '发现可能重复客户，需人工确认。', candidates: safeDuplicateCandidates(visibleDuplicates) })
        continue
      }
      if (dryRun) report.created.push({ row: index + 1, preview: true, name: customerData.name, contact: Boolean(contactData.name || contactData.email || contactData.phone), pii: { email: contactData.email ? 'encrypted-on-confirm' : null, phone: contactData.phone ? 'encrypted-on-confirm' : null } })
      else {
        const customer = await db.$transaction(async (tx) => {
          const created = await tx.customer.create({ data: { ...customerData, ownerId: actor.id } })
          if (contactData.name || contactData.email || contactData.phone) await tx.contact.create({ data: { ...prepareEncryptedContact({ name: contactData.name || '联系人', title: contactData.title, email: contactData.email, phone: contactData.phone }), customerId: created.id } })
          const createdFingerprints = await registerCustomerFingerprints(tx, created.id, duplicateFingerprints, 'CUSTOMER_IMPORT')
          await audit(tx, actor, 'IMPORT_CREATE', 'customer', created.id, { row: index + 1, duplicateCheckConfirmed, hasContact: Boolean(contactData.name || contactData.email || contactData.phone), fingerprintCount: createdFingerprints.length })
          return created
        })
        report.created.push({ row: index + 1, id: customer.id, name: customer.name })
      }
    } catch (error) { rowError(report, index, error) }
  }
  return finalize(report)
}
async function importProducts(db, actor, body) {
  assertImportAccess(actor, 'products', true)
  const { dryRun } = importMode(body)
  const rows = asRows(body)
  const report = emptyReport('products', dryRun); report.total = rows.length
  for (const [index, candidate] of rows.entries()) {
    try {
      const sku = text(candidate?.sku, 'SKU', { required: true, max: 80 })?.toUpperCase()
      if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)) throw new HttpError(400, 'VALIDATION_ERROR', 'SKU 只能包含大写字母、数字、点、下划线和连字符。')
      const name = text(candidate?.name, '产品名称', { required: true, max: 160 })
      const categoryName = text(candidate?.categoryName, '产品分类名称', { required: true, max: 120 })
      const existing = await db.product.findMany({ where: { sku }, take: 1 })
      if (existing.length) { report.conflicts.push({ row: index + 1, code: 'SKU_EXISTS', message: 'SKU 已存在，需改为供应商/成本导入或手动更新。', sku }); continue }
      const payload = { sku, name, specs: parseJsonObject(candidate?.specsJson ?? candidate?.specs, '规格 JSON', {}), packing: parseJsonObject(candidate?.packingJson ?? candidate?.packing, '包装 JSON', {}), costVersions: parseJsonObject(candidate?.costVersionsJson ?? candidate?.costVersions, '成本版本 JSON', {}), active: boolValue(candidate?.active, true) }
      if (dryRun) report.created.push({ row: index + 1, preview: true, sku, name, categoryName })
      else {
        // 修复说明：[中危-数据一致性]，原因：分类/产品/审计三步无事务，产品创建失败会留下空分类；SKU 并发导入撞唯一约束未捕获变 500。事务化 + P2002 转行级冲突。
        try {
          const { product } = await db.$transaction(async (tx) => {
            let [category] = await tx.productCategory.findMany({ where: { name: categoryName }, take: 1 })
            if (!category) category = await tx.productCategory.create({ data: { name: categoryName } })
            const created = await tx.product.create({ data: { ...payload, categoryId: category.id } })
            await audit(tx, actor, 'IMPORT_CREATE', 'product', created.id, { row: index + 1, sku, categoryId: category.id })
            return { product: created }
          })
          report.created.push({ row: index + 1, id: product.id, sku: product.sku })
        } catch (error) {
          if (error?.code === 'P2002') { report.conflicts.push({ row: index + 1, code: 'SKU_EXISTS', message: 'SKU 已存在（并发导入冲突）。', sku }); continue }
          throw error
        }
      }
    } catch (error) { rowError(report, index, error) }
  }
  return finalize(report)
}
async function importSupplierCosts(db, actor, body) {
  assertImportAccess(actor, 'supplier-costs', true)
  const { dryRun } = importMode(body)
  const rows = asRows(body)
  const report = emptyReport('supplier-costs', dryRun); report.total = rows.length
  for (const [index, candidate] of rows.entries()) {
    try {
      const sku = text(candidate?.sku, 'SKU', { required: true, max: 80 })?.toUpperCase()
      const [product] = await db.product.findMany({ where: { sku }, take: 1 })
      if (!product) { report.errors.push({ row: index + 1, code: 'PRODUCT_NOT_FOUND', message: 'SKU 对应产品不存在。' }); continue }
      const supplier = { supplierName: text(candidate?.supplierName, '供应商名称', { max: 160 }), cost: nonNegativeNumber(candidate?.cost, '采购成本', { required: true }), currency: text(candidate?.currency || 'CNY', '币种', { required: true, max: 3 })?.toUpperCase(), effectiveFrom: text(candidate?.effectiveFrom, '生效日期', { max: 40 }), moq: nonNegativeNumber(candidate?.moq, 'MOQ'), note: text(candidate?.note, '备注', { max: 500 }) }
      if (!/^[A-Z]{3}$/.test(supplier.currency)) throw new HttpError(400, 'VALIDATION_ERROR', '币种必须为三位 ISO 代码。')
      if (dryRun) report.updated.push({ row: index + 1, preview: true, productId: product.id, sku, supplierName: supplier.supplierName, cost: supplier.cost })
      else {
        // 修复说明：[中危-并发丢失更新]，原因：读-改-写 costVersions 无事务/无重读，并发导入会互相覆盖 suppliers 追加；事务内重读后再合并。
        const { updated } = await db.$transaction(async (tx) => {
          const fresh = await tx.product.findUnique({ where: { id: product.id } })
          const nextCostVersions = { ...(fresh?.costVersions || {}), current: supplier.cost, currency: supplier.currency, suppliers: [...(Array.isArray(fresh?.costVersions?.suppliers) ? fresh.costVersions.suppliers : []), supplier] }
          const updated = await tx.product.update({ where: { id: product.id }, data: { costVersions: nextCostVersions } })
          await audit(tx, actor, 'IMPORT_UPDATE', 'product_cost', updated.id, { row: index + 1, sku, supplierName: supplier.supplierName })
          return { updated }
        })
        report.updated.push({ row: index + 1, id: updated.id, sku })
      }
    } catch (error) { rowError(report, index, error) }
  }
  return finalize(report)
}
async function importQuoteRules(db, actor, body) {
  assertImportAccess(actor, 'quote-rules', true)
  assertQuoteRuleWrite(actor)
  const { dryRun } = importMode(body)
  const rows = asRows(body)
  const report = emptyReport('quote-rules', dryRun); report.total = rows.length
  for (const [index, candidate] of rows.entries()) {
    try {
      const baseRules = candidate?.rulesJson || candidate?.rules ? parseJsonObject(candidate.rulesJson ?? candidate.rules, '报价规则 JSON', {}) : { currency: candidate?.currency || 'USD', fxRateCnyPerUsd: Number(candidate?.fxRateCnyPerUsd || 7.2), marginRate: Number(candidate?.marginRate || 0.2), minimumMarginRate: Number(candidate?.minimumMarginRate || 0.12) }
      const rules = quoteRules(baseRules)
      const code = text(candidate?.code || rules.code, '规则编码', { required: true, max: 80 })?.toUpperCase()
      const existing = await db.quoteRuleSet.findUnique({ where: { code } })
      if (existing) { report.conflicts.push({ row: index + 1, code: 'RULE_CODE_EXISTS', message: '报价规则编码已存在。', ruleCode: code }); continue }
      const payload = { code, name: text(candidate?.name || code, '规则名称', { required: true, max: 120 }), status: text(candidate?.status || 'DRAFT', '状态', { required: true, max: 20 })?.toUpperCase(), currency: rules.currency, source: text(candidate?.source || 'P1.4 import', '规则来源', { max: 160 }), rules: { ...rules, code }, createdById: actor.id }
      if (!['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(payload.status)) throw new HttpError(400, 'VALIDATION_ERROR', '规则状态仅支持 DRAFT / ACTIVE / ARCHIVED。')
      if (dryRun) report.created.push({ row: index + 1, preview: true, code, status: payload.status, currency: payload.currency })
      else {
        // 修复说明：[中危-数据一致性]，原因：规则创建与审计分离；code 并发撞唯一约束未捕获变 500。事务化 + P2002 转行级冲突。
        try {
          const { created } = await db.$transaction(async (tx) => {
            const created = await tx.quoteRuleSet.create({ data: payload })
            await audit(tx, actor, 'IMPORT_CREATE', 'quote_rule_set', created.id, { row: index + 1, code, status: payload.status })
            return { created }
          })
          report.created.push({ row: index + 1, id: created.id, code: created.code, status: created.status })
        } catch (error) {
          if (error?.code === 'P2002') { report.conflicts.push({ row: index + 1, code: 'RULE_CODE_EXISTS', message: '报价规则编码已存在（并发导入冲突）。', ruleCode: code }); continue }
          throw error
        }
      }
    } catch (error) { rowError(report, index, error) }
  }
  return finalize(report)
}

export async function handleImportTemplateRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/import/templates') {
    const templates = [...IMPORT_TYPES].filter((type) => { try { assertImportAccess(actor, type, false); return true } catch { return false } }).map((type) => templateFor(type))
    return send(res, 200, { data: { items: templates.map(({ csvDictionary, ...item }) => item), total: templates.length } })
  }
  const templateMatch = pathname.match(/^\/api\/import\/templates\/([^/]+)$/)
  if (templateMatch && req.method === 'GET') {
    const type = templateMatch[1]
    assertImportAccess(actor, type, false)
    return send(res, 200, { data: templateFor(type) })
  }
  const importMatch = pathname.match(/^\/api\/import\/(leads|customers|products|supplier-costs|quote-rules)$/)
  if (importMatch && req.method === 'POST') {
    const type = importMatch[1]
    const body = await readJson(req)
    if (type === 'leads') return send(res, 200, { data: await importLeads(db, actor, body) })
    if (type === 'customers') return send(res, 200, { data: await importCustomers(db, actor, body) })
    if (type === 'products') return send(res, 200, { data: await importProducts(db, actor, body) })
    if (type === 'supplier-costs') return send(res, 200, { data: await importSupplierCosts(db, actor, body) })
    if (type === 'quote-rules') return send(res, 200, { data: await importQuoteRules(db, actor, body) })
  }
  return false
}

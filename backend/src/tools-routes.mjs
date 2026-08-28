import { assertCrmAccess, assertCustomerScope } from './access.mjs'
import { findDuplicateCustomerMatches, fingerprintsFromDedupeInput, fingerprintsFromCustomer, normalizeDomain, registerCustomerFingerprints } from './customer-fingerprint.mjs'
import { HttpError, readJson, send, text } from './http.mjs'

const WRITE_TOOL_ROLES = new Set(['SALES', 'MANAGER', 'ADMIN'])
const ALL_TOOL_ROLES = new Set(['SALES', 'MANAGER', 'FINANCE', 'EXEC', 'ADMIN'])
const FOLLOWUP_SCENARIOS = new Set(['FIRST_TOUCH', 'FOLLOW_UP', 'WAKE_SILENT', 'HOLIDAY'])
const LANGUAGES = new Set(['ZH', 'EN', 'BILINGUAL'])
const FX_TABLE = {
  USD: { CNY: 7.85, EUR: 0.92 },
  CNY: { USD: 1 / 7.85, EUR: 0.117 },
  EUR: { USD: 1.087, CNY: 8.53 },
}
const HS_CODES = [
  { code: '391690', keyword: 'filament', zh: '塑料单丝/3D 打印耗材参考类目', note: '本地参考，不替代正式海关归类。' },
  { code: '847780', keyword: '3d printer', zh: '橡胶或塑料加工机器参考类目', note: '本地参考，不替代正式海关归类。' },
  { code: '940599', keyword: 'led light', zh: '灯具零件参考类目', note: '本地参考，不替代正式海关归类。' },
  { code: '850440', keyword: 'power supply', zh: '静止式变流器参考类目', note: '本地参考，不替代正式海关归类。' },
]

function assertToolRead(actor) {
  if (!ALL_TOOL_ROLES.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问工具中心。')
}

function assertToolWrite(actor, label = '该工具') {
  if (!WRITE_TOOL_ROLES.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', `当前角色无权使用${label}。`)
}

function currency(value, field) {
  const result = text(value, field, { required: true, max: 3 })?.toUpperCase()
  if (!/^[A-Z]{3}$/.test(result)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须为三位 ISO 币种代码。`)
  return result
}

function positiveAmount(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) throw new HttpError(400, 'VALIDATION_ERROR', '金额必须是 0 到 1000000000 之间的数字。')
  return amount
}

function dateNowIso() {
  return new Date().toISOString()
}

async function audit(tx, actor, action, resource, resourceId, detail) {
  await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
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

function websiteLinkInput(body) {
  const customerId = text(body.customerId, '客户', { required: true, max: 64 })
  const website = text(body.website, '官网链接', { required: true, max: 255 })
  const normalizedDomain = normalizeDomain(website)
  if (!normalizedDomain) throw new HttpError(400, 'VALIDATION_ERROR', '官网链接必须是有效域名或 http(s) URL。')
  return { customerId, website, normalizedDomain, note: text(body.note, '备注', { max: 500 }) }
}

function ocrInput(body) {
  const imageName = text(body.imageName || body.fileName, '名片文件名', { required: true, max: 160 })
  const dryRun = body.dryRun !== false
  if (body.content != null && typeof body.content !== 'string') throw new HttpError(400, 'VALIDATION_ERROR', 'OCR 文本内容必须是文本。')
  if (body.content && Buffer.byteLength(body.content, 'utf8') > 16 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'OCR 文本内容不能超过 16KB。')
  return {
    imageName,
    dryRun,
    content: typeof body.content === 'string' ? body.content.trim() : '',
  }
}

function parseBusinessCard(content) {
  const email = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null
  const website = content.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+/i)?.[0] || null
  const phone = content.match(/(?:\+?\d[\d\s().-]{5,}\d)/)?.[0]?.trim() || null
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  return {
    contactName: lines[0] || null,
    companyName: lines.find((line) => /ltd|inc|company|co\.|集团|公司/i.test(line)) || null,
    email,
    phone,
    website,
  }
}

function followupInput(body) {
  const scenario = text(body.scenario, '话术场景', { required: true, max: 20 })?.toUpperCase()
  if (!FOLLOWUP_SCENARIOS.has(scenario)) throw new HttpError(400, 'VALIDATION_ERROR', '话术场景不支持。')
  const language = text(body.language || 'en', '语言', { required: true, max: 12 })?.toUpperCase()
  if (!LANGUAGES.has(language)) throw new HttpError(400, 'VALIDATION_ERROR', '语言仅支持 zh / en / bilingual。')
  return {
    scenario,
    language,
    customerId: text(body.customerId, '客户', { max: 64 }),
    opportunityId: text(body.opportunityId, '商机', { max: 64 }),
    customerName: text(body.customerName, '客户名', { max: 120 }),
    product: text(body.product, '产品', { max: 120 }),
    tone: text(body.tone || 'professional', '语气', { required: true, max: 20 }),
  }
}

function localFollowupCopy(input, customerName) {
  const name = customerName || input.customerName || 'Customer'
  const product = input.product ? ` about ${input.product}` : ''
  const templates = {
    FIRST_TOUCH: `Dear ${name},\n\nI noticed your team may be evaluating new sourcing options${product}. We can share a concise product and lead-time summary for your review.\n\nWould a short call next week be convenient?\n\nBest regards`,
    FOLLOW_UP: `Dear ${name},\n\nFollowing up on our previous discussion${product}. I can prepare the next quotation or sample details once you confirm the key requirements.\n\nPlease let me know what would be most useful.\n\nBest regards`,
    WAKE_SILENT: `Dear ${name},\n\nHope business is going well. We have updated product and delivery information${product} that may be relevant to your next purchase cycle.\n\nHappy to reconnect whenever convenient.\n\nBest regards`,
    HOLIDAY: `Dear ${name},\n\nWishing you and your team a pleasant holiday season and a successful year ahead. We appreciate the opportunity to stay in touch.\n\nSeason's greetings`,
  }
  if (input.language === 'ZH') return templates[input.scenario].replace(/^Dear .*?,/, `${name}，您好：`).replace(/Best regards|Season's greetings/g, '顺祝商祺')
  if (input.language === 'BILINGUAL') return `${templates[input.scenario]}\n\n---- 中文对照 ----\n${name}，您好：\n以上为本地模板生成的话术草稿，请人工确认后外发。`
  return templates[input.scenario]
}

export async function handleToolsRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'POST' && pathname === '/api/tools/dedupe') {
    assertCrmAccess(actor)
    const body = await readJson(req)
    const fingerprints = fingerprintsFromDedupeInput(body)
    const duplicates = await findDuplicateCustomerMatches(db, fingerprints, { actor })
    return send(res, 200, { data: { fingerprints, candidates: duplicates.candidates, hiddenCount: duplicates.hiddenCount, hasDuplicates: duplicates.total > 0, mode: 'customer-fingerprint' } })
  }

  if (req.method === 'POST' && pathname === '/api/tools/website-link') {
    assertToolWrite(actor, '官网链接登记')
    const data = websiteLinkInput(await readJson(req))
    const customer = await customerById(db, data.customerId)
    assertCustomerScope(actor, customer)
    const updated = await db.$transaction(async (tx) => {
      const item = await tx.customer.update({ where: { id: customer.id }, data: { website: data.website } })
      const fingerprints = await registerCustomerFingerprints(tx, customer.id, fingerprintsFromCustomer({ name: item.name, website: data.website }, 'WEBSITE_LINK'), 'WEBSITE_LINK')
      await audit(tx, actor, 'UPDATE', 'customer_website', customer.id, { normalizedDomain: data.normalizedDomain, fingerprintCount: fingerprints.length, note: data.note })
      return item
    })
    return send(res, 200, { data: { customer: updated, normalizedDomain: data.normalizedDomain, mode: 'customer-profile-update' } })
  }

  if (req.method === 'GET' && pathname === '/api/tools/fx') {
    assertToolRead(actor)
    const from = currency(url.searchParams.get('from'), '源币种')
    const to = currency(url.searchParams.get('to'), '目标币种')
    const amount = positiveAmount(url.searchParams.get('amount') || '1')
    const rate = from === to ? 1 : FX_TABLE[from]?.[to]
    if (!rate) throw new HttpError(404, 'FX_RATE_NOT_FOUND', '当前本地汇率表暂未覆盖该币种组合。')
    return send(res, 200, { data: { from, to, amount, rate, convertedAmount: Math.round(amount * rate * 100) / 100, mode: 'local-reference-rate', asOf: dateNowIso(), limitations: ['本地参考汇率，不替代财务正式汇率版本。'] } })
  }

  if (req.method === 'GET' && pathname === '/api/tools/hs') {
    assertToolRead(actor)
    const keyword = text(url.searchParams.get('keyword'), '关键词', { required: true, max: 80 })?.toLowerCase()
    const items = HS_CODES.filter((item) => item.keyword.includes(keyword) || item.zh.toLowerCase().includes(keyword) || item.code.includes(keyword)).slice(0, 20)
    return send(res, 200, { data: { items, total: items.length, mode: 'local-reference-hs', limitations: ['HS 编码为本地参考速查，正式归类需人工复核。'] } })
  }

  if (req.method === 'POST' && pathname === '/api/tools/ocr') {
    assertToolWrite(actor, '名片 OCR 识别')
    const data = ocrInput(await readJson(req))
    if (data.dryRun !== true) throw new HttpError(400, 'OCR_EXTERNAL_NOT_CONFIGURED', '当前未接真实 OCR 服务，仅支持 dry-run 或人工录入文本解析。')
    return send(res, 200, { data: { mode: 'dry-run-local-parse', imageName: data.imageName, extracted: parseBusinessCard(data.content), limitations: ['未调用 PaddleOCR、云 OCR 或外部服务；结果需人工确认后写入客户/联系人。'] } })
  }

  if (req.method === 'POST' && pathname === '/api/tools/followup-copy') {
    assertToolWrite(actor, '跟进话术生成')
    const input = followupInput(await readJson(req))
    let customerName = input.customerName
    if (input.customerId) {
      const customer = await customerById(db, input.customerId)
      assertCustomerScope(actor, customer)
      customerName = customer.name
    }
    if (input.opportunityId) {
      const opportunity = await opportunityById(db, input.opportunityId)
      assertCustomerScope(actor, opportunity.customer)
      if (input.customerId && opportunity.customerId !== input.customerId) throw new HttpError(400, 'VALIDATION_ERROR', '商机不属于所选客户。')
    }
    return send(res, 200, { data: { copy: localFollowupCopy(input, customerName), mode: 'local-template', scenario: input.scenario, language: input.language, limitations: ['未调用真实 AI；话术为本地模板草稿，外发前必须人工确认。'] } })
  }

  return false
}

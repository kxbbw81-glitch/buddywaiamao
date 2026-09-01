import { assertProductAccess } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const DOC_TYPES = new Set(['TDS', 'SDS', 'CERT'])
const DOC_STATUSES = new Set(['DRAFT', 'REVIEWED', 'EXPIRED'])
const productInclude = { category: { select: { id: true, name: true, parentId: true } }, _count: { select: { docs: true } } }

function jsonValue(value, field) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是 JSON 对象。`)
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 16 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', `${field} 不能超过 16KB。`)
  return value
}
function categoryInput(body) { return { name: text(body.name, '分类名称', { required: true, max: 120 }), parentId: text(body.parentId, '父分类', { max: 64 }) } }
function productInput(body) {
  const sku = text(body.sku, 'SKU', { required: true, max: 80 })?.toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)) throw new HttpError(400, 'VALIDATION_ERROR', 'SKU 只能包含大写字母、数字、点、下划线和连字符。')
  if (body.active != null && typeof body.active !== 'boolean') throw new HttpError(400, 'VALIDATION_ERROR', 'active 必须为布尔值。')
  return { sku, name: text(body.name, '产品名称', { required: true, max: 160 }), categoryId: text(body.categoryId, '产品分类', { required: true, max: 64 }), specs: jsonValue(body.specs, '规格'), packing: jsonValue(body.packing, '包装'), costVersions: jsonValue(body.costVersions, '成本版本'), ...(body.active != null ? { active: body.active } : {}) }
}
function documentInput(body) {
  const type = text(body.type, '资料类型', { required: true, max: 20 })?.toUpperCase()
  const status = text(body.status, '资料状态', { required: true, max: 20 })?.toUpperCase()
  if (!DOC_TYPES.has(type) || !DOC_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '资料类型或状态不支持。')
  let validUntil = null
  if (body.validUntil) { validUntil = new Date(body.validUntil); if (Number.isNaN(validUntil.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', '资料有效期无效。') }
  return { type, status, fileUrl: text(body.fileUrl, '资料链接', { required: true, max: 1024 }), validUntil }
}
async function audit(tx, actor, action, resource, resourceId, detail) { await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } }) }
async function categoryById(db, id) { const item = await db.productCategory.findUnique({ where: { id } }); if (!item) throw new HttpError(404, 'NOT_FOUND', '产品分类不存在。'); return item }
async function productById(db, id) { const item = await db.product.findUnique({ where: { id }, include: productInclude }); if (!item) throw new HttpError(404, 'NOT_FOUND', '产品不存在。'); return item }

export async function handleProductRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/product-categories') {
    assertProductAccess(actor); const { page, pageSize, skip } = listQuery(url); const where = url.searchParams.get('parentId') ? { parentId: url.searchParams.get('parentId') } : {}
    const [items, total] = await db.$transaction([db.productCategory.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize }), db.productCategory.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }
  if (req.method === 'POST' && pathname === '/api/product-categories') {
    assertProductAccess(actor, true); const data = categoryInput(await readJson(req)); if (data.parentId) await categoryById(db, data.parentId)
    const item = await db.$transaction(async (tx) => { const created = await tx.productCategory.create({ data }); await audit(tx, actor, 'CREATE', 'product_category', created.id, { parentId: data.parentId }); return created })
    return send(res, 201, { data: item })
  }
  if (req.method === 'GET' && pathname === '/api/products') {
    assertProductAccess(actor); const { page, pageSize, skip } = listQuery(url); const categoryId = url.searchParams.get('categoryId'); const where = categoryId ? { categoryId } : {}
    const [items, total] = await db.$transaction([db.product.findMany({ where, include: productInclude, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.product.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }
  if (req.method === 'POST' && pathname === '/api/products') {
    assertProductAccess(actor, true); const data = productInput(await readJson(req)); await categoryById(db, data.categoryId)
    const item = await db.$transaction(async (tx) => { const created = await tx.product.create({ data, include: productInclude }); await audit(tx, actor, 'CREATE', 'product', created.id, { sku: data.sku }); return created })
    return send(res, 201, { data: item })
  }
  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/)
  if (productMatch && req.method === 'GET') { assertProductAccess(actor); return send(res, 200, { data: await productById(db, productMatch[1]) }) }
  if (productMatch && req.method === 'PUT') {
    assertProductAccess(actor, true); const current = await productById(db, productMatch[1]); const data = productInput(await readJson(req)); await categoryById(db, data.categoryId)
    const item = await db.$transaction(async (tx) => { const updated = await tx.product.update({ where: { id: current.id }, data, include: productInclude }); await audit(tx, actor, 'UPDATE', 'product', current.id, { fields: Object.keys(data) }); return updated })
    return send(res, 200, { data: item })
  }
  const docsMatch = pathname.match(/^\/api\/products\/([^/]+)\/docs$/)
  if (docsMatch && req.method === 'GET') {
    assertProductAccess(actor); const product = await productById(db, docsMatch[1]); const { page, pageSize, skip } = listQuery(url); const where = { productId: product.id }
    const [items, total] = await db.$transaction([db.productDoc.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), db.productDoc.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }
  if (docsMatch && req.method === 'POST') {
    assertProductAccess(actor, true); const product = await productById(db, docsMatch[1]); const data = documentInput(await readJson(req))
    const item = await db.$transaction(async (tx) => { const created = await tx.productDoc.create({ data: { ...data, productId: product.id } }); await audit(tx, actor, 'CREATE', 'product_doc', created.id, { productId: product.id, type: data.type }); return created })
    return send(res, 201, { data: item })
  }
  return false
}

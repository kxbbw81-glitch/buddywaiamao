import { assertKnowledgeAccess } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const DOCUMENT_STATUSES = new Set(['DRAFT', 'APPROVED', 'REJECTED', 'EXPIRED'])
const REVIEW_STATUSES = new Set(['APPROVED', 'REJECTED'])

const documentInclude = {
  product: { select: { id: true, sku: true, name: true, active: true } },
  createdBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  _count: { select: { chunks: true } },
}

function statusValue(value) {
  const status = text(value, '知识文档状态', { required: true, max: 20 })?.toUpperCase()
  if (!DOCUMENT_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '知识文档状态不支持。')
  return status
}

function reviewStatus(value) {
  const status = text(value, '审核状态', { required: true, max: 20 })?.toUpperCase()
  if (!REVIEW_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '审核状态仅支持 APPROVED 或 REJECTED。')
  return status
}

function optionalDate(value, field) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 无效。`)
  return date
}

function chunkInputs(value) {
  if (!Array.isArray(value) || !value.length) throw new HttpError(400, 'VALIDATION_ERROR', '知识文档至少需要一个分段。')
  if (value.length > 50) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '单个知识文档分段不能超过 50 个。')
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'VALIDATION_ERROR', `第 ${index + 1} 个分段必须是 JSON 对象。`)
    const content = text(item.content, `第 ${index + 1} 个分段内容`, { required: true, max: 4000 })
    return {
      chunkNo: index + 1,
      heading: text(item.heading || `片段 ${index + 1}`, `第 ${index + 1} 个分段标题`, { max: 160 }),
      content,
      tokens: Math.ceil(content.length / 2),
    }
  })
}

function createInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'VALIDATION_ERROR', '请求体必须是 JSON 对象。')
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 256 * 1024) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '知识文档不能超过 256KB。')
  return {
    title: text(body.title, '标题', { required: true, max: 200 }),
    type: text(body.type || 'FAQ', '类型', { required: true, max: 40 })?.toUpperCase(),
    sourceName: text(body.sourceName || body.title, '来源名称', { required: true, max: 240 }),
    version: text(body.version || 'v1', '版本', { required: true, max: 40 }),
    language: text(body.language || 'zh-CN', '语言', { required: true, max: 20 }),
    productId: text(body.productId, '产品', { max: 64 }),
    validUntil: optionalDate(body.validUntil, '有效期'),
    summary: text(body.summary, '摘要', { max: 2000 }),
    chunks: chunkInputs(body.chunks),
  }
}

async function productById(db, id) {
  if (!id) return null
  const product = await db.product.findUnique({ where: { id }, select: { id: true, active: true } })
  if (!product) throw new HttpError(404, 'NOT_FOUND', '产品不存在。')
  if (product.active === false) throw new HttpError(400, 'VALIDATION_ERROR', '产品已停用，不能绑定新的知识文档。')
  return product
}

async function audit(tx, actor, action, resource, resourceId, detail) {
  await tx.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function documentById(db, id) {
  const document = await db.knowledgeDocument.findUnique({ where: { id }, include: documentInclude })
  if (!document) throw new HttpError(404, 'NOT_FOUND', '知识文档不存在。')
  return document
}

export async function handleKnowledgeRoute({ req, res, url, pathname, actor, db }) {
  // 修复说明：[低危-越权读]，原因：SALES 可通过列表/详情直读未经审核的 DRAFT/REJECTED 知识文档全文，绕过 RAG"仅 APPROVED 可回答"的红线；现非 MANAGER/ADMIN 角色只能读取 APPROVED 文档。
  const reviewVisible = ['MANAGER', 'ADMIN'].includes(actor.role)
  if (req.method === 'GET' && pathname === '/api/knowledge-documents') {
    assertKnowledgeAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const status = url.searchParams.get('status') ? statusValue(url.searchParams.get('status')) : null
    const productId = url.searchParams.get('productId')
    const type = url.searchParams.get('type')?.toUpperCase()
    const where = { ...(reviewVisible ? {} : { status: 'APPROVED' }), ...(status && reviewVisible ? { status } : {}), ...(productId ? { productId } : {}), ...(type ? { type } : {}) }
    const [items, total] = await db.$transaction([db.knowledgeDocument.findMany({ where, include: documentInclude, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.knowledgeDocument.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/knowledge-documents') {
    assertKnowledgeAccess(actor, 'write')
    const data = createInput(await readJson(req))
    await productById(db, data.productId)
    const document = await db.$transaction(async (tx) => {
      const created = await tx.knowledgeDocument.create({ data: { title: data.title, type: data.type, sourceName: data.sourceName, version: data.version, language: data.language, productId: data.productId, validUntil: data.validUntil, summary: data.summary, status: 'DRAFT', createdById: actor.id }, include: documentInclude })
      for (const chunk of data.chunks) await tx.knowledgeChunk.create({ data: { ...chunk, documentId: created.id } })
      await audit(tx, actor, 'CREATE', 'knowledge_document', created.id, { type: data.type, productId: data.productId, chunks: data.chunks.length })
      return created
    })
    return send(res, 201, { data: document })
  }

  const documentMatch = pathname.match(/^\/api\/knowledge-documents\/([^/]+)$/)
  if (documentMatch && req.method === 'GET') {
    assertKnowledgeAccess(actor)
    const document = await documentById(db, documentMatch[1])
    if (!reviewVisible && document.status !== 'APPROVED') throw new HttpError(404, 'NOT_FOUND', '知识文档不存在。')
    const chunks = await db.knowledgeChunk.findMany({ where: { documentId: document.id }, orderBy: { chunkNo: 'asc' }, take: 100 })
    return send(res, 200, { data: { ...document, chunks } })
  }

  const reviewMatch = pathname.match(/^\/api\/knowledge-documents\/([^/]+)\/review$/)
  if (reviewMatch && req.method === 'POST') {
    assertKnowledgeAccess(actor, 'review')
    const document = await documentById(db, reviewMatch[1])
    // 修复说明：[低危-职责分离]，原因：MANAGER 可审核自己创建的知识文档（自审自批），未审核内容可能带偏向进入 RAG 回答；现禁止创建人审核自己的文档（ADMIN 例外）。
    if (document.createdById === actor.id && actor.role !== 'ADMIN') throw new HttpError(403, 'FORBIDDEN', '不能审核自己创建的知识文档。')
    const body = await readJson(req)
    const status = reviewStatus(body.status || 'APPROVED')
    const note = text(body.note, '审核备注', { max: 2000 })
    const chunks = await db.knowledgeChunk.findMany({ where: { documentId: document.id }, orderBy: { chunkNo: 'asc' }, take: 100 })
    if (status === 'APPROVED' && !chunks.length) throw new HttpError(400, 'KNOWLEDGE_EMPTY', '没有分段的知识文档不能审核通过。')
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.knowledgeDocument.update({ where: { id: document.id }, data: { status, reviewedById: actor.id, reviewedAt: new Date(), reviewNote: note }, include: documentInclude })
      await audit(tx, actor, 'REVIEW', 'knowledge_document', document.id, { from: document.status, to: status, chunks: chunks.length })
      return row
    })
    return send(res, 200, { data: updated })
  }

  return false
}

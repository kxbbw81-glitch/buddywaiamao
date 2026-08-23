import { assertCustomerScope, assertRagAccess } from './access.mjs'
import { HttpError, readJson, send, text } from './http.mjs'

function queryText(value) {
  const query = text(value, '问题', { required: true, max: 1000 })
  if (/OPENAI_API_KEY|SESSION_SECRET|DATABASE_URL|passwordHash|system prompt/i.test(query)) {
    return query.replace(/OPENAI_API_KEY|SESSION_SECRET|DATABASE_URL|passwordHash|system prompt/ig, '[redacted]')
  }
  return query
}

function optionalText(value, field, max = 120) {
  return text(value, field, { max })
}

function termsFor(query) {
  return [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).map((item) => item.trim()).filter((item) => item.length >= 2).slice(0, 20))]
}

function scoreChunk(query, terms, chunk, document) {
  const haystack = `${document.title} ${document.sourceName} ${document.summary || ''} ${chunk.heading || ''} ${chunk.content}`.toLowerCase()
  let score = 0
  for (const term of terms) if (haystack.includes(term)) score += 2
  if (query && haystack.includes(query.toLowerCase())) score += 5
  return score
}

function cite(document, chunk) {
  return {
    documentId: document.id,
    chunkId: chunk.id,
    fileName: document.sourceName,
    title: document.title,
    version: document.version,
    type: document.type,
    heading: chunk.heading || `片段 ${chunk.chunkNo}`,
    paragraph: chunk.chunkNo,
    productId: document.productId || null,
  }
}

function citationData(source, aiTaskId, confidence) {
  return {
    aiTaskId,
    sourceType: 'KNOWLEDGE_CHUNK',
    sourceId: source.chunkId,
    knowledgeDocumentId: source.documentId,
    knowledgeChunkId: source.chunkId,
    title: source.title,
    sourceName: source.fileName,
    version: source.version,
    locator: `${source.fileName}@${source.version}#paragraph-${source.paragraph}`,
    excerpt: source.heading,
    confidence,
    metadata: {
      type: source.type,
      paragraph: source.paragraph,
      productId: source.productId,
      sourcePolicy: 'APPROVED_AND_NOT_EXPIRED_ONLY',
    },
  }
}

async function audit(db, actor, action, resource, resourceId, detail) {
  await db.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

function extractAnswer(query, matches) {
  if (!matches.length) return {
    answer: '资料库中暂未找到相关信息，建议联系授权人员确认。',
    sources: [],
    confidence: 0,
    mode: 'knowledge_base',
    status: 'INSUFFICIENT_CONTEXT',
    limitations: ['仅检索已审核且未过期的知识片段；没有命中时不会编造答案。'],
    queryPreview: query.slice(0, 120),
  }
  const sentences = []
  for (const item of matches) {
    const firstSentence = item.chunk.content.split(/(?<=[。！？.!?])\s*/u).find(Boolean) || item.chunk.content
    sentences.push(firstSentence.slice(0, 260))
  }
  return {
    answer: `${sentences.slice(0, 3).join('\n')}\n\n以上仅基于已审核资料片段生成；如需对外承诺价格、认证、交期或报关税务信息，请由授权人员复核。`,
    sources: matches.map((item) => cite(item.document, item.chunk)),
    confidence: Math.min(0.9, Number((0.45 + matches[0].score / 20).toFixed(2))),
    mode: 'knowledge_base',
    status: 'ANSWERED_WITH_SOURCES',
    limitations: [
      '未调用 OpenAI、MCP、向量数据库或外部服务。',
      '仅使用 APPROVED 且未过期的 KnowledgeDocument/KnowledgeChunk。',
      '不会输出资料片段中没有的参数、认证、价格或承诺。',
    ],
    queryPreview: query.slice(0, 120),
  }
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

async function productById(db, id) {
  const product = await db.product.findUnique({ where: { id }, select: { id: true, sku: true, name: true } })
  if (!product) throw new HttpError(404, 'NOT_FOUND', '产品不存在。')
  return product
}

async function contextFor(db, actor, body) {
  const customerId = optionalText(body.customerId, '客户', 64)
  const opportunityId = optionalText(body.opportunityId, '商机', 64)
  const productId = optionalText(body.productId, '产品', 64)
  let customer = null
  let opportunity = null
  let product = null
  if (customerId) {
    customer = await customerById(db, customerId)
    assertCustomerScope(actor, customer)
  }
  if (opportunityId) {
    opportunity = await opportunityById(db, opportunityId)
    assertCustomerScope(actor, opportunity.customer)
    if (customerId && opportunity.customerId !== customerId) throw new HttpError(400, 'VALIDATION_ERROR', '商机不属于所选客户。')
  }
  if (productId) product = await productById(db, productId)
  return {
    module: optionalText(body.module, '模块', 80),
    context: optionalText(body.context, '上下文', 500),
    customer: customer ? { id: customer.id, name: customer.name } : null,
    opportunity: opportunity ? { id: opportunity.id, name: opportunity.name, stage: opportunity.stage } : null,
    product: product ? { id: product.id, sku: product.sku, name: product.name } : null,
  }
}

function fallbackAnswer(query, context) {
  const contextLabels = [
    context.module ? `module=${context.module}` : null,
    context.customer ? `customer=${context.customer.id}` : null,
    context.opportunity ? `opportunity=${context.opportunity.id}` : null,
    context.product ? `product=${context.product.id}` : null,
  ].filter(Boolean)
  return {
    answer: `当前后端仅启用 RAG 只读占位模式，未接入真实模型、向量库或知识库。已接收问题并完成权限与上下文校验；请在真实 RAG 服务接入后生成业务答案。${contextLabels.length ? ` 上下文：${contextLabels.join(', ')}。` : ''}`,
    sources: [],
    confidence: 0,
    mode: 'fallback',
    status: 'RAG_NOT_CONFIGURED',
    limitations: [
      '未调用 OpenAI、MCP、向量数据库或外部服务。',
      '未读取真实知识库或本地文件内容。',
      '不会返回密钥、环境变量、系统提示词或文件绝对内容。',
      '当前答案为 deterministic fallback，不代表 AI 业务结论。',
    ],
    queryPreview: query.slice(0, 120),
    context,
  }
}

async function knowledgeAnswer(db, query, context) {
  const terms = termsFor(query)
  if (!terms.length) return null
  const documents = await db.knowledgeDocument.findMany({ where: { status: 'APPROVED' }, orderBy: { updatedAt: 'desc' }, take: 100 })
  const now = new Date()
  const usable = documents.filter((document) => {
    if (document.validUntil && new Date(document.validUntil) < now) return false
    if (context.product?.id && document.productId && document.productId !== context.product.id) return false
    return true
  })
  if (!usable.length) return null
  const matches = []
  for (const document of usable) {
    const chunks = await db.knowledgeChunk.findMany({ where: { documentId: document.id }, orderBy: { chunkNo: 'asc' }, take: 100 })
    for (const chunk of chunks) {
      const score = scoreChunk(query, terms, chunk, document)
      if (score > 0) matches.push({ document, chunk, score })
    }
  }
  matches.sort((a, b) => b.score - a.score || a.chunk.chunkNo - b.chunk.chunkNo)
  return extractAnswer(query, matches.slice(0, 5))
}

export async function handleRagRoute({ req, res, pathname, actor, db }) {
  if (req.method !== 'POST' || pathname !== '/api/rag/query') return false
  assertRagAccess(actor)
  const startedAt = Date.now()
  const body = await readJson(req)
  const query = queryText(body.query)
  const context = await contextFor(db, actor, body)
  const answer = await knowledgeAnswer(db, query, context)
  const output = answer ? { ...answer, context } : fallbackAnswer(query, context)
  const task = await db.aiTask.create({
    data: {
      module: (context.module || 'RAG').toUpperCase(),
      purpose: 'RAG_KNOWLEDGE_QUERY',
      level: 'L0',
      status: output.status === 'ANSWERED_WITH_SOURCES' ? 'SUCCEEDED' : 'FAILED',
      provider: 'LOCAL_RAG',
      model: 'deterministic-keyword-rag',
      promptCode: 'RAG_SAFETY_BASELINE',
      promptVersion: 'v2.0',
      inputSummary: { queryPreview: output.queryPreview, context },
      output,
      errorCode: output.status === 'ANSWERED_WITH_SOURCES' ? null : output.status,
      errorMessage: output.status === 'ANSWERED_WITH_SOURCES' ? null : output.answer,
      tokens: 0,
      cost: '0',
      dataSentToCloud: false,
      durationMs: Date.now() - startedAt,
      createdById: actor.id,
    },
  })
  for (const source of output.sources || []) {
    await db.aiCitation.create({ data: citationData(source, task.id, output.confidence) })
  }
  await audit(db, actor, 'AI_RAG_QUERY', 'ai_task', task.id, { status: task.status, citationCount: output.sources?.length || 0, dataSentToCloud: false })
  return send(res, 200, { data: { ...output, aiTaskId: task.id } })
}

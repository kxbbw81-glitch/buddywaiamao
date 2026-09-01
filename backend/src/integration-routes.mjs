import { createHash } from 'node:crypto'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const NOTIFICATION_READ_ROLES = new Set(['SALES', 'MANAGER', 'FINANCE', 'EXEC', 'ADMIN'])
const NOTIFICATION_WRITE_ROLES = new Set(['MANAGER', 'ADMIN'])
const INTEGRATION_READ_ROLES = new Set(['MANAGER', 'EXEC', 'ADMIN'])
const INTEGRATION_WRITE_ROLES = new Set(['MANAGER', 'ADMIN'])
const PRIORITIES = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
const NOTIFICATION_STATUSES = new Set(['UNREAD', 'READ', 'ARCHIVED'])
const CONNECTION_STATUSES = new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'DISABLED'])
const AUTH_MODES = new Set(['MANUAL', 'OAUTH_REFERENCE', 'API_KEY_REFERENCE', 'WEBHOOK_SECRET_REFERENCE'])
const FALLBACK_MODES = new Set(['MANUAL_ENTRY', 'CSV_IMPORT', 'CSV_EXPORT', 'DRAFT_EXPORT'])
const HEALTH_STATUSES = new Set(['UNKNOWN', 'OK', 'DEGRADED', 'FAILED'])
const WEBHOOK_STATUSES = new Set(['RECEIVED', 'IGNORED', 'FAILED'])

function assertRole(actor, allowed, message = '当前角色无权访问集成与通知台账。') {
  if (!allowed.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', message)
}

function upperText(value, field, { required = false, max = 80 } = {}) {
  return text(value, field, { required, max })?.toUpperCase() || null
}

function enumValue(value, allowed, fallback, field) {
  const result = upperText(value || fallback, field, { required: true, max: 80 })
  if (!allowed.has(result)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 不在允许范围内。`)
  return result
}

function redactSecrets(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/OPENAI_API_KEY|SESSION_SECRET|DATABASE_URL|passwordHash|apiKey|secret|token|authorization|cookie/gi, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted-key]')
}

function safeSummary(value, depth = 0) {
  if (depth > 4) return '[truncated]'
  if (value == null) return value
  if (typeof value === 'string') return redactSecrets(value).slice(0, 800)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeSummary(item, depth + 1))
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, item]) => {
      if (/apiKey|password|secret|token|authorization|cookie|credential/i.test(key)) return [key, '[redacted]']
      return [key, safeSummary(item, depth + 1)]
    }))
  }
  return String(value)
}

function jsonObject(value, field, { required = true } = {}) {
  if (value == null) {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return null
  }
  if (typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是 JSON 对象。`)
  return value
}

function rejectInlineSecrets(value, field) {
  if (!value || typeof value !== 'object') return
  const serialized = JSON.stringify(value)
  // 修复说明：[中危-敏感信息]，原因：原键名黑名单漏掉 api_key/api-key/pwd/privateKey 等常见写法，非 sk- 前缀的明文密钥可绕过校验落库；现扩展键名匹配并叠加值形态检测。
  if (/"?(api[_-]?key|access[_-]?token|refresh[_-]?token|passw(or)?d|pwd|private[_-]?key|client[_-]?secret|secret|token|authorization|cookie|credential)"?\s*:/i.test(serialized)) {
    throw new HttpError(400, 'INLINE_SECRET_FORBIDDEN', `${field} 不允许保存明文密钥、token、密码或 cookie；请只保存 secretRef。`)
  }
  if (/sk-[A-Za-z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer [A-Za-z0-9._-]{16,}/.test(serialized)) {
    throw new HttpError(400, 'INLINE_SECRET_FORBIDDEN', `${field} 检测到疑似密钥内容，不允许明文保存；请只保存 secretRef。`)
  }
}

async function audit(db, actor, action, resource, resourceId, detail) {
  await db.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function ensureUser(db, id) {
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, status: true, teamId: true } })
  if (!user || user.status !== 'ACTIVE') throw new HttpError(400, 'INVALID_RECIPIENT', '通知接收人不存在或已停用。')
  return user
}

function compactNotification(row) {
  if (!row) return row
  const { body, metadata, ...summary } = row
  return {
    ...summary,
    bodyPreview: body ? body.slice(0, 120) : null,
    metadataKeys: metadata && typeof metadata === 'object' ? Object.keys(metadata).slice(0, 20) : [],
  }
}

function notificationInput(body) {
  return {
    recipientId: text(body.recipientId, '通知接收人', { required: true, max: 80 }),
    type: upperText(body.type || 'SYSTEM', '通知类型', { required: true, max: 80 }),
    title: text(body.title, '通知标题', { required: true, max: 160 }),
    body: text(body.body, '通知正文', { max: 2000 }),
    module: upperText(body.module, '模块', { max: 80 }),
    resource: upperText(body.resource, '资源类型', { max: 80 }),
    resourceId: text(body.resourceId, '资源 ID', { max: 120 }),
    priority: enumValue(body.priority, PRIORITIES, 'NORMAL', '通知优先级'),
    status: enumValue(body.status, NOTIFICATION_STATUSES, 'UNREAD', '通知状态'),
    metadata: body.metadata == null ? null : safeSummary(jsonObject(body.metadata, '通知元数据')),
  }
}

function connectionInput(body) {
  const config = jsonObject(body.configSummary || {}, '连接器配置摘要')
  rejectInlineSecrets(config, '连接器配置摘要')
  // 修复说明：[高危-敏感信息]，原因：secretRef 原无格式校验，可被填入真实 API Key 明文落库；现强制必须为 secret://、vault:// 等密钥管理引用格式，并拒绝疑似密钥本体。
  const secretRef = text(body.secretRef, '密钥引用', { max: 160 })
  if (secretRef) {
    if (!/^(secret|vault|kms|ssm):\/\//i.test(secretRef)) throw new HttpError(400, 'VALIDATION_ERROR', 'secretRef 必须是 secret://、vault:// 等密钥管理服务的引用，不允许保存密钥本体。')
    if (/sk-[A-Za-z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(secretRef)) throw new HttpError(400, 'VALIDATION_ERROR', 'secretRef 检测到疑似密钥内容，请只保存密钥管理服务的引用。')
  }
  return {
    code: upperText(body.code, '连接器编码', { required: true, max: 80 }),
    provider: upperText(body.provider, '供应商', { required: true, max: 80 }),
    connectorType: upperText(body.connectorType, '连接器类型', { required: true, max: 80 }),
    displayName: text(body.displayName, '显示名称', { required: true, max: 160 }),
    status: enumValue(body.status, CONNECTION_STATUSES, 'DRAFT', '连接器状态'),
    authMode: enumValue(body.authMode, AUTH_MODES, 'MANUAL', '认证方式'),
    secretRef,
    configSummary: safeSummary(config),
    fallbackMode: enumValue(body.fallbackMode, FALLBACK_MODES, 'MANUAL_ENTRY', '降级方式'),
    healthStatus: enumValue(body.healthStatus, HEALTH_STATUSES, 'UNKNOWN', '健康状态'),
  }
}

function compactConnection(row) {
  if (!row) return row
  const { configSummary, secretRef, ...summary } = row
  return {
    ...summary,
    hasSecretRef: Boolean(secretRef),
    configKeys: configSummary && typeof configSummary === 'object' ? Object.keys(configSummary).slice(0, 20) : [],
  }
}

async function connectionById(db, id) {
  const row = await db.integrationConnection.findUnique({ where: { id }, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } } } })
  if (!row) throw new HttpError(404, 'NOT_FOUND', '连接器不存在。')
  return row
}

function webhookInput(body) {
  if (body.processNow === true || body.executeActions === true || body.autoAcknowledge === true) {
    throw new HttpError(400, 'WEBHOOK_PROCESSING_FORBIDDEN', '第一版 Webhook 只记录接收台账，不自动处理外部动作。')
  }
  const payload = jsonObject(body.payload || body.receivedPayloadSummary || {}, 'Webhook 摘要')
  const provider = upperText(body.provider, '供应商', { required: true, max: 80 })
  const eventType = upperText(body.eventType, '事件类型', { required: true, max: 120 })
  const providedKey = text(body.idempotencyKey, '幂等键', { max: 160 })
  // 修复说明：[中危-幂等]，原因：idempotencyKey 可空导致唯一约束对 NULL 失效；缺失时按 provider+eventType+连接+payload 摘要自动生成确定性幂等键（缺 eventType/连接维度会把不同事件误去重）。
  const integrationConnectionId = text(body.integrationConnectionId, '连接器 ID', { max: 120 })
  const idempotencyKey = providedKey || `auto-${provider}-${eventType}-${integrationConnectionId || 'none'}-${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32)}`
  return {
    integrationConnectionId,
    provider,
    eventType,
    externalEventId: text(body.externalEventId, '外部事件 ID', { max: 160 }),
    status: enumValue(body.status, WEBHOOK_STATUSES, 'RECEIVED', 'Webhook 状态'),
    receivedPayloadSummary: safeSummary(payload),
    processingResult: body.processingResult == null ? null : safeSummary(jsonObject(body.processingResult, '处理结果')),
    idempotencyKey,
  }
}

function compactWebhook(row) {
  if (!row) return row
  return {
    id: row.id,
    integrationConnectionId: row.integrationConnectionId,
    provider: row.provider,
    eventType: row.eventType,
    externalEventId: row.externalEventId,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    duplicatePrevented: row.duplicatePrevented,
    recordedById: row.recordedById,
    recordedBy: row.recordedBy,
    receivedAt: row.receivedAt,
    payloadKeys: row.receivedPayloadSummary && typeof row.receivedPayloadSummary === 'object' ? Object.keys(row.receivedPayloadSummary).slice(0, 20) : [],
    integrationConnection: row.integrationConnection ? compactConnection(row.integrationConnection) : undefined,
  }
}

export async function handleIntegrationRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/notifications') {
    assertRole(actor, NOTIFICATION_READ_ROLES)
    const { page, pageSize, skip } = listQuery(url)
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { recipientId: actor.id, ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([
      db.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } } } }),
      db.notification.count({ where }),
    ])
    return send(res, 200, { data: { items: items.map(compactNotification), page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/notifications') {
    assertRole(actor, NOTIFICATION_WRITE_ROLES, '当前角色无权创建站内通知。')
    const data = notificationInput(await readJson(req))
    await ensureUser(db, data.recipientId)
    const row = await db.notification.create({ data: { ...data, createdById: actor.id } })
    await audit(db, actor, 'CREATE', 'notification', row.id, { recipientId: row.recipientId, type: row.type, module: row.module, noExternalSideEffects: true })
    return send(res, 201, { data: row })
  }

  const notificationReadMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/)
  if (notificationReadMatch && req.method === 'PATCH') {
    assertRole(actor, NOTIFICATION_READ_ROLES)
    const row = await db.notification.findUnique({ where: { id: notificationReadMatch[1] } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', '通知不存在。')
    if (row.recipientId !== actor.id) throw new HttpError(403, 'FORBIDDEN', '只能处理自己的通知。')
    const updated = await db.notification.update({ where: { id: row.id }, data: { status: 'READ', readAt: new Date() } })
    await audit(db, actor, 'READ', 'notification', updated.id, { recipientId: actor.id })
    return send(res, 200, { data: updated })
  }

  const notificationDetailMatch = pathname.match(/^\/api\/notifications\/([^/]+)$/)
  if (notificationDetailMatch && req.method === 'GET') {
    assertRole(actor, NOTIFICATION_READ_ROLES)
    const row = await db.notification.findUnique({ where: { id: notificationDetailMatch[1] }, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } } } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', '通知不存在。')
    if (row.recipientId !== actor.id) throw new HttpError(403, 'FORBIDDEN', '只能查看自己的通知。')
    return send(res, 200, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/integration-connections') {
    assertRole(actor, INTEGRATION_READ_ROLES)
    const { page, pageSize, skip } = listQuery(url)
    const provider = url.searchParams.get('provider')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const connectorType = url.searchParams.get('connectorType')?.toUpperCase()
    const where = { ...(provider ? { provider } : {}), ...(status ? { status } : {}), ...(connectorType ? { connectorType } : {}) }
    const [items, total] = await db.$transaction([
      db.integrationConnection.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } } } }),
      db.integrationConnection.count({ where }),
    ])
    return send(res, 200, { data: { items: items.map(compactConnection), page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/integration-connections') {
    assertRole(actor, INTEGRATION_WRITE_ROLES, '当前角色无权维护连接器。')
    const data = connectionInput(await readJson(req))
    const row = await db.integrationConnection.create({ data: { ...data, createdById: actor.id } })
    await audit(db, actor, 'CREATE', 'integration_connection', row.id, { code: row.code, provider: row.provider, connectorType: row.connectorType, status: row.status, fallbackMode: row.fallbackMode })
    // 修复说明：[高危-敏感信息]，原因：创建接口原返回完整 ORM 行，包含 secretRef 与完整 configSummary，明文密钥可被读回；现统一走 compactConnection 摘要。
    return send(res, 201, { data: compactConnection(row) })
  }

  const connectionStatusMatch = pathname.match(/^\/api\/integration-connections\/([^/]+)\/status$/)
  if (connectionStatusMatch && req.method === 'PATCH') {
    assertRole(actor, INTEGRATION_WRITE_ROLES, '当前角色无权维护连接器。')
    const existing = await connectionById(db, connectionStatusMatch[1])
    const body = await readJson(req)
    const data = {
      status: enumValue(body.status || existing.status, CONNECTION_STATUSES, existing.status, '连接器状态'),
      healthStatus: enumValue(body.healthStatus || existing.healthStatus, HEALTH_STATUSES, existing.healthStatus, '健康状态'),
      lastCheckedAt: new Date(),
    }
    const row = await db.integrationConnection.update({ where: { id: existing.id }, data })
    await audit(db, actor, 'STATUS_CHANGE', 'integration_connection', row.id, { from: existing.status, to: row.status, healthStatus: row.healthStatus })
    // 修复说明：[高危-敏感信息]，原因：状态更新接口原返回完整 ORM 行，包含 secretRef；现统一走 compactConnection 摘要。
    return send(res, 200, { data: compactConnection(row) })
  }

  const connectionDetailMatch = pathname.match(/^\/api\/integration-connections\/([^/]+)$/)
  if (connectionDetailMatch && req.method === 'GET') {
    assertRole(actor, INTEGRATION_READ_ROLES)
    const row = await connectionById(db, connectionDetailMatch[1])
    // 修复说明：[高危-敏感信息]，原因：连接器详情接口原返回完整 ORM 行，包含 secretRef，任何有读权限的人都能读回密钥引用原文；现统一走 compactConnection 摘要。
    return send(res, 200, { data: compactConnection(row) })
  }

  if (req.method === 'GET' && pathname === '/api/webhook-events') {
    assertRole(actor, INTEGRATION_READ_ROLES)
    const { page, pageSize, skip } = listQuery(url)
    const provider = url.searchParams.get('provider')?.toUpperCase()
    const eventType = url.searchParams.get('eventType')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(provider ? { provider } : {}), ...(eventType ? { eventType } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([
      db.webhookEvent.findMany({ where, orderBy: { receivedAt: 'desc' }, skip, take: pageSize, include: { recordedBy: { select: { id: true, name: true, role: true, teamId: true } }, integrationConnection: true } }),
      db.webhookEvent.count({ where }),
    ])
    return send(res, 200, { data: { items: items.map(compactWebhook), page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/webhook-events') {
    assertRole(actor, INTEGRATION_WRITE_ROLES, '当前角色无权登记 Webhook 事件。')
    const data = webhookInput(await readJson(req))
    if (data.integrationConnectionId) await connectionById(db, data.integrationConnectionId)
    if (data.idempotencyKey) {
      const existing = await db.webhookEvent.findFirst({ where: { provider: data.provider, idempotencyKey: data.idempotencyKey } })
      if (existing) return send(res, 200, { data: { ...compactWebhook(existing), duplicatePrevented: true } })
    }
    // 修复说明：[低危-幂等]，原因：幂等去重是先查后插，并发重复请求会撞唯一约束抛 P2002 变成 500；捕获后改查并按幂等返回已有记录。
    let row
    try {
      row = await db.webhookEvent.create({ data: { ...data, recordedById: actor.id } })
    } catch (error) {
      if (error?.code === 'P2002' && data.idempotencyKey) {
        const existing = await db.webhookEvent.findFirst({ where: { provider: data.provider, idempotencyKey: data.idempotencyKey } })
        if (existing) return send(res, 200, { data: { ...compactWebhook(existing), duplicatePrevented: true } })
      }
      throw error
    }
    await audit(db, actor, 'RECORD', 'webhook_event', row.id, { provider: row.provider, eventType: row.eventType, status: row.status, idempotencyKey: row.idempotencyKey, noAutomaticProcessing: true })
    return send(res, 201, { data: row })
  }

  const webhookDetailMatch = pathname.match(/^\/api\/webhook-events\/([^/]+)$/)
  if (webhookDetailMatch && req.method === 'GET') {
    assertRole(actor, INTEGRATION_READ_ROLES)
    const row = await db.webhookEvent.findUnique({ where: { id: webhookDetailMatch[1] }, include: { recordedBy: { select: { id: true, name: true, role: true, teamId: true } }, integrationConnection: true } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Webhook 事件不存在。')
    return send(res, 200, { data: row })
  }

  return false
}

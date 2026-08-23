import { HttpError, listQuery, readJson, send, text } from './http.mjs'

const READ_ROLES = new Set(['SALES', 'MANAGER', 'FINANCE', 'EXEC', 'ADMIN'])
const WRITE_ROLES = new Set(['MANAGER', 'ADMIN'])
const STATUSES = new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'])
const TRIGGERS = new Set(['EVENT', 'SCHEDULE', 'CONDITION'])
const RUN_MODES = new Set(['DRY_RUN', 'MANUAL_OVERRIDE'])

function assertAutomationAccess(actor, write = false) {
  const allowed = write ? WRITE_ROLES : READ_ROLES
  if (!allowed.has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权访问或维护自动化规则。')
}

function redactSecrets(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/OPENAI_API_KEY|SESSION_SECRET|DATABASE_URL|passwordHash|apiKey|secret|token/gi, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted-key]')
}

function safeSummary(value, depth = 0) {
  if (depth > 4) return '[truncated]'
  if (value == null) return value
  if (typeof value === 'string') return redactSecrets(value).slice(0, 800)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeSummary(item, depth + 1))
  if (typeof value === 'object') {
    const entries = Object.entries(value).slice(0, 30).map(([key, item]) => {
      if (/apiKey|password|secret|token|authorization|cookie/i.test(key)) return [key, '[redacted]']
      return [key, safeSummary(item, depth + 1)]
    })
    return Object.fromEntries(entries)
  }
  return String(value)
}

function upperText(value, field, { required = false, max = 80 } = {}) {
  return text(value, field, { required, max })?.toUpperCase() || null
}

function jsonObject(value, field, { required = true } = {}) {
  if (value == null) {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return null
  }
  if (typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是 JSON 对象。`)
  return value
}

function statusValue(value, field = '自动化状态') {
  const status = upperText(value || 'DRAFT', field, { required: true, max: 20 })
  if (!STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 仅支持 DRAFT / ACTIVE / PAUSED / ARCHIVED。`)
  return status
}

function triggerValue(value) {
  const trigger = upperText(value || 'EVENT', '触发类型', { required: true, max: 20 })
  if (!TRIGGERS.has(trigger)) throw new HttpError(400, 'VALIDATION_ERROR', '触发类型仅支持 EVENT / SCHEDULE / CONDITION。')
  return trigger
}

function ruleInput(body) {
  const action = jsonObject(body.action, '动作配置')
  if (action.executeExternal === true || action.autoSend === true || action.autoPublish === true) throw new HttpError(400, 'AUTOMATION_EXTERNAL_EXECUTION_FORBIDDEN', '第一版自动化只输出待办/草稿/人工任务建议，不直接执行外部动作。')
  return {
    code: upperText(body.code, '规则编码', { required: true, max: 80 }),
    name: text(body.name, '规则名称', { required: true, max: 160 }),
    module: upperText(body.module, '模块', { required: true, max: 80 }),
    triggerType: triggerValue(body.triggerType),
    status: statusValue(body.status),
    schedule: body.schedule == null ? null : jsonObject(body.schedule, '调度配置'),
    condition: jsonObject(body.condition, '条件配置'),
    action,
    retryPolicy: body.retryPolicy == null ? null : jsonObject(body.retryPolicy, '重试策略'),
    dedupePolicy: body.dedupePolicy == null ? null : jsonObject(body.dedupePolicy, '去重策略'),
    requiresManualOverride: body.requiresManualOverride !== false,
  }
}

function compactRule(row) {
  if (!row) return row
  const { condition, action, retryPolicy, dedupePolicy, schedule, ...summary } = row
  return {
    ...summary,
    ruleSummary: {
      hasSchedule: Boolean(schedule),
      conditionKeys: Object.keys(condition || {}),
      actionType: action?.type || null,
      hasRetryPolicy: Boolean(retryPolicy),
      hasDedupePolicy: Boolean(dedupePolicy),
    },
  }
}

function compactRun(row) {
  if (!row) return row
  return {
    id: row.id,
    ruleId: row.ruleId,
    mode: row.mode,
    status: row.status,
    matchedCount: row.matchedCount,
    idempotencyKey: row.idempotencyKey,
    duplicatePrevented: row.duplicatePrevented,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdById: row.createdById,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    rule: row.rule ? compactRule(row.rule) : undefined,
  }
}

function proposedActionsFor(rule, inputSummary) {
  const candidates = Array.isArray(inputSummary.candidates) ? inputSummary.candidates.slice(0, 20) : []
  const count = candidates.length || (Object.keys(inputSummary || {}).length ? 1 : 0)
  return {
    type: rule.action?.type || 'MANUAL_TASK',
    module: rule.module,
    ruleCode: rule.code,
    dryRunOnly: true,
    noExternalSideEffects: true,
    candidates: candidates.slice(0, 10),
    message: count
      ? `命中 ${count} 条候选。第一版仅生成待人工确认的动作建议，不自动发送、发布、改价、建单或调用外部连接器。`
      : '未命中候选。未产生任何外部动作。',
  }
}

async function audit(db, actor, action, resource, resourceId, detail) {
  await db.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function ruleById(db, id) {
  const row = await db.automationRule.findUnique({ where: { id }, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } } } })
  if (!row) throw new HttpError(404, 'NOT_FOUND', '自动化规则不存在。')
  return row
}

async function createRun({ db, actor, rule, body }) {
  const mode = upperText(body.mode || (body.dryRun === false ? 'MANUAL_OVERRIDE' : 'DRY_RUN'), '运行模式', { required: true, max: 40 })
  if (!RUN_MODES.has(mode)) throw new HttpError(400, 'VALIDATION_ERROR', '运行模式仅支持 DRY_RUN / MANUAL_OVERRIDE。')
  if (mode === 'MANUAL_OVERRIDE' && body.confirmedManualOverride !== true) throw new HttpError(400, 'MANUAL_OVERRIDE_REQUIRED', '非试运行必须由人工确认后仅记录人工覆盖结果。')
  if (mode === 'MANUAL_OVERRIDE' && rule.status !== 'ACTIVE') throw new HttpError(400, 'AUTOMATION_RULE_NOT_ACTIVE', '只有 ACTIVE 自动化规则可以记录人工覆盖运行。')
  const idempotencyKey = text(body.idempotencyKey, '幂等键', { max: 160 })
  if (idempotencyKey) {
    const existing = await db.automationRun.findFirst({ where: { ruleId: rule.id, idempotencyKey } })
    if (existing) return { ...existing, duplicatePrevented: true }
  }
  const inputSummary = safeSummary(jsonObject(body.input || {}, '运行输入'))
  const proposedActions = proposedActionsFor(rule, inputSummary)
  const matchedCount = Array.isArray(inputSummary.candidates) ? inputSummary.candidates.length : (Object.keys(inputSummary || {}).length ? 1 : 0)
  const data = {
    ruleId: rule.id,
    mode,
    status: mode === 'DRY_RUN' ? 'DRY_RUN_RECORDED' : 'MANUAL_OVERRIDE_RECORDED',
    inputSummary,
    matchedCount,
    proposedActions,
    executionResult: mode === 'MANUAL_OVERRIDE' ? safeSummary(jsonObject(body.executionResult || { recordedOnly: true, noExternalSideEffects: true }, '人工覆盖结果')) : null,
    idempotencyKey,
    duplicatePrevented: false,
    createdById: actor.id,
  }
  const row = await db.automationRun.create({ data })
  await audit(db, actor, 'RUN', 'automation_run', row.id, { ruleId: rule.id, mode: row.mode, status: row.status, matchedCount, idempotencyKey, noExternalSideEffects: true })
  return row
}

export async function handleAutomationRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/automation-rules') {
    assertAutomationAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const module = url.searchParams.get('module')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(module ? { module } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([
      db.automationRule.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } } } }),
      db.automationRule.count({ where }),
    ])
    return send(res, 200, { data: { items: items.map(compactRule), page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/automation-rules') {
    assertAutomationAccess(actor, true)
    const data = ruleInput(await readJson(req))
    const row = await db.automationRule.create({ data: { ...data, createdById: actor.id } })
    await audit(db, actor, 'CREATE', 'automation_rule', row.id, { code: row.code, module: row.module, triggerType: row.triggerType, status: row.status })
    return send(res, 201, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/automation-runs') {
    assertAutomationAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const ruleId = url.searchParams.get('ruleId') || null
    const mode = url.searchParams.get('mode')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(ruleId ? { ruleId } : {}), ...(mode ? { mode } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([
      db.automationRun.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } }, rule: true } }),
      db.automationRun.count({ where }),
    ])
    return send(res, 200, { data: { items: items.map(compactRun), page, pageSize, total } })
  }

  const ruleStatusMatch = pathname.match(/^\/api\/automation-rules\/([^/]+)\/status$/)
  if (ruleStatusMatch && req.method === 'PATCH') {
    assertAutomationAccess(actor, true)
    const rule = await ruleById(db, ruleStatusMatch[1])
    const body = await readJson(req)
    const status = statusValue(body.status, '自动化状态')
    const row = await db.automationRule.update({ where: { id: rule.id }, data: { status } })
    await audit(db, actor, 'STATUS_CHANGE', 'automation_rule', row.id, { from: rule.status, to: row.status })
    return send(res, 200, { data: row })
  }

  const ruleRunMatch = pathname.match(/^\/api\/automation-rules\/([^/]+)\/run$/)
  if (ruleRunMatch && req.method === 'POST') {
    assertAutomationAccess(actor, true)
    const rule = await ruleById(db, ruleRunMatch[1])
    const run = await createRun({ db, actor, rule, body: await readJson(req) })
    return send(res, run.duplicatePrevented ? 200 : 201, { data: run })
  }

  const ruleMatch = pathname.match(/^\/api\/automation-rules\/([^/]+)$/)
  if (ruleMatch && req.method === 'GET') {
    assertAutomationAccess(actor)
    const row = await ruleById(db, ruleMatch[1])
    const runCount = await db.automationRun.count({ where: { ruleId: row.id } })
    return send(res, 200, { data: { ...row, _count: { runs: runCount } } })
  }

  const runMatch = pathname.match(/^\/api\/automation-runs\/([^/]+)$/)
  if (runMatch && req.method === 'GET') {
    assertAutomationAccess(actor)
    const row = await db.automationRun.findUnique({ where: { id: runMatch[1] }, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } }, rule: true } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', '自动化运行记录不存在。')
    return send(res, 200, { data: row })
  }

  return false
}

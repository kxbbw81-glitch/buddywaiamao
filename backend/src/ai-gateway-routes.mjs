import { assertAiGatewayAccess, assertAiTaskScope, aiTaskScopeFor } from './access.mjs'
import { HttpError, listQuery, readJson, send, text } from './http.mjs'
import { aiQueueStatus, enqueueAiTaskJob } from './ai-queue.mjs'
import { appendAiTaskEvent, startAiTaskSse } from './ai-task-events.mjs'

const LOCAL_PROVIDER = 'LOCAL_DRAFT'
const STATUSES = new Set(['DRAFT', 'ACTIVE', 'ARCHIVED'])
const PERIODS = new Set(['RUN', 'DAILY', 'MONTHLY'])
const EVAL_CASE_TYPES = new Set(['NORMAL', 'MISSING_CONTEXT', 'CONFLICT', 'LOW_CONFIDENCE', 'PERMISSION_DENIED'])
const AI_LEVELS = new Set(['L0', 'L1', 'L2', 'L3', 'L4'])
const LEVEL_RANK = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 }
const FEEDBACK_ACTIONS = new Set(['ADOPT', 'REJECT', 'CORRECT', 'NEEDS_REVIEW'])
const FEEDBACK_STATUSES = new Set(['RECORDED', 'PENDING_MANUAL', 'ADOPTED', 'REJECTED', 'CORRECTED'])
const TOOL_CALL_RISKS = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const TOOL_RESULT_STATUSES = new Set(['EXECUTION_RECORDED', 'FAILED', 'CANCELLED'])

function redactSecrets(value) {
  if (typeof value !== 'string') return value
  return value
    .replace(/OPENAI_API_KEY|SESSION_SECRET|DATABASE_URL|passwordHash|apiKey|secret|token/gi, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted-key]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[redacted-phone]')
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
      if (/email|phone|mobile|whatsapp/i.test(key)) return [key, '[redacted-pii]']
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

function jsonArray(value, field, { required = true } = {}) {
  if (value == null) {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 为必填项。`)
    return null
  }
  if (!Array.isArray(value)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 必须是数组。`)
  return value
}

function statusValue(value, field) {
  const status = upperText(value || 'DRAFT', field, { required: true, max: 20 })
  if (!STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', `${field} 仅支持 DRAFT / ACTIVE / ARCHIVED。`)
  return status
}

function levelValue(value) {
  const level = upperText(value || 'L1', 'AI 等级', { required: true, max: 10 })
  if (!AI_LEVELS.has(level)) throw new HttpError(400, 'VALIDATION_ERROR', '第一版禁止 L5 全自动业务决策，仅支持 L0-L4。')
  return level
}

function promptInput(body) {
  return {
    code: upperText(body.code, 'Prompt 编码', { required: true, max: 80 }),
    name: text(body.name, 'Prompt 名称', { required: true, max: 160 }),
    module: upperText(body.module, '模块', { required: true, max: 80 }),
    version: text(body.version || 'v1', 'Prompt 版本', { required: true, max: 40 }),
    status: statusValue(body.status, 'Prompt 状态'),
    level: levelValue(body.level),
    body: text(body.body, 'Prompt 内容', { required: true, max: 8000 }),
    outputSchema: body.outputSchema && typeof body.outputSchema === 'object' && !Array.isArray(body.outputSchema) ? body.outputSchema : null,
    notes: text(body.notes, '备注', { max: 2000 }),
  }
}

function outputSchemaInput(body) {
  const schema = jsonObject(body.schema, '输出 Schema')
  if (schema.type && schema.type !== 'object') throw new HttpError(400, 'VALIDATION_ERROR', '第一版输出 Schema 根节点必须是 object。')
  if (schema.required && !Array.isArray(schema.required)) throw new HttpError(400, 'VALIDATION_ERROR', '输出 Schema required 必须是数组。')
  return {
    code: upperText(body.code, '输出 Schema 编码', { required: true, max: 80 }),
    name: text(body.name, '输出 Schema 名称', { required: true, max: 160 }),
    module: upperText(body.module, '模块', { required: true, max: 80 }),
    version: text(body.version || 'v1', '输出 Schema 版本', { required: true, max: 40 }),
    status: statusValue(body.status, '输出 Schema 状态'),
    schema,
    notes: text(body.notes, '备注', { max: 2000 }),
  }
}

function capabilityInput(body) {
  const level = levelValue(body.level)
  const humanConfirmationSpec = jsonObject(body.humanConfirmationSpec, '人工确认策略')
  if (['L1', 'L2', 'L3', 'L4'].includes(level) && humanConfirmationSpec.required === false) throw new HttpError(400, 'VALIDATION_ERROR', 'L1-L4 能力必须保留人工确认或审核策略。')
  const forbiddenActions = jsonArray(body.forbiddenActions, '禁止动作')
  if (!forbiddenActions.length) throw new HttpError(400, 'VALIDATION_ERROR', '能力契约必须声明至少一个禁止动作。')
  return {
    code: upperText(body.code, '能力编码', { required: true, max: 80 }),
    name: text(body.name, '能力名称', { required: true, max: 160 }),
    module: upperText(body.module, '模块', { required: true, max: 80 }),
    level,
    version: text(body.version || 'v1', '能力版本', { required: true, max: 40 }),
    status: statusValue(body.status, '能力契约状态'),
    scenario: text(body.scenario, '场景', { required: true, max: 1000 }),
    inputSpec: jsonObject(body.inputSpec, '输入说明'),
    permissionSpec: jsonObject(body.permissionSpec, '权限说明'),
    outputSpec: jsonObject(body.outputSpec, '输出说明'),
    validationSpec: jsonObject(body.validationSpec, '校验说明'),
    persistenceSpec: jsonObject(body.persistenceSpec, '落库说明'),
    humanConfirmationSpec,
    forbiddenActions,
    fallbackSpec: jsonObject(body.fallbackSpec, '降级说明'),
    auditSpec: jsonObject(body.auditSpec, '审计说明'),
    evalSpec: jsonObject(body.evalSpec, '评测说明'),
    promptCode: upperText(body.promptCode, 'Prompt 编码', { max: 80 }),
    promptVersion: text(body.promptVersion, 'Prompt 版本', { max: 40 }),
    outputSchemaCode: upperText(body.outputSchemaCode, '输出 Schema 编码', { max: 80 }),
    outputSchemaVersion: text(body.outputSchemaVersion, '输出 Schema 版本', { max: 40 }),
    notes: text(body.notes, '备注', { max: 2000 }),
  }
}

function evalSetInput(body) {
  return {
    code: upperText(body.code, '评测集编码', { required: true, max: 80 }),
    name: text(body.name, '评测集名称', { required: true, max: 160 }),
    module: upperText(body.module, '模块', { required: true, max: 80 }),
    status: statusValue(body.status, '评测集状态'),
    promptCode: upperText(body.promptCode, 'Prompt 编码', { max: 80 }),
    promptVersion: text(body.promptVersion, 'Prompt 版本', { max: 40 }),
    capabilityCode: upperText(body.capabilityCode, '能力编码', { max: 80 }),
    capabilityVersion: text(body.capabilityVersion, '能力版本', { max: 40 }),
    notes: text(body.notes, '备注', { max: 2000 }),
  }
}

function evalCaseInput(body) {
  const type = upperText(body.type || 'NORMAL', '评测类型', { required: true, max: 40 })
  if (!EVAL_CASE_TYPES.has(type)) throw new HttpError(400, 'VALIDATION_ERROR', '评测类型不支持。')
  const minConfidence = body.minConfidence == null ? null : Number(body.minConfidence)
  if (minConfidence != null && (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1)) throw new HttpError(400, 'VALIDATION_ERROR', 'minConfidence 必须在 0 到 1 之间。')
  return {
    name: text(body.name, '评测用例名称', { required: true, max: 160 }),
    type,
    input: jsonObject(body.input, '评测输入'),
    expected: jsonObject(body.expected, '期望输出'),
    expectedStatus: text(body.expectedStatus, '期望状态', { max: 80 }),
    minConfidence,
  }
}

function policyInput(body) {
  const maxLevel = levelValue(body.maxLevel || 'L3')
  return {
    code: upperText(body.code, '策略编码', { required: true, max: 80 }),
    name: text(body.name, '策略名称', { required: true, max: 160 }),
    module: upperText(body.module, '模块', { required: true, max: 80 }),
    status: statusValue(body.status, '策略状态'),
    maxLevel,
    allowCloud: body.allowCloud === true,
    allowedProviders: body.allowedProviders == null ? null : jsonArray(body.allowedProviders, '允许供应商'),
    allowedModels: body.allowedModels == null ? null : jsonArray(body.allowedModels, '允许模型'),
    blockedActions: jsonArray(body.blockedActions || [], '禁止动作'),
    requireHumanConfirmation: body.requireHumanConfirmation !== false,
    dataScopePolicy: body.dataScopePolicy == null ? null : jsonObject(body.dataScopePolicy, '数据范围策略'),
    notes: text(body.notes, '备注', { max: 2000 }),
  }
}

function costLimitInput(body) {
  const period = upperText(body.period || 'MONTHLY', '限额周期', { required: true, max: 20 })
  if (!PERIODS.has(period)) throw new HttpError(400, 'VALIDATION_ERROR', '限额周期仅支持 RUN / DAILY / MONTHLY。')
  const maxTokens = Number(body.maxTokens ?? 0)
  const maxCost = Number(body.maxCost ?? 0)
  if (!Number.isInteger(maxTokens) || maxTokens < 0) throw new HttpError(400, 'VALIDATION_ERROR', 'maxTokens 必须是非负整数。')
  if (!Number.isFinite(maxCost) || maxCost < 0) throw new HttpError(400, 'VALIDATION_ERROR', 'maxCost 必须是非负数。')
  return {
    code: upperText(body.code, '限额编码', { required: true, max: 80 }),
    name: text(body.name, '限额名称', { required: true, max: 160 }),
    module: upperText(body.module, '模块', { required: true, max: 80 }),
    status: statusValue(body.status, '限额状态'),
    period,
    provider: upperText(body.provider, '供应商', { max: 40 }),
    model: text(body.model, '模型', { max: 120 }),
    maxTokens,
    maxCost: String(maxCost),
    currency: upperText(body.currency || 'USD', '币种', { required: true, max: 10 }),
    hardBlock: body.hardBlock !== false,
    notes: text(body.notes, '备注', { max: 2000 }),
  }
}

function feedbackInput(body) {
  const action = upperText(body.action, '人工确认动作', { required: true, max: 40 })
  if (!FEEDBACK_ACTIONS.has(action)) throw new HttpError(400, 'VALIDATION_ERROR', '人工确认动作仅支持 ADOPT / REJECT / CORRECT / NEEDS_REVIEW。')
  const status = upperText(body.status || (action === 'NEEDS_REVIEW' ? 'PENDING_MANUAL' : `${action}ED`), '确认状态', { required: true, max: 40 })
  if (!FEEDBACK_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '人工确认状态不支持。')
  if (body.confirmedHumanReview !== true) throw new HttpError(400, 'HUMAN_REVIEW_REQUIRED', 'AI 输出必须经过人工确认后才能记录采纳、驳回或纠错。')
  if (body.createsFormalWrite === true) throw new HttpError(400, 'FORMAL_WRITE_NOT_SUPPORTED', '第一版 AI 人工确认只记录草稿确认结果，不直接写入正式业务表。')
  const correctedOutput = body.correctedOutput == null ? null : jsonObject(body.correctedOutput, '人工修订输出')
  if (action === 'CORRECT' && !correctedOutput) throw new HttpError(400, 'VALIDATION_ERROR', '纠错记录必须提供 correctedOutput。')
  if (action === 'REJECT' && !text(body.note, '驳回原因', { max: 2000 })) throw new HttpError(400, 'VALIDATION_ERROR', '驳回 AI 输出必须填写原因。')
  return {
    action,
    status: action === 'ADOPT' ? 'ADOPTED' : action === 'REJECT' ? 'REJECTED' : action === 'CORRECT' ? 'CORRECTED' : status,
    note: text(body.note, '备注', { max: 2000 }),
    correctedOutput,
    adoptionTarget: upperText(body.adoptionTarget, '采纳目标', { max: 80 }),
    adoptionTargetId: text(body.adoptionTargetId, '采纳目标 ID', { max: 120 }),
    createsFormalWrite: false,
    confirmedHumanReview: true,
  }
}

function assertToolCallWrite(actor) {
  if (!new Set(['SALES', 'MANAGER', 'ADMIN']).has(actor.role)) throw new HttpError(403, 'FORBIDDEN', '当前角色无权创建或确认外部工具调用。')
}

function toolCallScopeFor(actor) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC' || actor.role === 'FINANCE') return {}
  if (actor.role === 'MANAGER' && actor.teamId) return { OR: [{ createdById: actor.id }, { createdBy: { teamId: actor.teamId } }] }
  return { createdById: actor.id }
}

function assertToolCallScope(actor, row) {
  if (actor.role === 'ADMIN' || actor.role === 'EXEC' || actor.role === 'FINANCE') return
  if (row.createdById === actor.id) return
  if (actor.role === 'MANAGER' && actor.teamId && row.createdBy?.teamId === actor.teamId) return
  throw new HttpError(403, 'FORBIDDEN', '无权访问该工具调用记录。')
}

function assertToolCallConfirmScope(actor, row) {
  assertToolCallScope(actor, row)
  assertToolCallWrite(actor)
  if (actor.role === 'ADMIN' || row.createdById === actor.id) return
  if (actor.role === 'MANAGER' && actor.teamId && row.createdBy?.teamId === actor.teamId) return
  throw new HttpError(403, 'FORBIDDEN', '无权确认该工具调用。')
}

function toolCallInput(body) {
  if (body.executeNow === true || body.autoExecute === true) throw new HttpError(400, 'TOOL_EXECUTION_NOT_SUPPORTED', '第一版只登记外部动作草稿，不直接调用外部工具。')
  if (body.requiresHumanConfirmation === false) throw new HttpError(400, 'HUMAN_CONFIRMATION_REQUIRED', '外部工具调用必须保留人工确认。')
  const riskLevel = upperText(body.riskLevel || 'MEDIUM', '风险等级', { required: true, max: 20 })
  if (!TOOL_CALL_RISKS.has(riskLevel)) throw new HttpError(400, 'VALIDATION_ERROR', '风险等级仅支持 LOW / MEDIUM / HIGH / CRITICAL。')
  return {
    aiTaskId: text(body.aiTaskId, 'AI 任务 ID', { max: 120 }),
    module: upperText(body.module, '模块', { required: true, max: 80 }),
    toolName: upperText(body.toolName, '工具名称', { required: true, max: 80 }),
    action: upperText(body.action, '工具动作', { required: true, max: 80 }),
    riskLevel,
    inputSummary: safeSummary(jsonObject(body.inputSummary || body.input || {}, '输入摘要')),
    requiresHumanConfirmation: true,
    status: 'PENDING_CONFIRMATION',
  }
}

function toolResultInput(body) {
  if (body.confirmedHumanExecution !== true) throw new HttpError(400, 'HUMAN_EXECUTION_REQUIRED', '执行结果必须由人工确认后记录。')
  const status = upperText(body.status || 'EXECUTION_RECORDED', '执行状态', { required: true, max: 40 })
  if (!TOOL_RESULT_STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', '执行状态仅支持 EXECUTION_RECORDED / FAILED / CANCELLED。')
  const executionResult = body.executionResult == null ? null : safeSummary(jsonObject(body.executionResult, '执行结果'))
  if (status === 'EXECUTION_RECORDED' && !executionResult) throw new HttpError(400, 'VALIDATION_ERROR', '成功执行记录必须提供 executionResult。')
  if (['FAILED', 'CANCELLED'].includes(status) && !text(body.errorMessage || body.note, '失败或取消原因', { max: 2000 })) throw new HttpError(400, 'VALIDATION_ERROR', '失败或取消必须填写原因。')
  return {
    status,
    executionResult,
    errorCode: upperText(body.errorCode, '错误编码', { max: 80 }),
    errorMessage: text(body.errorMessage || body.note, '失败或取消原因', { max: 2000 }),
    externalRequestId: text(body.externalRequestId, '外部请求 ID', { max: 160 }),
    executedAt: new Date(),
  }
}

async function activePrompt(db, code) {
  if (!code) return null
  const rows = await db.promptTemplate.findMany({ where: { code, status: 'ACTIVE' }, orderBy: { updatedAt: 'desc' }, take: 1 })
  return rows[0] || null
}

async function activeCapability(db, code) {
  if (!code) return null
  const rows = await db.aiCapabilityContract.findMany({ where: { code, status: 'ACTIVE' }, orderBy: { updatedAt: 'desc' }, take: 1 })
  return rows[0] || null
}

async function outputSchemaByCode(db, code, version) {
  if (!code) return null
  const rows = await db.aiOutputSchema.findMany({ where: { code, ...(version ? { version } : { status: 'ACTIVE' }) }, orderBy: { updatedAt: 'desc' }, take: 1 })
  return rows[0] || null
}

function validateOutput(schemaRow, output) {
  if (!schemaRow) return []
  const schema = schemaRow.schema || {}
  const errors = []
  if (schema.type === 'object' && (typeof output !== 'object' || output == null || Array.isArray(output))) errors.push('输出必须是对象。')
  for (const key of schema.required || []) {
    if (output?.[key] == null) errors.push(`缺少必填字段 ${key}。`)
  }
  for (const [key, rule] of Object.entries(schema.properties || {})) {
    if (output?.[key] == null || !rule?.type) continue
    if (rule.type === 'array' && !Array.isArray(output[key])) errors.push(`${key} 必须是数组。`)
    else if (rule.type === 'object' && (typeof output[key] !== 'object' || Array.isArray(output[key]))) errors.push(`${key} 必须是对象。`)
    else if (!['array', 'object'].includes(rule.type) && typeof output[key] !== rule.type) errors.push(`${key} 类型必须是 ${rule.type}。`)
  }
  return errors
}

function estimatedTokens(inputSummary) {
  return Math.ceil(JSON.stringify(inputSummary || {}).length / 4)
}

function providerAllowed(list, value) {
  if (!Array.isArray(list) || !list.length) return true
  return list.map((item) => String(item).toUpperCase()).includes(String(value || '').toUpperCase())
}

async function evaluateGovernance({ db, module, level, action, provider, model, wantsCloud, inputSummary, confirmedAutonomous }) {
  const [policies, limits] = await db.$transaction([
    db.aiPolicyRule.findMany({ where: { module, status: 'ACTIVE' }, orderBy: { updatedAt: 'desc' }, take: 20 }),
    db.aiCostLimit.findMany({ where: { module, status: 'ACTIVE' }, orderBy: { updatedAt: 'desc' }, take: 20 }),
  ])
  const estimatedInputTokens = estimatedTokens(inputSummary)
  for (const policy of policies) {
    if (LEVEL_RANK[level] > LEVEL_RANK[policy.maxLevel]) return { ok: false, code: 'AI_POLICY_BLOCKED', message: `AI 等级 ${level} 超出模块策略允许的 ${policy.maxLevel}。`, estimatedInputTokens, policyCode: policy.code }
    const blocked = Array.isArray(policy.blockedActions) ? policy.blockedActions.map((item) => String(item).toUpperCase()) : []
    if (action && blocked.includes(action)) return { ok: false, code: 'AI_POLICY_BLOCKED', message: '当前 AI 动作被模块策略禁止。', estimatedInputTokens, policyCode: policy.code }
    if (policy.requireHumanConfirmation && confirmedAutonomous === true) return { ok: false, code: 'AI_POLICY_BLOCKED', message: '当前模块策略要求人工确认，禁止自动执行。', estimatedInputTokens, policyCode: policy.code }
    if (wantsCloud && !policy.allowCloud) return { ok: false, code: 'AI_POLICY_BLOCKED', message: '当前模块策略未允许云端 AI。', estimatedInputTokens, policyCode: policy.code }
    if (wantsCloud && !providerAllowed(policy.allowedProviders, provider)) return { ok: false, code: 'AI_PROVIDER_NOT_ALLOWED', message: '当前供应商不在模块策略白名单内。', estimatedInputTokens, policyCode: policy.code }
    if (wantsCloud && !providerAllowed(policy.allowedModels, model)) return { ok: false, code: 'AI_MODEL_NOT_ALLOWED', message: '当前模型不在模块策略白名单内。', estimatedInputTokens, policyCode: policy.code }
  }
  for (const limit of limits) {
    if (limit.provider && String(limit.provider).toUpperCase() !== String(provider || '').toUpperCase()) continue
    if (limit.model && limit.model !== model) continue
    if (limit.maxTokens > 0 && estimatedInputTokens > limit.maxTokens && limit.hardBlock) return { ok: false, code: 'AI_COST_LIMIT_EXCEEDED', message: '本次 AI 输入预估 token 超过模块限额。', estimatedInputTokens, costLimitCode: limit.code }
    const estimatedCost = 0
    if (Number(limit.maxCost) > 0 && estimatedCost > Number(limit.maxCost) && limit.hardBlock) return { ok: false, code: 'AI_COST_LIMIT_EXCEEDED', message: '本次 AI 预估费用超过模块限额。', estimatedInputTokens, costLimitCode: limit.code }
  }
  return { ok: true, estimatedInputTokens, policyCount: policies.length, costLimitCount: limits.length }
}

function compactOutputSchema(row) {
  if (!row) return row
  const { schema, ...summary } = row
  return { ...summary, schemaFields: Object.keys(schema?.properties || {}), requiredFields: schema?.required || [] }
}

function compactCapability(row) {
  if (!row) return row
  const { inputSpec, permissionSpec, outputSpec, validationSpec, persistenceSpec, humanConfirmationSpec, forbiddenActions, fallbackSpec, auditSpec, evalSpec, ...summary } = row
  return {
    ...summary,
    specSummary: {
      inputKeys: Object.keys(inputSpec || {}),
      permissionKeys: Object.keys(permissionSpec || {}),
      outputKeys: Object.keys(outputSpec || {}),
      requiredHumanConfirmation: humanConfirmationSpec?.required !== false,
      forbiddenActionCount: Array.isArray(forbiddenActions) ? forbiddenActions.length : 0,
      evalKeys: Object.keys(evalSpec || {}),
    },
  }
}

function compactPolicy(row) {
  if (!row) return row
  const { allowedProviders, allowedModels, blockedActions, dataScopePolicy, ...summary } = row
  return {
    ...summary,
    policySummary: {
      allowedProviderCount: Array.isArray(allowedProviders) ? allowedProviders.length : 0,
      allowedModelCount: Array.isArray(allowedModels) ? allowedModels.length : 0,
      blockedActionCount: Array.isArray(blockedActions) ? blockedActions.length : 0,
      hasDataScopePolicy: Boolean(dataScopePolicy),
    },
  }
}

function compactCostLimit(row) {
  if (!row) return row
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    module: row.module,
    status: row.status,
    period: row.period,
    provider: row.provider,
    model: row.model,
    maxTokens: row.maxTokens,
    maxCost: row.maxCost,
    currency: row.currency,
    hardBlock: row.hardBlock,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function compactFeedback(row) {
  if (!row) return row
  return {
    id: row.id,
    aiTaskId: row.aiTaskId,
    action: row.action,
    status: row.status,
    note: row.note,
    hasCorrectedOutput: Boolean(row.correctedOutput),
    adoptionTarget: row.adoptionTarget,
    adoptionTargetId: row.adoptionTargetId,
    createsFormalWrite: row.createsFormalWrite,
    confirmedHumanReview: row.confirmedHumanReview,
    createdById: row.createdById,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  }
}

function compactCitation(row) {
  if (!row) return row
  return {
    id: row.id,
    aiTaskId: row.aiTaskId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    knowledgeDocumentId: row.knowledgeDocumentId,
    knowledgeChunkId: row.knowledgeChunkId,
    title: row.title,
    sourceName: row.sourceName,
    version: row.version,
    locator: row.locator,
    confidence: row.confidence,
    createdAt: row.createdAt,
  }
}

function compactToolCall(row) {
  if (!row) return row
  return {
    id: row.id,
    aiTaskId: row.aiTaskId,
    module: row.module,
    toolName: row.toolName,
    action: row.action,
    status: row.status,
    riskLevel: row.riskLevel,
    requiresHumanConfirmation: row.requiresHumanConfirmation,
    confirmedById: row.confirmedById,
    confirmedAt: row.confirmedAt,
    executedAt: row.executedAt,
    createdById: row.createdById,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function assertActiveReferences(db, data) {
  if (data.status !== 'ACTIVE') return
  if (!data.promptCode) throw new HttpError(400, 'VALIDATION_ERROR', 'ACTIVE 能力契约必须绑定 Prompt 模板。')
  if (!data.outputSchemaCode) throw new HttpError(400, 'VALIDATION_ERROR', 'ACTIVE 能力契约必须绑定输出 Schema。')
  const prompt = await activePrompt(db, data.promptCode)
  if (!prompt || (data.promptVersion && prompt.version !== data.promptVersion)) throw new HttpError(400, 'PROMPT_NOT_ACTIVE', '能力契约绑定的 Prompt 模板必须是 ACTIVE。')
  const schema = await outputSchemaByCode(db, data.outputSchemaCode, data.outputSchemaVersion)
  if (!schema || schema.status !== 'ACTIVE') throw new HttpError(400, 'OUTPUT_SCHEMA_NOT_ACTIVE', '能力契约绑定的输出 Schema 必须是 ACTIVE。')
}

function gatewayStatus() {
  const enabled = process.env.AI_ENABLED === 'true'
  return {
    enabled,
    provider: enabled ? process.env.AI_PROVIDER || null : null,
    defaultModel: enabled ? process.env.AI_DEFAULT_MODEL || null : null,
    localDraft: true,
    secretsExposed: false,
    cloudReady: Boolean(enabled && process.env.AI_PROVIDER && process.env.AI_DEFAULT_MODEL),
    policy: {
      unifiedGateway: true,
      frontendReceivesPlaintextKey: false,
      cloudFailureStatus: 502,
      emptySuccessForbidden: true,
      humanConfirmationRequired: true,
      capabilityContractRequiredBeforeProduction: true,
      outputSchemaValidation: true,
      modulePolicyRules: true,
      costLimits: true,
      asyncQueue: true,
      sseStatusStream: true,
    },
    queue: aiQueueStatus(),
  }
}

function localDraftOutput({ module, purpose, inputSummary, prompt, capability }) {
  const source = prompt ? `${prompt.code}@${prompt.version}` : 'NO_PROMPT_TEMPLATE'
  return {
    type: 'DRAFT_REQUIRES_HUMAN_CONFIRMATION',
    title: `${module} / ${purpose} 本地草稿`,
    draft: `【本地草稿，需人工确认】已根据输入摘要生成待编辑内容。Prompt=${source}${capability ? `，Capability=${capability.code}@${capability.version}` : ''}。请业务员复核事实、价格、交期、认证和对外措辞后再发送或写入正式业务表。`,
    inputPreview: inputSummary,
    limitations: [
      '未调用外部模型、MCP、OCR、向量库或云端服务。',
      '不得作为最终售价、交期、认证、报关或税务承诺。',
      '对外发送、发布、正式单证和价格变更必须人工确认。',
    ],
  }
}

async function createAudit(db, actor, action, resource, resourceId, detail) {
  await db.auditLog.create({ data: { userId: actor.id, action, resource, resourceId, detail } })
}

async function createTask(db, actor, data) {
  const row = await db.aiTask.create({ data: { createdById: actor.id, ...data } })
  await createAudit(db, actor, 'AI_GATEWAY_RUN', 'ai_task', row.id, { module: data.module, purpose: data.purpose, status: data.status, provider: data.provider, capabilityCode: data.capabilityCode, dataSentToCloud: data.dataSentToCloud })
  return row
}

async function updateAiTask(db, taskId, data) {
  return db.aiTask.update({ where: { id: taskId }, data })
}

async function runQueuedLocalDraft({ db, taskId, queueBackend }) {
  const startedAt = Date.now()
  let task = await db.aiTask.findUnique({ where: { id: taskId }, include: { createdBy: { select: { id: true, name: true, teamId: true } } } })
  if (!task) return
  if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(task.status)) return
  task = await updateAiTask(db, taskId, { status: 'RUNNING', durationMs: 0 })
  appendAiTaskEvent(taskId, { type: 'status', status: 'RUNNING', stage: 'policy_checked_running_local_draft', tokens: task.tokens, cost: task.cost, durationMs: 0, dataSentToCloud: false, queueBackend, summary: { module: task.module, purpose: task.purpose } })
  await new Promise((resolve) => setTimeout(resolve, 25))
  const latest = await db.aiTask.findUnique({ where: { id: taskId }, include: { createdBy: { select: { id: true, name: true, teamId: true } } } })
  if (!latest || latest.status === 'CANCELLED') {
    appendAiTaskEvent(taskId, { type: 'terminal', status: 'CANCELLED', stage: 'cancelled_before_execution', dataSentToCloud: false, queueBackend })
    return
  }
  const prompt = latest.promptCode ? { code: latest.promptCode, version: latest.promptVersion || 'unknown' } : null
  const capability = latest.capabilityCode ? { code: latest.capabilityCode, version: latest.capabilityVersion || 'unknown' } : null
  const schema = await outputSchemaByCode(db, latest.outputSchemaCode, latest.outputSchemaVersion)
  const output = localDraftOutput({ module: latest.module, purpose: latest.purpose, inputSummary: latest.inputSummary, prompt, capability })
  const schemaErrors = validateOutput(schema, output)
  const durationMs = Date.now() - startedAt
  if (schemaErrors.length) {
    const failed = await updateAiTask(db, taskId, { status: 'FAILED', output, errorCode: 'AI_OUTPUT_SCHEMA_FAILED', errorMessage: 'AI 输出不符合能力契约绑定的 Schema。', dataSentToCloud: false, durationMs })
    appendAiTaskEvent(taskId, { type: 'terminal', status: 'FAILED', stage: 'schema_validation_failed', tokens: failed.tokens, cost: failed.cost, durationMs, dataSentToCloud: false, queueBackend, errorCode: 'AI_OUTPUT_SCHEMA_FAILED', summary: { errors: schemaErrors } })
    await createAudit(db, { id: latest.createdById }, 'AI_QUEUE_COMPLETE', 'ai_task', taskId, { status: 'FAILED', dataSentToCloud: false, queueBackend })
    return
  }
  const completed = await updateAiTask(db, taskId, { status: 'SUCCEEDED', output, errorCode: null, errorMessage: null, dataSentToCloud: false, durationMs })
  appendAiTaskEvent(taskId, { type: 'terminal', status: 'SUCCEEDED', stage: 'completed_local_draft_requires_human_confirmation', tokens: completed.tokens, cost: completed.cost, durationMs, dataSentToCloud: false, queueBackend, summary: { requiresHumanConfirmation: true, outputType: output.type } })
  await createAudit(db, { id: latest.createdById }, 'AI_QUEUE_COMPLETE', 'ai_task', taskId, { status: 'SUCCEEDED', dataSentToCloud: false, queueBackend, requiresHumanConfirmation: true })
}

export async function handleAiGatewayRoute({ req, res, url, pathname, actor, db }) {
  if (req.method === 'GET' && pathname === '/api/ai-gateway/status') {
    assertAiGatewayAccess(actor)
    return send(res, 200, { data: gatewayStatus() })
  }

  if (req.method === 'GET' && pathname === '/api/ai-queue/status') {
    assertAiGatewayAccess(actor)
    return send(res, 200, { data: aiQueueStatus() })
  }

  if (req.method === 'GET' && pathname === '/api/prompt-templates') {
    assertAiGatewayAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const module = url.searchParams.get('module')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    if (status && !STATUSES.has(status)) throw new HttpError(400, 'VALIDATION_ERROR', 'Prompt 状态不支持。')
    const where = { ...(module ? { module } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([db.promptTemplate.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.promptTemplate.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/prompt-templates') {
    assertAiGatewayAccess(actor, 'prompt-write')
    const data = promptInput(await readJson(req))
    const row = await db.promptTemplate.create({ data: { ...data, createdById: actor.id } })
    await createAudit(db, actor, 'CREATE', 'prompt_template', row.id, { code: row.code, version: row.version, status: row.status, module: row.module })
    return send(res, 201, { data: row })
  }

  const promptMatch = pathname.match(/^\/api\/prompt-templates\/([^/]+)$/)
  if (promptMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const row = await db.promptTemplate.findUnique({ where: { id: promptMatch[1] } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Prompt 模板不存在。')
    return send(res, 200, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/ai-output-schemas') {
    assertAiGatewayAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const module = url.searchParams.get('module')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(module ? { module } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([db.aiOutputSchema.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.aiOutputSchema.count({ where })])
    return send(res, 200, { data: { items: items.map(compactOutputSchema), page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/ai-output-schemas') {
    assertAiGatewayAccess(actor, 'prompt-write')
    const data = outputSchemaInput(await readJson(req))
    const row = await db.aiOutputSchema.create({ data: { ...data, createdById: actor.id } })
    await createAudit(db, actor, 'CREATE', 'ai_output_schema', row.id, { code: row.code, version: row.version, status: row.status, module: row.module })
    return send(res, 201, { data: row })
  }

  const schemaMatch = pathname.match(/^\/api\/ai-output-schemas\/([^/]+)$/)
  if (schemaMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const row = await db.aiOutputSchema.findUnique({ where: { id: schemaMatch[1] } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', '输出 Schema 不存在。')
    return send(res, 200, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/ai-capability-contracts') {
    assertAiGatewayAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const module = url.searchParams.get('module')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(module ? { module } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([db.aiCapabilityContract.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.aiCapabilityContract.count({ where })])
    return send(res, 200, { data: { items: items.map(compactCapability), page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/ai-capability-contracts') {
    assertAiGatewayAccess(actor, 'prompt-write')
    const data = capabilityInput(await readJson(req))
    await assertActiveReferences(db, data)
    const row = await db.aiCapabilityContract.create({ data: { ...data, createdById: actor.id } })
    await createAudit(db, actor, 'CREATE', 'ai_capability_contract', row.id, { code: row.code, version: row.version, status: row.status, module: row.module, level: row.level })
    return send(res, 201, { data: row })
  }

  const capabilityMatch = pathname.match(/^\/api\/ai-capability-contracts\/([^/]+)$/)
  if (capabilityMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const row = await db.aiCapabilityContract.findUnique({ where: { id: capabilityMatch[1] } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'AI 能力契约不存在。')
    return send(res, 200, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/prompt-eval-sets') {
    assertAiGatewayAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const module = url.searchParams.get('module')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(module ? { module } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([db.promptEvalSet.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize, include: { _count: { select: { cases: true } } } }), db.promptEvalSet.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/prompt-eval-sets') {
    assertAiGatewayAccess(actor, 'prompt-write')
    const data = evalSetInput(await readJson(req))
    if (!data.promptCode && !data.capabilityCode) throw new HttpError(400, 'VALIDATION_ERROR', '评测集必须绑定 Prompt 或能力契约。')
    const row = await db.promptEvalSet.create({ data: { ...data, createdById: actor.id } })
    await createAudit(db, actor, 'CREATE', 'prompt_eval_set', row.id, { code: row.code, status: row.status, module: row.module, capabilityCode: row.capabilityCode })
    return send(res, 201, { data: row })
  }

  const evalSetMatch = pathname.match(/^\/api\/prompt-eval-sets\/([^/]+)$/)
  if (evalSetMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const row = await db.promptEvalSet.findUnique({ where: { id: evalSetMatch[1] } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Prompt 评测集不存在。')
    const caseCount = await db.promptEvalCase.count({ where: { evalSetId: row.id } })
    return send(res, 200, { data: { ...row, _count: { cases: caseCount } } })
  }

  const evalCasesListMatch = pathname.match(/^\/api\/prompt-eval-sets\/([^/]+)\/cases$/)
  if (evalCasesListMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const evalSet = await db.promptEvalSet.findUnique({ where: { id: evalCasesListMatch[1] } })
    if (!evalSet) throw new HttpError(404, 'NOT_FOUND', 'Prompt 评测集不存在。')
    const { page, pageSize, skip } = listQuery(url)
    const type = url.searchParams.get('type')?.toUpperCase()
    if (type && !EVAL_CASE_TYPES.has(type)) throw new HttpError(400, 'VALIDATION_ERROR', '评测类型不支持。')
    const where = { evalSetId: evalSet.id, ...(type ? { type } : {}) }
    const [items, total] = await db.$transaction([db.promptEvalCase.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), db.promptEvalCase.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  const evalCaseMatch = pathname.match(/^\/api\/prompt-eval-sets\/([^/]+)\/cases$/)
  if (evalCaseMatch && req.method === 'POST') {
    assertAiGatewayAccess(actor, 'prompt-write')
    const evalSet = await db.promptEvalSet.findUnique({ where: { id: evalCaseMatch[1] } })
    if (!evalSet) throw new HttpError(404, 'NOT_FOUND', 'Prompt 评测集不存在。')
    const data = evalCaseInput(await readJson(req))
    const row = await db.promptEvalCase.create({ data: { ...data, evalSetId: evalSet.id } })
    await createAudit(db, actor, 'CREATE', 'prompt_eval_case', row.id, { evalSetId: evalSet.id, type: row.type })
    return send(res, 201, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/ai-policy-rules') {
    assertAiGatewayAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const module = url.searchParams.get('module')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(module ? { module } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([db.aiPolicyRule.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.aiPolicyRule.count({ where })])
    return send(res, 200, { data: { items: items.map(compactPolicy), page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/ai-policy-rules') {
    assertAiGatewayAccess(actor, 'prompt-write')
    const data = policyInput(await readJson(req))
    const row = await db.aiPolicyRule.create({ data: { ...data, createdById: actor.id } })
    await createAudit(db, actor, 'CREATE', 'ai_policy_rule', row.id, { code: row.code, module: row.module, status: row.status, maxLevel: row.maxLevel, allowCloud: row.allowCloud })
    return send(res, 201, { data: row })
  }

  const policyMatch = pathname.match(/^\/api\/ai-policy-rules\/([^/]+)$/)
  if (policyMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const row = await db.aiPolicyRule.findUnique({ where: { id: policyMatch[1] } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'AI 策略不存在。')
    return send(res, 200, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/ai-cost-limits') {
    assertAiGatewayAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const module = url.searchParams.get('module')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...(module ? { module } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([db.aiCostLimit.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: pageSize }), db.aiCostLimit.count({ where })])
    return send(res, 200, { data: { items: items.map(compactCostLimit), page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/ai-cost-limits') {
    assertAiGatewayAccess(actor, 'prompt-write')
    const data = costLimitInput(await readJson(req))
    const row = await db.aiCostLimit.create({ data: { ...data, createdById: actor.id } })
    await createAudit(db, actor, 'CREATE', 'ai_cost_limit', row.id, { code: row.code, module: row.module, status: row.status, period: row.period, maxTokens: row.maxTokens, maxCost: row.maxCost })
    return send(res, 201, { data: row })
  }

  const costLimitMatch = pathname.match(/^\/api\/ai-cost-limits\/([^/]+)$/)
  if (costLimitMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const row = await db.aiCostLimit.findUnique({ where: { id: costLimitMatch[1] } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'AI 成本限额不存在。')
    return send(res, 200, { data: row })
  }

  if (req.method === 'GET' && pathname === '/api/tool-calls') {
    assertAiGatewayAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const module = url.searchParams.get('module')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...toolCallScopeFor(actor), ...(module ? { module } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([
      db.toolCall.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } } } }),
      db.toolCall.count({ where }),
    ])
    return send(res, 200, { data: { items: items.map(compactToolCall), page, pageSize, total } })
  }

  if (req.method === 'POST' && pathname === '/api/tool-calls') {
    assertAiGatewayAccess(actor)
    assertToolCallWrite(actor)
    const data = toolCallInput(await readJson(req))
    let task = null
    if (data.aiTaskId) {
      task = await db.aiTask.findUnique({ where: { id: data.aiTaskId }, include: { createdBy: { select: { id: true, name: true, teamId: true } } } })
      if (!task) throw new HttpError(404, 'NOT_FOUND', '关联 AI 任务不存在。')
      assertAiTaskScope(actor, task)
      if (task.module !== data.module) throw new HttpError(400, 'TOOL_CALL_MODULE_MISMATCH', '工具调用模块必须与关联 AI 任务一致。')
    }
    const row = await db.toolCall.create({ data: { ...data, createdById: actor.id } })
    await createAudit(db, actor, 'CREATE', 'tool_call', row.id, { aiTaskId: row.aiTaskId, module: row.module, toolName: row.toolName, action: row.action, status: row.status, riskLevel: row.riskLevel })
    return send(res, 201, { data: row })
  }

  const toolCallConfirmMatch = pathname.match(/^\/api\/tool-calls\/([^/]+)\/confirm$/)
  if (toolCallConfirmMatch && req.method === 'POST') {
    assertAiGatewayAccess(actor)
    const row = await db.toolCall.findUnique({ where: { id: toolCallConfirmMatch[1] }, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } } } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', '工具调用记录不存在。')
    assertToolCallConfirmScope(actor, row)
    const body = await readJson(req)
    if (body.confirmedHumanReview !== true) throw new HttpError(400, 'HUMAN_CONFIRMATION_REQUIRED', '外部工具调用必须人工确认。')
    if (row.status !== 'PENDING_CONFIRMATION') throw new HttpError(400, 'INVALID_TOOL_CALL_STATUS', '只有待确认工具调用可以确认。')
    const confirmed = await db.toolCall.update({ where: { id: row.id }, data: { status: 'CONFIRMED', confirmedById: actor.id, confirmedAt: new Date() } })
    await createAudit(db, actor, 'CONFIRM', 'tool_call', row.id, { module: row.module, toolName: row.toolName, action: row.action, riskLevel: row.riskLevel })
    return send(res, 200, { data: confirmed })
  }

  const toolCallResultMatch = pathname.match(/^\/api\/tool-calls\/([^/]+)\/result$/)
  if (toolCallResultMatch && req.method === 'POST') {
    assertAiGatewayAccess(actor)
    const row = await db.toolCall.findUnique({ where: { id: toolCallResultMatch[1] }, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } } } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', '工具调用记录不存在。')
    assertToolCallConfirmScope(actor, row)
    if (row.status !== 'CONFIRMED') throw new HttpError(400, 'TOOL_CALL_NOT_CONFIRMED', '工具调用必须先人工确认，再记录执行结果。')
    const data = toolResultInput(await readJson(req))
    const updated = await db.toolCall.update({ where: { id: row.id }, data })
    await createAudit(db, actor, 'RECORD_RESULT', 'tool_call', row.id, { status: updated.status, externalRequestId: updated.externalRequestId, errorCode: updated.errorCode })
    return send(res, 200, { data: updated })
  }

  const toolCallMatch = pathname.match(/^\/api\/tool-calls\/([^/]+)$/)
  if (toolCallMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const row = await db.toolCall.findUnique({ where: { id: toolCallMatch[1] }, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } }, confirmedBy: { select: { id: true, name: true, role: true, teamId: true } }, aiTask: { include: { createdBy: { select: { id: true, name: true, teamId: true } } } } } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', '工具调用记录不存在。')
    assertToolCallScope(actor, row)
    return send(res, 200, { data: row })
  }

  if (req.method === 'POST' && pathname === '/api/ai-gateway/run') {
    assertAiGatewayAccess(actor)
    const startedAt = Date.now()
    const body = await readJson(req)
    const capabilityCode = upperText(body.capabilityCode, '能力编码', { max: 80 })
    const capability = await activeCapability(db, capabilityCode)
    if (capabilityCode && !capability) throw new HttpError(404, 'CAPABILITY_NOT_FOUND', '未找到 ACTIVE 状态的 AI 能力契约。')
    const module = upperText(body.module || capability?.module, '模块', { required: true, max: 80 })
    const purpose = text(body.purpose || capability?.name, '用途', { required: true, max: 160 })
    const level = levelValue(body.level || capability?.level || 'L1')
    if (capability && capability.module !== module) throw new HttpError(400, 'CAPABILITY_MODULE_MISMATCH', '请求模块与能力契约模块不一致。')
    if (capability && capability.level !== level) throw new HttpError(400, 'CAPABILITY_LEVEL_MISMATCH', '请求 AI 等级与能力契约不一致。')
    const promptCode = upperText(body.promptCode || capability?.promptCode, 'Prompt 编码', { max: 80 })
    const prompt = await activePrompt(db, promptCode)
    if (promptCode && !prompt) throw new HttpError(404, 'PROMPT_NOT_FOUND', '未找到 ACTIVE 状态的 Prompt 模板。')
    const schema = await outputSchemaByCode(db, capability?.outputSchemaCode, capability?.outputSchemaVersion)
    const inputSummary = safeSummary(body.input || {})
    const requestedProvider = upperText(body.provider || body.mode || LOCAL_PROVIDER, 'AI 提供方', { max: 40 }) || LOCAL_PROVIDER
    const wantsCloud = requestedProvider !== LOCAL_PROVIDER && requestedProvider !== 'DRY_RUN'
    const action = upperText(body.action, 'AI 动作', { max: 80 })
    const model = text(body.model, '模型', { max: 120 }) || prompt?.model || gatewayStatus().defaultModel
    const governance = await evaluateGovernance({ db, module, level, action, provider: requestedProvider, model, wantsCloud, inputSummary, confirmedAutonomous: body.confirmedAutonomous })
    if (!governance.ok) {
      const task = await createTask(db, actor, {
        module, purpose, level, status: 'FAILED', provider: requestedProvider, model,
        promptCode: prompt?.code || promptCode, promptVersion: prompt?.version || null,
        capabilityCode: capability?.code || capabilityCode, capabilityVersion: capability?.version || null,
        outputSchemaCode: schema?.code || null, outputSchemaVersion: schema?.version || null,
        inputSummary, output: null, errorCode: governance.code, errorMessage: governance.message,
        tokens: governance.estimatedInputTokens || 0, cost: '0', dataSentToCloud: false, durationMs: Date.now() - startedAt,
      })
      throw new HttpError(403, governance.code, governance.message, { aiTaskId: task.id, dataSentToCloud: false, policyCode: governance.policyCode, costLimitCode: governance.costLimitCode, estimatedInputTokens: governance.estimatedInputTokens })
    }

    if (body.async === true) {
      const queue = aiQueueStatus()
      if (!queue.enabled) throw new HttpError(503, 'AI_QUEUE_NOT_CONFIGURED', 'AI 异步队列未配置；生产必须配置 Redis + BullMQ。', queue)
      if (wantsCloud) {
        const failed = await createTask(db, actor, {
          module, purpose, level, status: 'FAILED', provider: requestedProvider, model,
          promptCode: prompt?.code || promptCode, promptVersion: prompt?.version || null,
          capabilityCode: capability?.code || capabilityCode, capabilityVersion: capability?.version || null,
          outputSchemaCode: schema?.code || null, outputSchemaVersion: schema?.version || null,
          inputSummary, output: null, errorCode: 'AI_GATEWAY_NOT_CONFIGURED', errorMessage: '云端 AI 未配置或未授权，本次未发送任何数据。',
          tokens: governance.estimatedInputTokens || 0, cost: '0', dataSentToCloud: false, durationMs: Date.now() - startedAt,
        })
        appendAiTaskEvent(failed.id, { type: 'terminal', status: 'FAILED', stage: 'cloud_not_configured_no_data_sent', tokens: failed.tokens, cost: failed.cost, durationMs: failed.durationMs, dataSentToCloud: false, queueBackend: queue.backend, errorCode: 'AI_GATEWAY_NOT_CONFIGURED' })
        throw new HttpError(502, 'AI_GATEWAY_NOT_CONFIGURED', '云端 AI 未配置或未授权，本次未发送任何数据。', { aiTaskId: failed.id, dataSentToCloud: false, queue })
      }
      const task = await createTask(db, actor, {
        module, purpose, level, status: 'QUEUED', provider: LOCAL_PROVIDER, model: 'deterministic-local-draft',
        promptCode: prompt?.code || promptCode, promptVersion: prompt?.version || null,
        capabilityCode: capability?.code || capabilityCode, capabilityVersion: capability?.version || null,
        outputSchemaCode: schema?.code || null, outputSchemaVersion: schema?.version || null,
        inputSummary, output: null, errorCode: null, errorMessage: null,
        tokens: governance.estimatedInputTokens || 0, cost: '0', dataSentToCloud: false, durationMs: 0,
      })
      const enqueue = await enqueueAiTaskJob({ taskId: task.id }, (job) => runQueuedLocalDraft({ db, taskId: job.taskId, queueBackend: job.queueBackend || queue.backend }))
      return send(res, 202, { data: { task, queue: enqueue, eventsUrl: `/api/ai-tasks/${task.id}/events`, requiresHumanConfirmation: true } })
    }

    if (wantsCloud) {
      const status = gatewayStatus()
      const durationMs = Date.now() - startedAt
      const task = await createTask(db, actor, {
        module, purpose, level, status: 'FAILED', provider: requestedProvider, model: status.defaultModel,
        promptCode: prompt?.code || promptCode, promptVersion: prompt?.version || null,
        capabilityCode: capability?.code || capabilityCode, capabilityVersion: capability?.version || null,
        outputSchemaCode: schema?.code || null, outputSchemaVersion: schema?.version || null,
        inputSummary, output: null, errorCode: 'AI_GATEWAY_NOT_CONFIGURED', errorMessage: '云端 AI 未配置或未授权，本次未发送任何数据。',
        tokens: 0, cost: '0', dataSentToCloud: false, durationMs,
      })
      throw new HttpError(502, 'AI_GATEWAY_NOT_CONFIGURED', '云端 AI 未配置或未授权，本次未发送任何数据。', { aiTaskId: task.id, dataSentToCloud: false })
    }

    const output = localDraftOutput({ module, purpose, inputSummary, prompt, capability })
    const schemaErrors = validateOutput(schema, output)
    if (schemaErrors.length) {
      const task = await createTask(db, actor, {
        module, purpose, level, status: 'FAILED', provider: LOCAL_PROVIDER, model: 'deterministic-local-draft',
        promptCode: prompt?.code || promptCode, promptVersion: prompt?.version || null,
        capabilityCode: capability?.code || capabilityCode, capabilityVersion: capability?.version || null,
        outputSchemaCode: schema?.code || null, outputSchemaVersion: schema?.version || null,
        inputSummary, output, errorCode: 'AI_OUTPUT_SCHEMA_FAILED', errorMessage: 'AI 输出不符合能力契约绑定的 Schema。',
        tokens: 0, cost: '0', dataSentToCloud: false, durationMs: Date.now() - startedAt,
      })
      throw new HttpError(502, 'AI_OUTPUT_SCHEMA_FAILED', 'AI 输出不符合能力契约绑定的 Schema。', { aiTaskId: task.id, errors: schemaErrors })
    }
    const task = await createTask(db, actor, {
      module, purpose, level, status: 'SUCCEEDED', provider: LOCAL_PROVIDER, model: 'deterministic-local-draft',
      promptCode: prompt?.code || promptCode, promptVersion: prompt?.version || null,
      capabilityCode: capability?.code || capabilityCode, capabilityVersion: capability?.version || null,
      outputSchemaCode: schema?.code || null, outputSchemaVersion: schema?.version || null,
      inputSummary, output, tokens: 0, cost: '0', dataSentToCloud: false, durationMs: Date.now() - startedAt,
    })
    return send(res, 200, { data: { task, output, requiresHumanConfirmation: true, capability, outputSchema: schema ? { code: schema.code, version: schema.version } : null } })
  }

  if (req.method === 'GET' && pathname === '/api/ai-tasks') {
    assertAiGatewayAccess(actor)
    const { page, pageSize, skip } = listQuery(url)
    const module = url.searchParams.get('module')?.toUpperCase()
    const status = url.searchParams.get('status')?.toUpperCase()
    const where = { ...aiTaskScopeFor(actor), ...(module ? { module } : {}), ...(status ? { status } : {}) }
    const [items, total] = await db.$transaction([db.aiTask.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { createdBy: { select: { id: true, name: true, teamId: true } } } }), db.aiTask.count({ where })])
    return send(res, 200, { data: { items, page, pageSize, total } })
  }

  const taskEventsMatch = pathname.match(/^\/api\/ai-tasks\/([^/]+)\/events$/)
  if (taskEventsMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const task = await db.aiTask.findUnique({ where: { id: taskEventsMatch[1] }, include: { createdBy: { select: { id: true, name: true, teamId: true } } } })
    if (!task) throw new HttpError(404, 'NOT_FOUND', 'AI 调用记录不存在。')
    assertAiTaskScope(actor, task)
    startAiTaskSse({ req, res, taskId: task.id })
    return true
  }

  const taskCancelMatch = pathname.match(/^\/api\/ai-tasks\/([^/]+)\/cancel$/)
  if (taskCancelMatch && req.method === 'POST') {
    assertAiGatewayAccess(actor)
    const task = await db.aiTask.findUnique({ where: { id: taskCancelMatch[1] }, include: { createdBy: { select: { id: true, name: true, teamId: true } } } })
    if (!task) throw new HttpError(404, 'NOT_FOUND', 'AI 调用记录不存在。')
    assertAiTaskScope(actor, task)
    if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(task.status)) throw new HttpError(400, 'AI_TASK_TERMINAL', '终态任务不能取消。')
    const cancelled = await updateAiTask(db, task.id, { status: 'CANCELLED', errorCode: 'CANCELLED_BY_USER', errorMessage: '用户取消异步 AI 任务。', dataSentToCloud: false })
    appendAiTaskEvent(task.id, { type: 'terminal', status: 'CANCELLED', stage: 'cancelled_by_user', tokens: cancelled.tokens, cost: cancelled.cost, durationMs: cancelled.durationMs, dataSentToCloud: false, queueBackend: aiQueueStatus().backend, errorCode: 'CANCELLED_BY_USER' })
    await createAudit(db, actor, 'CANCEL', 'ai_task', task.id, { dataSentToCloud: false })
    return send(res, 200, { data: cancelled })
  }

  const taskMatch = pathname.match(/^\/api\/ai-tasks\/([^/]+)$/)
  if (taskMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const task = await db.aiTask.findUnique({ where: { id: taskMatch[1] }, include: { createdBy: { select: { id: true, name: true, teamId: true } } } })
    if (!task) throw new HttpError(404, 'NOT_FOUND', 'AI 调用记录不存在。')
    assertAiTaskScope(actor, task)
    const [feedbackCount, citationCount] = await db.$transaction([
      db.aiFeedback.count({ where: { aiTaskId: task.id } }),
      db.aiCitation.count({ where: { aiTaskId: task.id } }),
    ])
    return send(res, 200, { data: { ...task, _count: { feedbacks: feedbackCount, citations: citationCount } } })
  }

  const taskCitationsMatch = pathname.match(/^\/api\/ai-tasks\/([^/]+)\/citations$/)
  if (taskCitationsMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const task = await db.aiTask.findUnique({ where: { id: taskCitationsMatch[1] }, include: { createdBy: { select: { id: true, name: true, teamId: true } } } })
    if (!task) throw new HttpError(404, 'NOT_FOUND', 'AI 调用记录不存在。')
    assertAiTaskScope(actor, task)
    const { page, pageSize, skip } = listQuery(url)
    const [items, total] = await db.$transaction([
      db.aiCitation.findMany({ where: { aiTaskId: task.id }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      db.aiCitation.count({ where: { aiTaskId: task.id } }),
    ])
    return send(res, 200, { data: { items: items.map(compactCitation), page, pageSize, total } })
  }

  const taskFeedbackMatch = pathname.match(/^\/api\/ai-tasks\/([^/]+)\/feedback$/)
  if (taskFeedbackMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const task = await db.aiTask.findUnique({ where: { id: taskFeedbackMatch[1] }, include: { createdBy: { select: { id: true, name: true, teamId: true } } } })
    if (!task) throw new HttpError(404, 'NOT_FOUND', 'AI 调用记录不存在。')
    assertAiTaskScope(actor, task)
    const { page, pageSize, skip } = listQuery(url)
    const [items, total] = await db.$transaction([
      db.aiFeedback.findMany({ where: { aiTaskId: task.id }, orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } } } }),
      db.aiFeedback.count({ where: { aiTaskId: task.id } }),
    ])
    return send(res, 200, { data: { items: items.map(compactFeedback), page, pageSize, total } })
  }

  if (taskFeedbackMatch && req.method === 'POST') {
    assertAiGatewayAccess(actor)
    const task = await db.aiTask.findUnique({ where: { id: taskFeedbackMatch[1] }, include: { createdBy: { select: { id: true, name: true, teamId: true } } } })
    if (!task) throw new HttpError(404, 'NOT_FOUND', 'AI 调用记录不存在。')
    assertAiTaskScope(actor, task)
    const data = feedbackInput(await readJson(req))
    const row = await db.aiFeedback.create({ data: { ...data, aiTaskId: task.id, createdById: actor.id } })
    await createAudit(db, actor, 'AI_HUMAN_FEEDBACK', 'ai_feedback', row.id, { aiTaskId: task.id, action: row.action, status: row.status, adoptionTarget: row.adoptionTarget, createsFormalWrite: row.createsFormalWrite })
    return send(res, 201, { data: row })
  }

  const feedbackMatch = pathname.match(/^\/api\/ai-feedback\/([^/]+)$/)
  if (feedbackMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const row = await db.aiFeedback.findUnique({ where: { id: feedbackMatch[1] }, include: { createdBy: { select: { id: true, name: true, role: true, teamId: true } }, aiTask: { include: { createdBy: { select: { id: true, name: true, teamId: true } } } } } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'AI 人工确认记录不存在。')
    assertAiTaskScope(actor, row.aiTask)
    return send(res, 200, { data: row })
  }

  const citationMatch = pathname.match(/^\/api\/ai-citations\/([^/]+)$/)
  if (citationMatch && req.method === 'GET') {
    assertAiGatewayAccess(actor)
    const row = await db.aiCitation.findUnique({ where: { id: citationMatch[1] }, include: { aiTask: { include: { createdBy: { select: { id: true, name: true, teamId: true } } } }, knowledgeDocument: true, knowledgeChunk: true } })
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'AI 引用记录不存在。')
    assertAiTaskScope(actor, row.aiTask)
    return send(res, 200, { data: row })
  }

  return false
}

import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-ai-feedback-smoke-session-secret-0123456789abcdef'
delete process.env.AI_ENABLED
delete process.env.AI_PROVIDER
delete process.env.AI_DEFAULT_MODEL

const { createAppServer } = await import('../src/server.mjs')
const { testMemoryState } = await import('../src/prisma.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { response, payload: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  return result.cookie
}

const contractBase = {
  code: 'QUOTE_FEEDBACK_DRAFT',
  name: '报价草稿人工确认能力',
  module: 'quote',
  level: 'L1',
  version: 'v1',
  status: 'ACTIVE',
  scenario: '生成报价邮件草稿后，由业务员人工确认、驳回或纠错。',
  inputSpec: { tables: ['Quote'], userInput: ['language', 'tone'] },
  permissionSpec: { roles: ['SALES', 'MANAGER'], dataScope: 'own/team' },
  outputSpec: { type: 'draft', fields: ['type', 'draft', 'limitations'] },
  validationSpec: { schema: 'QUOTE_FEEDBACK_OUTPUT' },
  persistenceSpec: { aiTask: true, aiFeedback: true, formalBusinessWrite: false },
  humanConfirmationSpec: { required: true, editableFields: ['draft'], records: ['adopt', 'reject', 'correct'] },
  forbiddenActions: ['不得自动发送', '不得改价', '不得绕过人工确认写入正式业务表'],
  fallbackSpec: { cloudFailure: 'manual drafting' },
  auditSpec: { fields: ['aiTaskId', 'action', 'correctedOutput', 'operator'] },
  evalSpec: { cases: ['NORMAL', 'LOW_CONFIDENCE'] },
  promptCode: 'QUOTE_FEEDBACK_DRAFT',
  promptVersion: 'v1',
  outputSchemaCode: 'QUOTE_FEEDBACK_OUTPUT',
  outputSchemaVersion: 'v1',
}

try {
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const prompt = await request('/api/prompt-templates', { cookie: manager, method: 'POST', body: { code: 'QUOTE_FEEDBACK_DRAFT', name: '报价草稿人工确认 Prompt', module: 'quote', version: 'v1', status: 'ACTIVE', level: 'L1', body: '只生成待人工确认草稿，禁止自动发送或写正式业务表。' } })
  assert.equal(prompt.response.status, 201)

  const schema = await request('/api/ai-output-schemas', { cookie: manager, method: 'POST', body: { code: 'QUOTE_FEEDBACK_OUTPUT', name: '报价人工确认输出', module: 'quote', version: 'v1', status: 'ACTIVE', schema: { type: 'object', required: ['type', 'draft', 'limitations'], properties: { type: { type: 'string' }, draft: { type: 'string' }, limitations: { type: 'array' } } } } })
  assert.equal(schema.response.status, 201)

  const contract = await request('/api/ai-capability-contracts', { cookie: manager, method: 'POST', body: contractBase })
  assert.equal(contract.response.status, 201)

  const run = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { capabilityCode: 'QUOTE_FEEDBACK_DRAFT', input: { quoteNo: 'Q-FB-001', amount: 2800 } } })
  assert.equal(run.response.status, 200)
  const aiTaskId = run.payload.data.task.id
  assert.equal(run.payload.data.requiresHumanConfirmation, true)

  const missingConfirmation = await request(`/api/ai-tasks/${aiTaskId}/feedback`, { cookie: sales, method: 'POST', body: { action: 'ADOPT', note: 'looks good' } })
  assert.equal(missingConfirmation.response.status, 400)
  assert.equal(missingConfirmation.payload.error.code, 'HUMAN_REVIEW_REQUIRED')

  const formalWrite = await request(`/api/ai-tasks/${aiTaskId}/feedback`, { cookie: sales, method: 'POST', body: { action: 'ADOPT', confirmedHumanReview: true, createsFormalWrite: true, adoptionTarget: 'quote_email' } })
  assert.equal(formalWrite.response.status, 400)
  assert.equal(formalWrite.payload.error.code, 'FORMAL_WRITE_NOT_SUPPORTED')

  const correctionMissingOutput = await request(`/api/ai-tasks/${aiTaskId}/feedback`, { cookie: sales, method: 'POST', body: { action: 'CORRECT', confirmedHumanReview: true, note: 'needs edits' } })
  assert.equal(correctionMissingOutput.response.status, 400)

  const rejectMissingReason = await request(`/api/ai-tasks/${aiTaskId}/feedback`, { cookie: sales, method: 'POST', body: { action: 'REJECT', confirmedHumanReview: true } })
  assert.equal(rejectMissingReason.response.status, 400)

  const adopted = await request(`/api/ai-tasks/${aiTaskId}/feedback`, { cookie: sales, method: 'POST', body: { action: 'ADOPT', confirmedHumanReview: true, note: '人工核对价格、交期和措辞后采纳。', adoptionTarget: 'quote_email_draft', adoptionTargetId: 'Q-FB-001' } })
  assert.equal(adopted.response.status, 201)
  assert.equal(adopted.payload.data.status, 'ADOPTED')
  assert.equal(adopted.payload.data.createsFormalWrite, false)

  const corrected = await request(`/api/ai-tasks/${aiTaskId}/feedback`, { cookie: manager, method: 'POST', body: { action: 'CORRECT', confirmedHumanReview: true, correctedOutput: { draft: 'Revised by manager before sending.', reason: 'remove unverifiable delivery promise' }, note: '删除未核实交期承诺。' } })
  assert.equal(corrected.response.status, 201)
  assert.equal(corrected.payload.data.status, 'CORRECTED')

  const needsReview = await request(`/api/ai-tasks/${aiTaskId}/feedback`, { cookie: manager, method: 'POST', body: { action: 'NEEDS_REVIEW', confirmedHumanReview: true, status: 'PENDING_MANUAL', note: '需法务复核对外措辞。' } })
  assert.equal(needsReview.response.status, 201)
  assert.equal(needsReview.payload.data.status, 'PENDING_MANUAL')

  const feedbackList = await request(`/api/ai-tasks/${aiTaskId}/feedback`, { cookie: exec })
  assert.equal(feedbackList.response.status, 200)
  assert.equal(feedbackList.payload.data.total, 3)
  assert.equal(feedbackList.payload.data.items[0].correctedOutput, undefined)
  assert.equal(typeof feedbackList.payload.data.items[0].hasCorrectedOutput, 'boolean')

  const taskDetail = await request(`/api/ai-tasks/${aiTaskId}`, { cookie: exec })
  assert.equal(taskDetail.response.status, 200)
  assert.equal(taskDetail.payload.data._count.feedbacks, 3)

  const feedbackDetail = await request(`/api/ai-feedback/${corrected.payload.data.id}`, { cookie: exec })
  assert.equal(feedbackDetail.response.status, 200)
  assert.equal(feedbackDetail.payload.data.correctedOutput.draft, 'Revised by manager before sending.')
  assert.equal(feedbackDetail.payload.data.aiTask.id, aiTaskId)

  const state = testMemoryState()
  assert.equal(state.aiTasks.length, 1)
  assert.equal(state.aiFeedbacks.length, 3)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'ai_feedback').length, 3)

  console.log(JSON.stringify({ result: 'passed', aiTasks: state.aiTasks.length, aiFeedbacks: state.aiFeedbacks.length, auditLogs: state.auditLogs.filter((item) => item.resource === 'ai_feedback').length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}

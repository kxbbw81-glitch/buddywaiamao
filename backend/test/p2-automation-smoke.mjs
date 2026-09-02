import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-automation-smoke-session-secret-0123456789abcdef'

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

const ruleBody = {
  code: 'QUOTE_EXPIRE_REMINDER',
  name: '报价即将到期提醒',
  module: 'quote',
  triggerType: 'schedule',
  status: 'DRAFT',
  schedule: { every: 'daily', at: '09:00' },
  condition: { quoteExpiresInDays: 3, status: ['SENT'] },
  action: { type: 'CREATE_TODO_DRAFT', title: '提醒业务员重新确认汇率和运费' },
  retryPolicy: { maxRetries: 2, backoff: 'manual_review' },
  dedupePolicy: { key: 'quoteId:expiresAt', windowHours: 24 },
}

try {
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const financeDenied = await request('/api/automation-rules', { cookie: finance, method: 'POST', body: ruleBody })
  assert.equal(financeDenied.response.status, 403)

  const externalDenied = await request('/api/automation-rules', { cookie: manager, method: 'POST', body: { ...ruleBody, code: 'BAD_EXTERNAL', action: { type: 'SEND_EMAIL', executeExternal: true } } })
  assert.equal(externalDenied.response.status, 400)
  assert.equal(externalDenied.payload.error.code, 'AUTOMATION_EXTERNAL_EXECUTION_FORBIDDEN')

  const rule = await request('/api/automation-rules', { cookie: manager, method: 'POST', body: ruleBody })
  assert.equal(rule.response.status, 201)
  assert.equal(rule.payload.data.status, 'DRAFT')

  const list = await request('/api/automation-rules?module=QUOTE&pageSize=1', { cookie: exec })
  assert.equal(list.response.status, 200)
  assert.equal(list.payload.data.total, 1)
  assert.equal(list.payload.data.items[0].condition, undefined)
  assert.equal(list.payload.data.items[0].ruleSummary.actionType, 'CREATE_TODO_DRAFT')

  const dryRun = await request(`/api/automation-rules/${rule.payload.data.id}/run`, {
    cookie: manager,
    method: 'POST',
    body: {
      mode: 'DRY_RUN',
      input: {
        candidates: [
          { quoteId: 'Q-AUTO-1', expiresAt: '2026-09-01', authorization: 'Bearer secret-token' },
          { quoteId: 'Q-AUTO-2', expiresAt: '2026-09-02' },
        ],
      },
    },
  })
  assert.equal(dryRun.response.status, 201)
  assert.equal(dryRun.payload.data.status, 'DRY_RUN_RECORDED')
  assert.equal(dryRun.payload.data.matchedCount, 2)
  assert.equal(dryRun.payload.data.proposedActions.noExternalSideEffects, true)
  assert.ok(!JSON.stringify(dryRun.payload.data.inputSummary).includes('secret-token'))

  const active = await request(`/api/automation-rules/${rule.payload.data.id}/status`, { cookie: manager, method: 'PATCH', body: { status: 'ACTIVE' } })
  assert.equal(active.response.status, 200)
  assert.equal(active.payload.data.status, 'ACTIVE')

  const manualMissingConfirm = await request(`/api/automation-rules/${rule.payload.data.id}/run`, { cookie: manager, method: 'POST', body: { mode: 'MANUAL_OVERRIDE', input: { candidates: [{ quoteId: 'Q-AUTO-1' }] } } })
  assert.equal(manualMissingConfirm.response.status, 400)
  assert.equal(manualMissingConfirm.payload.error.code, 'MANUAL_OVERRIDE_REQUIRED')

  const manual = await request(`/api/automation-rules/${rule.payload.data.id}/run`, {
    cookie: manager,
    method: 'POST',
    body: {
      mode: 'MANUAL_OVERRIDE',
      confirmedManualOverride: true,
      idempotencyKey: 'quote-reminder-Q-AUTO-1',
      input: { candidates: [{ quoteId: 'Q-AUTO-1', expiresAt: '2026-09-01' }] },
      executionResult: { recordedOnly: true, createdTodoDrafts: 1, noExternalSideEffects: true },
    },
  })
  assert.equal(manual.response.status, 201)
  assert.equal(manual.payload.data.status, 'MANUAL_OVERRIDE_RECORDED')
  assert.equal(manual.payload.data.executionResult.createdTodoDrafts, 1)

  const duplicate = await request(`/api/automation-rules/${rule.payload.data.id}/run`, {
    cookie: manager,
    method: 'POST',
    body: {
      mode: 'MANUAL_OVERRIDE',
      confirmedManualOverride: true,
      idempotencyKey: 'quote-reminder-Q-AUTO-1',
      input: { candidates: [{ quoteId: 'Q-AUTO-1' }] },
    },
  })
  assert.equal(duplicate.response.status, 200)
  assert.equal(duplicate.payload.data.duplicatePrevented, true)

  const runList = await request(`/api/automation-runs?ruleId=${rule.payload.data.id}`, { cookie: exec })
  assert.equal(runList.response.status, 200)
  assert.equal(runList.payload.data.total, 2)
  assert.equal(runList.payload.data.items[0].inputSummary, undefined)

  const runDetail = await request(`/api/automation-runs/${manual.payload.data.id}`, { cookie: exec })
  assert.equal(runDetail.response.status, 200)
  assert.equal(runDetail.payload.data.proposedActions.ruleCode, 'QUOTE_EXPIRE_REMINDER')

  const ruleDetail = await request(`/api/automation-rules/${rule.payload.data.id}`, { cookie: sales })
  assert.equal(ruleDetail.response.status, 200)
  assert.equal(ruleDetail.payload.data._count.runs, 2)

  const paused = await request(`/api/automation-rules/${rule.payload.data.id}/status`, { cookie: manager, method: 'PATCH', body: { status: 'PAUSED' } })
  assert.equal(paused.response.status, 200)
  const pausedManual = await request(`/api/automation-rules/${rule.payload.data.id}/run`, { cookie: manager, method: 'POST', body: { mode: 'MANUAL_OVERRIDE', confirmedManualOverride: true, input: { candidates: [{ quoteId: 'Q-AUTO-3' }] } } })
  assert.equal(pausedManual.response.status, 400)
  assert.equal(pausedManual.payload.error.code, 'AUTOMATION_RULE_NOT_ACTIVE')

  const state = testMemoryState()
  assert.equal(state.automationRules.length, 1)
  assert.equal(state.automationRuns.length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'automation_rule').length, 3)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'automation_run').length, 2)

  console.log(JSON.stringify({ result: 'passed', automationRules: state.automationRules.length, automationRuns: state.automationRuns.length, dryRunStatus: dryRun.payload.data.status, manualStatus: manual.payload.data.status, duplicatePrevented: duplicate.payload.data.duplicatePrevented }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}

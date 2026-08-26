import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p3-outbound-draft-session-secret-0123456789abcdef'

const { createAppServer } = await import('../src/server.mjs')
const { testMemoryState } = await import('../src/prisma.mjs')
const server = createAppServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`
async function request(path, { cookie, method = 'GET', body } = {}) { const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { response, payload: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] } }
async function login(email) { const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } }); assert.equal(result.response.status, 200); return result.cookie }
try {
  const manager = await login('manager@nexfab.test'); const finance = await login('finance@nexfab.test')
  const customer = await request('/api/customers', { cookie: manager, method: 'POST', body: { name: 'P3 Draft Buyer', country: 'US', duplicateCheckConfirmed: true } }); assert.equal(customer.response.status, 201)
  const denied = await request('/api/outbound-drafts', { cookie: finance }); assert.equal(denied.response.status, 403)
  const draft = await request('/api/outbound-drafts', { cookie: manager, method: 'POST', body: { customerId: customer.payload.data.id, channel: 'email', recipient: 'buyer@example.test', subject: '产品目录草稿', body: '这是待审核邮件草稿。', campaignCode: 'P3-EMAIL' } }); assert.equal(draft.response.status, 201); assert.equal(draft.payload.data.status, 'DRAFT'); assert.equal(draft.payload.data.externalCall, false)
  const review = await request(`/api/outbound-drafts/${draft.payload.data.id}/submit-review`, { cookie: manager, method: 'POST', body: {} }); assert.equal(review.response.status, 200); assert.equal(review.payload.data.status, 'IN_REVIEW')
  const approval = await request(`/api/outbound-drafts/${draft.payload.data.id}/approve`, { cookie: manager, method: 'POST', body: { note: '人工审核通过' } }); assert.equal(approval.response.status, 200); assert.equal(approval.payload.data.status, 'APPROVED')
  const sent = await request(`/api/outbound-drafts/${draft.payload.data.id}/record-manual-send`, { cookie: manager, method: 'POST', body: {} }); assert.equal(sent.response.status, 200); assert.equal(sent.payload.data.status, 'SENT_RECORDED'); assert.equal(sent.payload.data.externalCall, false)
  const listed = await request('/api/outbound-drafts?status=SENT_RECORDED', { cookie: manager }); assert.equal(listed.response.status, 200); assert.equal(listed.payload.data.total, 1)
  const state = testMemoryState(); assert.equal(state.communicationEvents.length, 1); assert.equal(state.auditLogs.filter((row) => row.resource === 'outbound_draft').length, 4)
  console.log(JSON.stringify({ result: 'passed', drafts: listed.payload.data.total, communicationEvents: state.communicationEvents.length, externalCalls: 0 }))
} finally { await new Promise((resolve) => server.close(resolve)) }

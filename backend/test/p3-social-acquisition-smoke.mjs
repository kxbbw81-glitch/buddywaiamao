import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p3-social-acquisition-session-secret-0123456789abcdef'
process.env.PII_ENCRYPTION_KEY = 'p3-social-acquisition-encryption-key-0123456789abcdef'

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

try {
  const sales = await login('sales@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const finance = await login('finance@nexfab.test')

  const denied = await request('/api/social-posts', { cookie: finance })
  assert.equal(denied.response.status, 403)

  const account = await request('/api/social-accounts', { cookie: manager, method: 'POST', body: { platform: 'linkedin', displayName: 'NexFab Official', accountRef: 'nexfab-official' } })
  assert.equal(account.response.status, 201)
  assert.equal(account.payload.data.fallbackMode, 'MANUAL_PUBLISH')

  const post = await request('/api/social-posts', { cookie: sales, method: 'POST', body: { socialAccountId: account.payload.data.id, platform: 'linkedin', title: '新品发布草稿', body: '欢迎咨询新品资料。', campaignCode: '2026-Q3-LAUNCH', utm: { source: 'linkedin', campaign: '2026-Q3-LAUNCH' } } })
  assert.equal(post.response.status, 201)
  assert.equal(post.payload.data.status, 'DRAFT')

  const pending = await request(`/api/social-posts/${post.payload.data.id}/submit-review`, { cookie: sales, method: 'POST', body: {} })
  assert.equal(pending.response.status, 200)
  assert.equal(pending.payload.data.status, 'IN_REVIEW')

  const salesApprovalDenied = await request(`/api/social-posts/${post.payload.data.id}/approve`, { cookie: sales, method: 'POST', body: {} })
  assert.equal(salesApprovalDenied.response.status, 403)

  const approved = await request(`/api/social-posts/${post.payload.data.id}/approve`, { cookie: manager, method: 'POST', body: { note: '措辞已人工确认。' } })
  assert.equal(approved.response.status, 200)
  assert.equal(approved.payload.data.status, 'APPROVED')

  const published = await request(`/api/social-posts/${post.payload.data.id}/record-published`, { cookie: manager, method: 'POST', body: {} })
  assert.equal(published.response.status, 200)
  assert.equal(published.payload.data.status, 'PUBLISHED')
  assert.ok(published.payload.data.publishedAt)

  const interaction = await request('/api/social-interactions', { cookie: sales, method: 'POST', body: { socialPostId: post.payload.data.id, platform: 'linkedin', interactionType: 'direct_message', authorAlias: '采购负责人', content: '请发产品目录和起订量。', intent: 'inquiry', proposedReply: '您好，目录已准备，发送前请人工确认。', campaignCode: '2026-Q3-LAUNCH' } })
  assert.equal(interaction.response.status, 201)
  assert.equal(interaction.payload.data.status, 'LEAD_SUGGESTED')

  const converted = await request(`/api/social-interactions/${interaction.payload.data.id}/convert-to-lead`, { cookie: sales, method: 'POST', body: { companyName: 'NexFab Social Buyer', contactName: '采购负责人' } })
  assert.equal(converted.response.status, 201)
  assert.equal(converted.payload.data.interaction.status, 'CONVERTED')
  assert.equal(converted.payload.data.lead.source, 'SOCIAL')
  assert.equal(converted.payload.data.lead.channel, 'LINKEDIN')

  const state = testMemoryState()
  assert.equal(state.socialAccounts.length, 1)
  assert.equal(state.socialPosts.length, 1)
  assert.equal(state.socialInteractions.length, 1)
  assert.equal(state.leads.length, 1)
  assert.equal(state.socialPosts[0].status, 'PUBLISHED')
  assert.equal(state.auditLogs.filter((row) => row.resource.startsWith('social_')).length, 7)
  console.log(JSON.stringify({ result: 'passed', socialAccounts: state.socialAccounts.length, socialPosts: state.socialPosts.length, socialInteractions: state.socialInteractions.length, convertedLeads: state.leads.length, externalCalls: 0 }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}

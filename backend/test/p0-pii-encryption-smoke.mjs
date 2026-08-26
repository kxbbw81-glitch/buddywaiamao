import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p0-pii-encryption-session-secret-0123456789abcdef'
process.env.PII_ENCRYPTION_KEY = 'p0-local-test-pii-key-not-for-production'
delete process.env.AI_ENABLED

const { createAppServer } = await import('../src/server.mjs')
const { testMemoryState } = await import('../src/prisma.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = response.status === 204 ? null : await response.json()
  return { response, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  return result.cookie
}

try {
  const sales = await login('sales@nexfab.test')

  const customer = await request('/api/customers', { cookie: sales, method: 'POST', body: { name: 'PII Secure Buyer', country: 'US' } })
  assert.equal(customer.response.status, 201)
  const contact = await request(`/api/customers/${customer.payload.data.id}/contacts`, {
    cookie: sales,
    method: 'POST',
    body: { name: 'Alice Buyer', title: 'Purchasing', email: 'Alice.Buyer@Example.com', phone: '+1 (555) 010-8899' },
  })
  assert.equal(contact.response.status, 201)
  assert.equal(contact.payload.data.email, 'alice.buyer@example.com')
  assert.equal(contact.payload.data.phone, '+1 (555) 010-8899')

  const contacts = await request(`/api/customers/${customer.payload.data.id}/contacts`, { cookie: sales })
  assert.equal(contacts.response.status, 200)
  assert.equal(contacts.payload.data.items[0].email, 'alice.buyer@example.com')

  const lead = await request('/api/leads', {
    cookie: sales,
    method: 'POST',
    body: { source: 'website', companyName: 'PII Lead Ltd', contactName: 'Bob Lead', email: 'Bob.Lead@Example.com', phone: '+86 138 0013 8000' },
  })
  assert.equal(lead.response.status, 201)
  assert.equal(lead.payload.data.email, 'bob.lead@example.com')

  const leadDetail = await request(`/api/leads/${lead.payload.data.id}`, { cookie: sales })
  assert.equal(leadDetail.response.status, 200)
  assert.equal(leadDetail.payload.data.email, 'bob.lead@example.com')

  const duplicate = await request('/api/tools/dedupe', { cookie: sales, method: 'POST', body: { email: 'alice.buyer@example.com', phone: '+1 555 010 8899' } })
  assert.equal(duplicate.response.status, 200)
  assert.equal(duplicate.payload.data.hasDuplicates, true)

  const aiRun = await request('/api/ai-gateway/run', { cookie: sales, method: 'POST', body: { module: 'lead', purpose: '线索摘要', input: { email: 'bob.lead@example.com', phone: '+86 13800138000', token: 'sk-test-secret-value' } } })
  assert.equal(aiRun.response.status, 200)
  assert.ok(!JSON.stringify(aiRun.payload).includes('bob.lead@example.com'))
  assert.ok(!JSON.stringify(aiRun.payload).includes('13800138000'))
  assert.ok(!JSON.stringify(aiRun.payload).includes('sk-test-secret-value'))

  const state = testMemoryState()
  const storedContact = state.contacts.find((item) => item.id === contact.payload.data.id)
  const storedLead = state.leads.find((item) => item.id === lead.payload.data.id)
  assert.equal(storedContact.email, null)
  assert.equal(storedContact.phone, null)
  assert.ok(storedContact.emailCiphertext?.startsWith('v1.'))
  assert.ok(storedContact.phoneCiphertext?.startsWith('v1.'))
  assert.match(storedContact.emailHash, /^[a-f0-9]{64}$/)
  assert.match(storedContact.phoneHash, /^[a-f0-9]{64}$/)
  assert.equal(storedLead.email, null)
  assert.equal(storedLead.phone, null)
  assert.ok(storedLead.emailCiphertext?.startsWith('v1.'))
  assert.ok(storedLead.phoneCiphertext?.startsWith('v1.'))
  assert.match(storedLead.emailHash, /^[a-f0-9]{64}$/)
  assert.match(storedLead.phoneHash, /^[a-f0-9]{64}$/)

  const serializedState = JSON.stringify({ contacts: state.contacts, leads: state.leads, fingerprints: state.customerFingerprints, aiTasks: state.aiTasks, auditLogs: state.auditLogs })
  assert.ok(!serializedState.includes('alice.buyer@example.com'))
  assert.ok(!serializedState.includes('+1 (555) 010-8899'))
  assert.ok(!serializedState.includes('bob.lead@example.com'))
  assert.ok(!serializedState.includes('+86 138 0013 8000'))
  assert.ok(state.customerFingerprints.some((item) => item.type === 'EMAIL' && item.value.includes('***') && /^[a-f0-9]{64}$/.test(item.normalized)))
  assert.ok(state.auditLogs.some((item) => item.resource === 'contact' && item.detail?.pii?.emailEncrypted === true))
  assert.ok(state.auditLogs.some((item) => item.resource === 'lead' && item.detail?.pii?.emailEncrypted === true))

  console.log(JSON.stringify({ result: 'passed', mode: 'p0-pii-encryption', contacts: state.contacts.length, leads: state.leads.length, encryptedFields: 4, fingerprintEmailEncrypted: true, aiRedaction: true }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}

import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-timeline-smoke-session-secret-0123456789abcdef'

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

async function createCustomer(cookie, name) {
  const result = await request('/api/customers', { cookie, method: 'POST', body: { name, country: 'US' } })
  assert.equal(result.response.status, 201)
  return result.payload.data
}

try {
  const admin = await login('admin@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const salesCustomer = await createCustomer(sales, 'Sales Timeline Buyer')
  const adminCustomer = await createCustomer(admin, 'Admin Timeline Buyer')
  const salesOpportunity = await request('/api/opportunities', { cookie: sales, method: 'POST', body: { customerId: salesCustomer.id, name: 'Timeline Deal', amount: 1000, currency: 'USD' } })
  assert.equal(salesOpportunity.response.status, 201)

  const salesEvent = await request('/api/timeline', { cookie: sales, method: 'POST', body: { customerId: salesCustomer.id, opportunityId: salesOpportunity.payload.data.id, type: 'EMAIL', direction: 'OUTBOUND', summary: '发送报价跟进邮件', content: '客户询问 MOQ 与交期。' } })
  assert.equal(salesEvent.response.status, 201)
  assert.equal(salesEvent.payload.data.type, 'EMAIL')

  const adminEvent = await request('/api/timeline', { cookie: admin, method: 'POST', body: { customerId: adminCustomer.id, type: 'NOTE', direction: 'INTERNAL', summary: '管理备注' } })
  assert.equal(adminEvent.response.status, 201)

  const salesList = await request(`/api/timeline?page=1&pageSize=1&customerId=${salesCustomer.id}`, { cookie: sales })
  assert.equal(salesList.response.status, 200)
  assert.equal(salesList.payload.data.total, 1)
  assert.equal(salesList.payload.data.items.length, 1)

  const typeFilter = await request('/api/timeline?type=EMAIL&page=1&pageSize=10', { cookie: sales })
  assert.equal(typeFilter.response.status, 200)
  assert.equal(typeFilter.payload.data.total, 1)

  const opportunityFilter = await request(`/api/timeline?opportunityId=${salesOpportunity.payload.data.id}`, { cookie: sales })
  assert.equal(opportunityFilter.response.status, 200)
  assert.equal(opportunityFilter.payload.data.total, 1)

  const salesOverreach = await request('/api/timeline', { cookie: sales, method: 'POST', body: { customerId: adminCustomer.id, type: 'NOTE', direction: 'INTERNAL', summary: '越权备注' } })
  assert.equal(salesOverreach.response.status, 403)

  const managerList = await request('/api/timeline?page=1&pageSize=10', { cookie: manager })
  assert.equal(managerList.response.status, 200)
  assert.equal(managerList.payload.data.total, 1)
  assert.equal(managerList.payload.data.items[0].id, salesEvent.payload.data.id)

  const execList = await request('/api/timeline?page=1&pageSize=10', { cookie: exec })
  assert.equal(execList.response.status, 200)
  assert.equal(execList.payload.data.total, 2)
  const execWrite = await request('/api/timeline', { cookie: exec, method: 'POST', body: { customerId: salesCustomer.id, type: 'NOTE', direction: 'INTERNAL', summary: 'exec write' } })
  assert.equal(execWrite.response.status, 403)

  const financeList = await request('/api/timeline', { cookie: finance })
  assert.equal(financeList.response.status, 403)
  const financeWrite = await request('/api/timeline', { cookie: finance, method: 'POST', body: { customerId: salesCustomer.id, type: 'NOTE', direction: 'INTERNAL', summary: 'finance write' } })
  assert.equal(financeWrite.response.status, 403)

  const state = testMemoryState()
  assert.equal(state.communicationEvents.length, 2)
  assert.equal(state.auditLogs.filter((item) => item.resource === 'communication_event').length, 2)
  console.log(JSON.stringify({ result: 'passed', communicationEvents: state.communicationEvents.length, auditLogs: state.auditLogs.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}

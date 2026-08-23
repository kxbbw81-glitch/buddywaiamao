import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'g1-smoke-session-secret-0123456789abcdef'

const { createAppServer } = await import('../src/server.mjs')
const { testMemoryState } = await import('../src/prisma.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const payload = response.status === 204 ? null : await response.json()
  return { response, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
async function login(email) {
  const { response, payload, cookie } = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(response.status, 200)
  assert.ok(cookie)
  assert.equal(payload.data.user.passwordHash, undefined)
  return cookie
}

try {
  const admin = await login('admin@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const manager = await login('manager@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const nav = await request('/api/navigation', { cookie: sales })
  assert.equal(nav.response.status, 200)
  assert.equal(nav.payload.data.role, 'sales')
  const financeNav = await request('/api/navigation', { cookie: finance })
  assert.equal(financeNav.response.status, 200)
  assert.equal(financeNav.payload.data.role, 'finance')

  const salesCustomer = await request('/api/customers', { cookie: sales, method: 'POST', body: { name: '销售客户', country: 'CN' } })
  assert.equal(salesCustomer.response.status, 201)
  const customerId = salesCustomer.payload.data.id
  const contact = await request(`/api/customers/${customerId}/contacts`, { cookie: sales, method: 'POST', body: { name: '采购联系人', email: 'buyer@example.test' } })
  assert.equal(contact.response.status, 201)
  const contacts = await request(`/api/customers/${customerId}/contacts?page=1&pageSize=1`, { cookie: sales })
  assert.equal(contacts.response.status, 200)
  assert.equal(contacts.payload.data.total, 1)

  const opportunity = await request('/api/opportunities', { cookie: sales, method: 'POST', body: { customerId, name: '测试商机', amount: 1200, currency: 'USD' } })
  assert.equal(opportunity.response.status, 201)
  const opportunityId = opportunity.payload.data.id
  const followUp = await request(`/api/opportunities/${opportunityId}/follow-ups`, { cookie: sales, method: 'POST', body: { type: 'CALL', content: '首次电话跟进' } })
  assert.equal(followUp.response.status, 201)
  const followUps = await request(`/api/opportunities/${opportunityId}/follow-ups?page=1&pageSize=1`, { cookie: sales })
  assert.equal(followUps.response.status, 200)
  assert.equal(followUps.payload.data.total, 1)

  const managerCustomers = await request('/api/customers', { cookie: manager })
  assert.equal(managerCustomers.response.status, 200)
  assert.equal(managerCustomers.payload.data.items.some((item) => item.id === customerId), true)

  const adminCustomer = await request('/api/customers', { cookie: admin, method: 'POST', body: { name: '管理员客户' } })
  assert.equal(adminCustomer.response.status, 201)
  const salesForbidden = await request(`/api/customers/${adminCustomer.payload.data.id}`, { cookie: sales })
  assert.equal(salesForbidden.response.status, 403)
  const financeForbidden = await request('/api/customers', { cookie: finance })
  assert.equal(financeForbidden.response.status, 403)
  const execWrite = await request('/api/customers', { cookie: exec, method: 'POST', body: { name: '不应写入' } })
  assert.equal(execWrite.response.status, 403)

  const state = testMemoryState()
  assert.ok(state.auditLogs.length >= 8)
  console.log(JSON.stringify({ result: 'passed', customers: state.customers.length, contacts: state.contacts.length, opportunities: state.opportunities.length, followUps: state.followUps.length, auditLogs: state.auditLogs.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}

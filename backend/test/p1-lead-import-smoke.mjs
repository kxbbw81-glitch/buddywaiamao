import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p1-lead-import-session-secret-0123456789abcdef'

const { createAppServer } = await import('../src/server.mjs')
const { testMemoryState } = await import('../src/prisma.mjs')
const server = createAppServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = `http://127.0.0.1:${server.address().port}`

async function request(path, { cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { response, payload: response.status === 204 ? null : await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
async function login(email) {
  const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  return result.cookie
}

try {
  const sales = await login('sales@nexfab.test')
  const admin = await login('admin@nexfab.test')
  const customer = await request('/api/customers', { cookie: sales, method: 'POST', body: { name: '已有去重客户' } })
  assert.equal(customer.response.status, 201)
  const contact = await request(`/api/customers/${customer.payload.data.id}/contacts`, { cookie: sales, method: 'POST', body: { name: '已有联系人', email: 'existing@example.test' } })
  assert.equal(contact.response.status, 201)
  const hiddenCustomer = await request('/api/customers', { cookie: admin, method: 'POST', body: { name: '管理员私有客户' } })
  assert.equal(hiddenCustomer.response.status, 201)
  const hiddenContact = await request(`/api/customers/${hiddenCustomer.payload.data.id}/contacts`, { cookie: admin, method: 'POST', body: { name: '管理员私有联系人', email: 'hidden@private-hidden.test' } })
  assert.equal(hiddenContact.response.status, 201)

  const importRows = [
    { source: 'csv', companyName: '可导入客户', contactName: '导入联系人', email: 'new@fresh-lead.test', phone: '+1 202 555 0199' },
    { source: 'csv', companyName: '重复客户', email: 'existing@example.test' },
    { source: 'csv', email: 'invalid@example.test' },
  ]
  const preview = await request('/api/leads/import', {
    cookie: sales,
    method: 'POST',
    body: { dryRun: true, rows: importRows },
  })
  assert.equal(preview.response.status, 200)
  assert.equal(preview.payload.data.dryRun, true)
  assert.deepEqual(preview.payload.data.summary, { created: 0, wouldCreate: 1, skipped: 1, errors: 1 })
  assert.equal(testMemoryState().leads.length, 0)
  assert.equal(testMemoryState().auditLogs.some((item) => item.action === 'IMPORT_CREATE'), false)

  const importWithoutConfirmation = await request('/api/leads/import', { cookie: sales, method: 'POST', body: { rows: importRows } })
  assert.equal(importWithoutConfirmation.response.status, 400)
  assert.equal(importWithoutConfirmation.payload.error.code, 'IMPORT_CONFIRMATION_REQUIRED')

  const imported = await request('/api/leads/import', {
    cookie: sales,
    method: 'POST',
    body: { confirmImport: true, rows: importRows },
  })
  assert.equal(imported.response.status, 200)
  assert.deepEqual(imported.payload.data.summary, { created: 1, wouldCreate: 0, skipped: 1, errors: 1 })
  assert.equal(imported.payload.data.skipped[0].code, 'DUPLICATE_CHECK_REQUIRED')
  assert.equal(imported.payload.data.errors[0].code, 'VALIDATION_ERROR')

  const hiddenDuplicate = await request('/api/leads/import', { cookie: sales, method: 'POST', body: { confirmImport: true, rows: [{ source: 'csv', companyName: '不可见客户同邮箱', email: 'hidden@private-hidden.test' }] } })
  assert.equal(hiddenDuplicate.response.status, 200)
  assert.deepEqual(hiddenDuplicate.payload.data.summary, { created: 1, wouldCreate: 0, skipped: 0, errors: 0 })
  assert.equal(JSON.stringify(hiddenDuplicate.payload.data).includes(hiddenCustomer.payload.data.id), false)

  const overreach = await request('/api/leads/import', { cookie: sales, method: 'POST', body: { ownerId: 'admin-1', confirmImport: true, rows: [{ source: 'csv', companyName: '不应导入' }] } })
  assert.equal(overreach.response.status, 403)

  const approvedDuplicate = await request('/api/leads/import', { cookie: admin, method: 'POST', body: { ownerId: 'sales-1', confirmImport: true, duplicateCheckConfirmed: true, rows: [{ source: 'csv', companyName: '重复已确认', email: 'existing@example.test' }] } })
  assert.equal(approvedDuplicate.response.status, 200)
  assert.deepEqual(approvedDuplicate.payload.data.summary, { created: 1, wouldCreate: 0, skipped: 0, errors: 0 })

  const state = testMemoryState()
  const importedLead = state.leads.find((item) => item.id === imported.payload.data.created[0].id)
  assert.equal(importedLead.email, null)
  assert.ok(importedLead.emailCiphertext)
  assert.ok(state.auditLogs.some((item) => item.action === 'IMPORT_CREATE' && item.resource === 'lead'))
  assert.equal(JSON.stringify(state.auditLogs).includes('new@fresh-lead.test'), false)

  console.log(JSON.stringify({ result: 'passed', mode: 'p1-lead-import', created: state.leads.length, importAudits: state.auditLogs.filter((item) => item.action === 'IMPORT_CREATE').length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}

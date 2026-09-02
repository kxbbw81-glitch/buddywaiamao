import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-product-smoke-session-secret-0123456789abcdef'

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
async function login(email) { const result = await request('/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } }); assert.equal(result.response.status, 200); return result.cookie }

try {
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')
  const category = await request('/api/product-categories', { cookie: manager, method: 'POST', body: { name: '五金件' } })
  assert.equal(category.response.status, 201)
  const product = await request('/api/products', { cookie: manager, method: 'POST', body: { sku: 'HW-001', name: '测试产品', categoryId: category.payload.data.id, specs: { material: 'steel' }, packing: { carton: 24 }, costVersions: { current: 12.5 } } })
  assert.equal(product.response.status, 201)
  const doc = await request(`/api/products/${product.payload.data.id}/docs`, { cookie: manager, method: 'POST', body: { type: 'TDS', status: 'REVIEWED', fileUrl: 'https://files.example.test/tds.pdf' } })
  assert.equal(doc.response.status, 201)
  const list = await request('/api/products?page=1&pageSize=10', { cookie: sales })
  assert.equal(list.response.status, 200)
  assert.equal(list.payload.data.total, 1)
  const salesWrite = await request('/api/products', { cookie: sales, method: 'POST', body: { sku: 'HW-002', name: '禁止写入', categoryId: category.payload.data.id, specs: {}, packing: {}, costVersions: {} } })
  assert.equal(salesWrite.response.status, 403)
  const execWrite = await request('/api/products', { cookie: exec, method: 'POST', body: { sku: 'HW-003', name: '禁止写入', categoryId: category.payload.data.id, specs: {}, packing: {}, costVersions: {} } })
  assert.equal(execWrite.response.status, 403)
  const financeRead = await request('/api/products', { cookie: finance })
  assert.equal(financeRead.response.status, 403)
  const state = testMemoryState()
  assert.equal(state.productCategories.length, 1)
  assert.equal(state.products.length, 1)
  assert.equal(state.productDocs.length, 1)
  assert.ok(state.auditLogs.length >= 3)
  console.log(JSON.stringify({ result: 'passed', categories: 1, products: 1, productDocs: 1, auditLogs: state.auditLogs.length }))
} finally { await new Promise((resolve) => server.close(resolve)) }

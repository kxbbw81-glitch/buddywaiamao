import assert from 'node:assert/strict'
import { scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { assertCrmAccess, scopeFor } from '../src/access.mjs'
import { navigationFor } from '../src/navigation.mjs'
import { createSession, sessionFromRequest, verifyPassword } from '../src/security.mjs'
import { handleCrmRoute } from '../src/crm-routes.mjs'

const scrypt = promisify(scryptCallback)

async function testSession() {
  const token = createSession({ id: 'sales-1', role: 'SALES', teamId: 'team-1' })
  const session = sessionFromRequest({ headers: { authorization: `Bearer ${token}` } })
  assert.equal(session.sub, 'sales-1')
  assert.equal(session.role, 'SALES')
  assert.throws(() => sessionFromRequest({ headers: { authorization: 'Bearer invalid.token' } }))
}

async function testPassword() {
  const salt = 'phase1-test-salt'
  const hash = `${salt}:${Buffer.from(await scrypt('Correct#Password1', salt, 64)).toString('hex')}`
  assert.equal(await verifyPassword('Correct#Password1', hash), true)
  assert.equal(await verifyPassword('incorrect', hash), false)
}

function testNavigationAndAccess() {
  const manager = navigationFor('manager')
  const admin = navigationFor('admin')
  assert.equal(manager.modules.length, 12)
  assert.equal(manager.modules.reduce((total, module) => total + module.subs.length, 0), 44)
  assert.equal(admin.modules.length, 13)
  assert.equal(admin.modules.reduce((total, module) => total + module.subs.length, 0), 48)
  assert.deepEqual(scopeFor({ id: 'sales-1', role: 'SALES' }), { ownerId: 'sales-1' })
  assert.throws(() => assertCrmAccess({ role: 'FINANCE' }))
  assert.doesNotThrow(() => assertCrmAccess({ role: 'MANAGER' }, true))
  assert.throws(() => assertCrmAccess({ role: 'EXEC' }, true))
}

function responseCapture() {
  return { status: null, body: null, writeHead(status) { this.status = status }, end(body) { this.body = JSON.parse(body) } }
}

async function testNestedPagination() {
  const actor = { id: 'sales-1', role: 'SALES', teamId: 'team-1' }
  const contactCalls = []
  const contactDb = {
    customer: { findUnique: async () => ({ id: 'customer-1', ownerId: 'sales-1', owner: { id: 'sales-1', teamId: 'team-1' } }) },
    contact: { findMany: async (args) => { contactCalls.push(args); return [{ id: 'contact-1' }] }, count: async () => 11 },
    $transaction: async (operations) => Promise.all(operations),
  }
  const contactRes = responseCapture()
  await handleCrmRoute({ req: { method: 'GET' }, res: contactRes, url: new URL('http://local/api/customers/customer-1/contacts?page=2&pageSize=5'), pathname: '/api/customers/customer-1/contacts', actor, db: contactDb })
  assert.equal(contactRes.status, 200)
  assert.deepEqual(contactRes.body.data, { items: [{ id: 'contact-1' }], page: 2, pageSize: 5, total: 11 })
  assert.equal(contactCalls[0].skip, 5)
  assert.equal(contactCalls[0].take, 5)

  const followUpCalls = []
  const followUpDb = {
    opportunity: { findUnique: async () => ({ id: 'opportunity-1', customer: { ownerId: 'sales-1', owner: { id: 'sales-1', teamId: 'team-1' } } }) },
    followUp: { findMany: async (args) => { followUpCalls.push(args); return [{ id: 'follow-up-1' }] }, count: async () => 7 },
    $transaction: async (operations) => Promise.all(operations),
  }
  const followUpRes = responseCapture()
  await handleCrmRoute({ req: { method: 'GET' }, res: followUpRes, url: new URL('http://local/api/opportunities/opportunity-1/follow-ups?page=3&pageSize=2'), pathname: '/api/opportunities/opportunity-1/follow-ups', actor, db: followUpDb })
  assert.equal(followUpRes.status, 200)
  assert.deepEqual(followUpRes.body.data, { items: [{ id: 'follow-up-1' }], page: 3, pageSize: 2, total: 7 })
  assert.equal(followUpCalls[0].skip, 4)
  assert.equal(followUpCalls[0].take, 2)
}

await testSession()
await testPassword()
testNavigationAndAccess()
await testNestedPagination()
console.log('Phase 1 security, navigation, and scope checks passed.')

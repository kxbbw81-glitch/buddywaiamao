import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-acquisition-smoke-session-secret-0123456789abcdef'

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
  const manager = await login('manager@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const admin = await login('admin@nexfab.test')

  const financeDenied = await request('/api/leads', { cookie: finance })
  assert.equal(financeDenied.response.status, 403)

  const salesLead = await request('/api/leads', {
    cookie: sales,
    method: 'POST',
    body: {
      source: 'website',
      channel: 'form',
      companyName: 'Brazil Retail Group',
      contactName: 'Ana Silva',
      email: 'ana@example.com',
      country: 'BR',
      language: 'en',
      productInterest: { products: ['LED street light'], quantity: '5000' },
      buyerRole: 'distributor',
      priority: 'high',
    },
  })
  assert.equal(salesLead.response.status, 201)
  assert.equal(salesLead.payload.data.ownerId, 'sales-1')
  assert.equal(salesLead.payload.data.status, 'NEW')
  const leadId = salesLead.payload.data.id

  const managerLeads = await request('/api/leads?pageSize=5', { cookie: manager })
  assert.equal(managerLeads.response.status, 200)
  assert.equal(managerLeads.payload.data.items.some((item) => item.id === leadId), true)

  const adminPoolLead = await request('/api/leads', { cookie: admin, method: 'POST', body: { ownerId: null, source: 'exhibition', companyName: 'Unassigned Buyer', country: 'US' } })
  assert.equal(adminPoolLead.response.status, 201)
  assert.equal(adminPoolLead.payload.data.ownerId, null)
  const poolLeadId = adminPoolLead.payload.data.id

  const salesPoolDenied = await request(`/api/leads/${poolLeadId}`, { cookie: sales })
  assert.equal(salesPoolDenied.response.status, 403)

  const assigned = await request(`/api/leads/${poolLeadId}/assign`, { cookie: manager, method: 'POST', body: { ownerId: 'sales-1' } })
  assert.equal(assigned.response.status, 200)
  assert.equal(assigned.payload.data.ownerId, 'sales-1')
  assert.equal(assigned.payload.data.status, 'TO_CONTACT')

  const follow = await request(`/api/leads/${leadId}/follow-ups`, { cookie: sales, method: 'POST', body: { type: 'email', content: '已人工回复网站询盘，等待客户补充灯具参数。', completed: true } })
  assert.equal(follow.response.status, 201)
  assert.equal(follow.payload.data.type, 'EMAIL')

  const existingCustomer = await request('/api/customers', { cookie: sales, method: 'POST', body: { name: 'Brazil Retail Group', country: 'BR' } })
  assert.equal(existingCustomer.response.status, 201)
  const existingContact = await request(`/api/customers/${existingCustomer.payload.data.id}/contacts`, { cookie: sales, method: 'POST', body: { name: 'Ana Silva', email: 'ANA@example.com', phone: '+55 11 9988-7766' } })
  assert.equal(existingContact.response.status, 201)

  const dedupe = await request('/api/tools/dedupe', { cookie: sales, method: 'POST', body: { companyName: 'Brazil Retail Group Ltd.', email: 'ana@example.com' } })
  assert.equal(dedupe.response.status, 200)
  assert.equal(dedupe.payload.data.hasDuplicates, true)
  assert.equal(dedupe.payload.data.candidates[0].customer.id, existingCustomer.payload.data.id)
  assert.ok(dedupe.payload.data.candidates[0].matches.some((item) => item.type === 'EMAIL'))

  const inquiry = await request('/api/inquiries', {
    cookie: sales,
    method: 'POST',
    body: {
      leadId,
      subject: 'LED street light bulk inquiry',
      content: 'Need 5000 LED street lights for Brazil road project. Please quote FOB and DDP.',
      source: 'website',
      channel: 'form',
      requirements: { products: ['LED street light'], tradeTerms: ['FOB', 'DDP'], destination: 'Brazil' },
      missingFields: { voltage: true, certification: true },
      aiExtracted: true,
      items: [{ productName: 'LED street light', quantity: 5000, unit: 'pcs', specs: { waterproof: 'IP66' } }],
    },
  })
  assert.equal(inquiry.response.status, 201)
  assert.equal(inquiry.payload.data.leadId, leadId)
  assert.equal(inquiry.payload.data.aiExtracted, true)
  const inquiryId = inquiry.payload.data.id

  const leadAfterInquiry = await request(`/api/leads/${leadId}`, { cookie: sales })
  assert.equal(leadAfterInquiry.response.status, 200)
  assert.equal(leadAfterInquiry.payload.data.status, 'INQUIRY')
  assert.equal(leadAfterInquiry.payload.data._count.inquiries, 1)

  const inquiryMessage = await request(`/api/inquiries/${inquiryId}/messages`, { cookie: sales, method: 'POST', body: { direction: 'inbound', channel: 'email', sender: 'ana@example.com', content: 'Please include DDP Sao Paulo option.' } })
  assert.equal(inquiryMessage.response.status, 201)
  assert.equal(inquiryMessage.payload.data.direction, 'INBOUND')

  const inquiryItem = await request(`/api/inquiries/${inquiryId}/items`, { cookie: sales, method: 'POST', body: { productName: 'Solar street light', quantity: 2000, unit: 'pcs' } })
  assert.equal(inquiryItem.response.status, 201)

  const inquiryDetail = await request(`/api/inquiries/${inquiryId}`, { cookie: sales })
  assert.equal(inquiryDetail.response.status, 200)
  assert.equal(inquiryDetail.payload.data.items.length, 2)
  assert.equal(inquiryDetail.payload.data.messages.length, 1)

  const convertBlocked = await request(`/api/leads/${leadId}/convert`, { cookie: sales, method: 'POST', body: { opportunityName: 'Brazil LED Road Project' } })
  assert.equal(convertBlocked.response.status, 409)
  assert.equal(convertBlocked.payload.error.code, 'DUPLICATE_CHECK_REQUIRED')
  assert.ok(convertBlocked.payload.data.fingerprints.some((item) => item.type === 'EMAIL'))
  assert.equal(convertBlocked.payload.data.candidates[0].customer.id, existingCustomer.payload.data.id)

  const converted = await request(`/api/leads/${leadId}/convert`, { cookie: sales, method: 'POST', body: { duplicateCheckConfirmed: true, opportunityName: 'Brazil LED Road Project', amount: 250000, currency: 'USD' } })
  assert.equal(converted.response.status, 200)
  assert.equal(converted.payload.data.lead.status, 'CONVERTED')
  assert.ok(converted.payload.data.customer.id)
  assert.ok(converted.payload.data.opportunity.id)

  const convertedAgain = await request(`/api/leads/${leadId}/convert`, { cookie: sales, method: 'POST', body: { duplicateCheckConfirmed: true } })
  assert.equal(convertedAgain.response.status, 400)
  assert.equal(convertedAgain.payload.error.code, 'LEAD_ALREADY_CONVERTED')

  const inquiryStatus = await request(`/api/inquiries/${inquiryId}/status`, { cookie: sales, method: 'POST', body: { status: 'quoting' } })
  assert.equal(inquiryStatus.response.status, 200)
  assert.equal(inquiryStatus.payload.data.status, 'QUOTING')

  const state = testMemoryState()
  assert.equal(state.leads.length, 2)
  assert.equal(state.leadFollowUps.length, 1)
  assert.equal(state.inquiries.length, 1)
  assert.equal(state.inquiryItems.length, 2)
  assert.equal(state.channelMessages.length, 1)
  assert.equal(state.customers.length, 2)
  assert.ok(state.customerFingerprints.length >= 3)
  assert.equal(state.opportunities.length, 1)
  assert.ok(state.auditLogs.filter((item) => ['lead', 'lead_follow_up', 'inquiry', 'inquiry_item', 'channel_message'].includes(item.resource)).length >= 7)

  console.log(JSON.stringify({ result: 'passed', mode: 'acquisition-fingerprint-dedupe', leads: state.leads.length, inquiries: state.inquiries.length, customers: state.customers.length, customerFingerprints: state.customerFingerprints.length, opportunities: state.opportunities.length, inquiryItems: state.inquiryItems.length }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}

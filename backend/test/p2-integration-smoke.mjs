import assert from 'node:assert/strict'
import { once } from 'node:events'

process.env.NODE_ENV = 'test'
process.env.NEXFAB_MEMORY_TEST_DB = 'true'
process.env.NEXFAB_NO_LISTEN = 'true'
process.env.SESSION_SECRET = 'p2-integration-smoke-session-secret-0123456789abcdef'

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
  const manager = await login('manager@nexfab.test')
  const sales = await login('sales@nexfab.test')
  const finance = await login('finance@nexfab.test')
  const exec = await login('exec@nexfab.test')

  const financeNotificationDenied = await request('/api/notifications', { cookie: finance, method: 'POST', body: { recipientId: 'sales-1', title: 'Follow up buyer' } })
  assert.equal(financeNotificationDenied.response.status, 403)

  const notification = await request('/api/notifications', {
    cookie: manager,
    method: 'POST',
    body: {
      recipientId: 'sales-1',
      type: 'automation',
      title: '24h 询盘待跟进',
      body: '请人工确认后跟进客户，不自动发送外部消息。',
      module: 'crm',
      resource: 'opportunity',
      resourceId: 'opp-001',
      priority: 'high',
      metadata: { reason: 'automation_dry_run', token: 'secret-token' },
    },
  })
  assert.equal(notification.response.status, 201)
  assert.equal(notification.payload.data.recipientId, 'sales-1')
  assert.ok(!JSON.stringify(notification.payload.data.metadata).includes('secret-token'))

  const salesNotifications = await request('/api/notifications?pageSize=5', { cookie: sales })
  assert.equal(salesNotifications.response.status, 200)
  assert.equal(salesNotifications.payload.data.total, 1)
  assert.equal(salesNotifications.payload.data.items[0].metadata, undefined)
  assert.equal(salesNotifications.payload.data.items[0].bodyPreview.includes('人工确认'), true)

  const managerNotifications = await request('/api/notifications?pageSize=5', { cookie: manager })
  assert.equal(managerNotifications.response.status, 200)
  assert.equal(managerNotifications.payload.data.total, 0)

  const managerDetailDenied = await request(`/api/notifications/${notification.payload.data.id}`, { cookie: manager })
  assert.equal(managerDetailDenied.response.status, 403)

  const readNotification = await request(`/api/notifications/${notification.payload.data.id}/read`, { cookie: sales, method: 'PATCH' })
  assert.equal(readNotification.response.status, 200)
  assert.equal(readNotification.payload.data.status, 'READ')
  assert.ok(readNotification.payload.data.readAt)

  const financeIntegrationDenied = await request('/api/integration-connections', { cookie: finance })
  assert.equal(financeIntegrationDenied.response.status, 403)

  const inlineSecretDenied = await request('/api/integration-connections', {
    cookie: manager,
    method: 'POST',
    body: {
      code: 'email-primary',
      provider: 'smtp',
      connectorType: 'email',
      displayName: '主邮箱',
      configSummary: { endpoint: 'smtp.example.com', apiKey: 'sk-dangerous-inline-secret' },
    },
  })
  assert.equal(inlineSecretDenied.response.status, 400)
  assert.equal(inlineSecretDenied.payload.error.code, 'INLINE_SECRET_FORBIDDEN')

  const connection = await request('/api/integration-connections', {
    cookie: manager,
    method: 'POST',
    body: {
      code: 'email-primary',
      provider: 'smtp',
      connectorType: 'email',
      displayName: '主邮箱',
      authMode: 'api_key_reference',
      secretRef: 'secret://nexfab/email-primary',
      configSummary: { endpoint: 'smtp.example.com', region: 'cn-east', mode: 'draft-only' },
      fallbackMode: 'draft_export',
    },
  })
  assert.equal(connection.response.status, 201)
  assert.equal(connection.payload.data.status, 'DRAFT')
  assert.equal(connection.payload.data.fallbackMode, 'DRAFT_EXPORT')

  const connectionId = connection.payload.data.id
  const execConnections = await request('/api/integration-connections?pageSize=1', { cookie: exec })
  assert.equal(execConnections.response.status, 200)
  assert.equal(execConnections.payload.data.total, 1)
  assert.equal(execConnections.payload.data.items[0].configSummary, undefined)
  assert.equal(execConnections.payload.data.items[0].hasSecretRef, true)

  const connectionStatus = await request(`/api/integration-connections/${connectionId}/status`, { cookie: manager, method: 'PATCH', body: { status: 'active', healthStatus: 'degraded' } })
  assert.equal(connectionStatus.response.status, 200)
  assert.equal(connectionStatus.payload.data.status, 'ACTIVE')
  assert.equal(connectionStatus.payload.data.healthStatus, 'DEGRADED')

  const salesWebhookDenied = await request('/api/webhook-events', { cookie: sales, method: 'POST', body: { provider: 'smtp', eventType: 'delivered', payload: {} } })
  assert.equal(salesWebhookDenied.response.status, 403)

  const autoProcessDenied = await request('/api/webhook-events', { cookie: manager, method: 'POST', body: { provider: 'smtp', eventType: 'delivered', processNow: true, payload: {} } })
  assert.equal(autoProcessDenied.response.status, 400)
  assert.equal(autoProcessDenied.payload.error.code, 'WEBHOOK_PROCESSING_FORBIDDEN')

  const webhook = await request('/api/webhook-events', {
    cookie: manager,
    method: 'POST',
    body: {
      integrationConnectionId: connectionId,
      provider: 'smtp',
      eventType: 'delivered',
      externalEventId: 'smtp-evt-001',
      idempotencyKey: 'smtp-evt-001',
      payload: { messageId: 'msg-001', authorization: 'Bearer secret-token', status: 'delivered' },
    },
  })
  assert.equal(webhook.response.status, 201)
  assert.equal(webhook.payload.data.status, 'RECEIVED')
  assert.ok(!JSON.stringify(webhook.payload.data.receivedPayloadSummary).includes('secret-token'))

  const duplicateWebhook = await request('/api/webhook-events', {
    cookie: manager,
    method: 'POST',
    body: {
      integrationConnectionId: connectionId,
      provider: 'smtp',
      eventType: 'delivered',
      idempotencyKey: 'smtp-evt-001',
      payload: { messageId: 'msg-001-repeat' },
    },
  })
  assert.equal(duplicateWebhook.response.status, 200)
  assert.equal(duplicateWebhook.payload.data.duplicatePrevented, true)

  const webhookList = await request('/api/webhook-events?provider=SMTP&pageSize=1', { cookie: exec })
  assert.equal(webhookList.response.status, 200)
  assert.equal(webhookList.payload.data.total, 1)
  assert.equal(webhookList.payload.data.items[0].receivedPayloadSummary, undefined)
  assert.deepEqual(webhookList.payload.data.items[0].payloadKeys.sort(), ['authorization', 'messageId', 'status'].sort())

  const webhookDetail = await request(`/api/webhook-events/${webhook.payload.data.id}`, { cookie: manager })
  assert.equal(webhookDetail.response.status, 200)
  assert.equal(webhookDetail.payload.data.integrationConnection.id, connectionId)
  assert.equal(webhookDetail.payload.data.receivedPayloadSummary.authorization, '[redacted]')

  const state = testMemoryState()
  assert.equal(state.notifications.length, 1)
  assert.equal(state.integrationConnections.length, 1)
  assert.equal(state.webhookEvents.length, 1)
  assert.equal(state.auditLogs.filter((item) => ['notification', 'integration_connection', 'webhook_event'].includes(item.resource)).length, 5)

  console.log(JSON.stringify({ result: 'passed', notifications: state.notifications.length, integrationConnections: state.integrationConnections.length, webhookEvents: state.webhookEvents.length, duplicatePrevented: duplicateWebhook.payload.data.duplicatePrevented, connectionStatus: connectionStatus.payload.data.status }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}

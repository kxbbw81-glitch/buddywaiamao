import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'

const root = new URL('../../', import.meta.url)
const backendDir = new URL('backend/', root)
const frontendDir = new URL('frontend/', root)

async function freePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  server.close()
  await once(server, 'close')
  return port
}

function start(command, args, options) {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  child.stdout.on('data', (chunk) => { log += chunk.toString() })
  child.stderr.on('data', (chunk) => { log += chunk.toString() })
  child.log = () => log.slice(-6000)
  return child
}

function ensureFrontendBuild() {
  const buildId = new URL('.next/BUILD_ID', frontendDir)
  if (existsSync(buildId)) return
  const result = spawnSync('npx', ['next', 'build'], {
    cwd: frontendDir,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`next build failed before integration test:
${result.stdout}
${result.stderr}`)
  }
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  const exited = once(child, 'exit').then(() => true)
  const timedOut = new Promise((resolve) => setTimeout(() => resolve(false), 5000))
  if (!(await Promise.race([exited, timedOut]))) {
    child.kill('SIGKILL')
    await once(child, 'exit').catch(() => undefined)
  }
}

async function waitFor(url, attempts = 120) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url)
      if (response.status < 500) return response
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw lastError || new Error(`Timed out waiting for ${url}`)
}

async function request(base, path, { cookie, method = 'GET', body, raw = false } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (raw) return { response, buffer: Buffer.from(await response.arrayBuffer()), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  return { response, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] }
}

async function login(base, email) {
  const result = await request(base, '/api/backend/api/auth/login', { method: 'POST', body: { email, password: 'TestOnly#Password1' } })
  assert.equal(result.response.status, 200)
  assert.ok(result.cookie)
  return result.cookie
}

const componentSource = readFileSync(new URL('../src/components/p1-product-quote-view.tsx', import.meta.url), 'utf8')
for (const expected of ['产品库与资料状态', '快速报价与规则预览', '成本', '毛利率', '锁定 / 触发审批', '获取 PDF', '记录人工发送']) {
  assert.ok(componentSource.includes(expected), `P1.2 UI missing label: ${expected}`)
}
const apiSource = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8')
for (const expected of ['/api/products', '/api/quotes/calculate', '/api/quotes/quick', '/versions/${versionId}/lock', '/pdf', '/send']) {
  assert.ok(apiSource.includes(expected), `P1.2 API client missing endpoint: ${expected}`)
}

const backendPort = await freePort()
const frontendPort = await freePort()
const backend = start(process.execPath, ['src/server.mjs'], {
  cwd: backendDir,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    NEXFAB_MEMORY_TEST_DB: 'true',
    SESSION_SECRET: 'p1-product-quote-secret-0123456789abcdef',
    PORT: String(backendPort),
  },
})
let frontend

try {
  await waitFor(`http://127.0.0.1:${backendPort}/health`)
  ensureFrontendBuild()
  frontend = start('npx', ['next', 'start', '--hostname', '127.0.0.1', '--port', String(frontendPort)], {
    cwd: frontendDir,
    env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${backendPort}`, NEXT_TELEMETRY_DISABLED: '1' },
  })
  const appBase = `http://127.0.0.1:${frontendPort}`
  await waitFor(appBase)

  const manager = await login(appBase, 'manager@nexfab.test')
  const sales = await login(appBase, 'sales@nexfab.test')
  const finance = await login(appBase, 'finance@nexfab.test')

  const nav = await request(appBase, '/api/backend/api/navigation', { cookie: sales })
  assert.equal(nav.response.status, 200)
  assert.ok(nav.payload.data.modules.some((item) => item.id === 'product'))
  assert.ok(nav.payload.data.modules.some((item) => item.id === 'quote'))

  const category = await request(appBase, '/api/backend/api/product-categories', { cookie: manager, method: 'POST', body: { name: 'P1.2 Quote Category' } })
  assert.equal(category.response.status, 201)

  const product = await request(appBase, '/api/backend/api/products', {
    cookie: manager,
    method: 'POST',
    body: {
      sku: 'P12-001',
      name: 'P1.2 Quote Product',
      categoryId: category.payload.data.id,
      specs: { material: 'test-material' },
      packing: { weightKg: 2.5, volumeM3: 0.02, packagingCostCny: 12 },
      costVersions: { currentUnitCostCny: 100 },
    },
  })
  assert.equal(product.response.status, 201)

  const productDoc = await request(appBase, `/api/backend/api/products/${product.payload.data.id}/docs`, { cookie: manager, method: 'POST', body: { type: 'TDS', status: 'REVIEWED', fileUrl: 'https://files.example.test/p12-tds.pdf' } })
  assert.equal(productDoc.response.status, 201)
  assert.equal(productDoc.payload.data.status, 'REVIEWED')

  const productList = await request(appBase, '/api/backend/api/products?pageSize=5', { cookie: sales })
  assert.equal(productList.response.status, 200)
  assert.ok(productList.payload.data.items.some((item) => item.id === product.payload.data.id))

  const salesProductWrite = await request(appBase, '/api/backend/api/products', { cookie: sales, method: 'POST', body: { sku: 'P12-DENY', name: 'Denied Product', categoryId: category.payload.data.id, specs: {}, packing: {}, costVersions: {} } })
  assert.equal(salesProductWrite.response.status, 403)

  const financeProducts = await request(appBase, '/api/backend/api/products', { cookie: finance })
  assert.equal(financeProducts.response.status, 403)

  const customer = await request(appBase, '/api/backend/api/customers', { cookie: sales, method: 'POST', body: { name: 'P1.2 Quote Buyer', country: 'US' } })
  assert.equal(customer.response.status, 201)

  const calculated = await request(appBase, '/api/backend/api/quotes/calculate', {
    cookie: sales,
    method: 'POST',
    body: {
      customerId: customer.payload.data.id,
      tradeTerm: 'DDP',
      rules: {
        currency: 'USD',
        fxRateCnyPerUsd: 7.85,
        marginRate: 0.3,
        minimumMarginRate: 0.15,
        charges: { internationalFreightUsd: 80, destinationPortChargesUsd: 150, customsClearanceUsd: 100, dutyRate: 0.05, deliveryFeeUsd: 200 },
      },
      items: [{ productId: product.payload.data.id, quantity: 10 }],
    },
  })
  assert.equal(calculated.response.status, 200)
  assert.equal(calculated.payload.data.tradeTerm, 'DDP')
  assert.ok(Number.isFinite(calculated.payload.data.totals.ddpTotal))
  assert.ok(calculated.payload.data.totals.ddpTotal > calculated.payload.data.totals.cifTotal)
  assert.equal(calculated.payload.data.approval.required, false)

  const invalidTextCharge = await request(appBase, '/api/backend/api/quotes/calculate', { cookie: sales, method: 'POST', body: { tradeTerm: 'DDP', rules: { charges: { dutyRate: 'DHL' } }, items: [{ productId: product.payload.data.id, quantity: 1 }] } })
  assert.equal(invalidTextCharge.response.status, 400)

  const quote = await request(appBase, '/api/backend/api/quotes/quick', {
    cookie: sales,
    method: 'POST',
    body: {
      customerId: customer.payload.data.id,
      currency: calculated.payload.data.currency,
      notes: 'P1.2 frontend quote',
      items: [{ productId: product.payload.data.id, sku: product.payload.data.sku, name: product.payload.data.name, quantity: 10, unitPrice: calculated.payload.data.totals.selectedUnitPrice, unitCost: calculated.payload.data.lines[0].unitCostUsd }],
    },
  })
  assert.equal(quote.response.status, 201)
  const version = quote.payload.data.versions[0]
  assert.ok(version.id)

  const unlockedPdf = await request(appBase, `/api/backend/api/quotes/${quote.payload.data.id}/versions/${version.id}/pdf`, { cookie: sales })
  assert.equal(unlockedPdf.response.status, 400)

  const locked = await request(appBase, `/api/backend/api/quotes/${quote.payload.data.id}/versions/${version.id}/lock`, { cookie: sales, method: 'POST', body: { minimumMarginRate: 0.15, validityDays: 30 } })
  assert.equal(locked.response.status, 200)
  assert.equal(locked.payload.data.lockStatus, 'LOCKED')

  const pdf = await request(appBase, `/api/backend/api/quotes/${quote.payload.data.id}/versions/${version.id}/pdf`, { cookie: sales, raw: true })
  assert.equal(pdf.response.status, 200)
  assert.equal(pdf.response.headers.get('content-type'), 'application/pdf')
  assert.equal(pdf.buffer.subarray(0, 4).toString('utf8'), '%PDF')

  const missingSendConfirmation = await request(appBase, `/api/backend/api/quotes/${quote.payload.data.id}/send`, { cookie: sales, method: 'POST', body: { versionId: version.id, channel: 'EMAIL', recipient: 'buyer@example.test' } })
  assert.equal(missingSendConfirmation.response.status, 400)

  const sent = await request(appBase, `/api/backend/api/quotes/${quote.payload.data.id}/send`, {
    cookie: sales,
    method: 'POST',
    body: { versionId: version.id, channel: 'EMAIL', recipient: 'buyer@example.test', subject: 'P1.2 quote', message: 'Manual send confirmed by user.', confirmedExternalSend: true },
  })
  assert.equal(sent.response.status, 200)
  assert.equal(sent.payload.data.status, 'SENT_RECORDED')

  const financeCalculate = await request(appBase, '/api/backend/api/quotes/calculate', { cookie: finance, method: 'POST', body: { tradeTerm: 'FOB', items: [{ productId: product.payload.data.id, quantity: 1 }] } })
  assert.equal(financeCalculate.response.status, 403)

  console.log(JSON.stringify({ result: 'passed', mode: 'p1-product-quote-frontend', productDocs: 1, tradeTerm: calculated.payload.data.tradeTerm, ddpTotal: calculated.payload.data.totals.ddpTotal, quoteStatus: 'SENT_RECORDED', pdfBytes: pdf.buffer.length, financeProducts: 403, financeCalculate: 403, salesProductWrite: 403 }))
} catch (error) {
  console.error('backend log:\n' + backend.log())
  if (frontend) console.error('frontend log:\n' + frontend.log())
  throw error
} finally {
  await stopProcess(frontend)
  await stopProcess(backend)
}

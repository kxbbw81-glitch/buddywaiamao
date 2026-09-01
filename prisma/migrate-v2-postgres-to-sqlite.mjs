import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const CONFIRMATION = 'IMPORT_V2_DATA'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} 未配置`)
  return value
}

function readEnvValue(file, name) {
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`))
  if (!line) return null
  return line.slice(name.length + 1).replace(/^['"]|['"]$/g, '')
}

function number(value, fallback = 0) {
  const parsed = Number(value?.toString?.() ?? value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function json(value, fallback = '[]') {
  try { return JSON.stringify(value ?? JSON.parse(fallback)) } catch { return fallback }
}

function role(role) {
  return ({ ADMIN: 'super_admin', MANAGER: 'sales_manager', FINANCE: 'finance', EXEC: 'management', SALES: 'sales' })[role] || 'sales'
}

function dataScope(primaryRole) {
  if (primaryRole === 'super_admin') return 'super'
  if (['sales_manager', 'management', 'finance'].includes(primaryRole)) return 'global'
  return 'personal'
}

function quotationStatus(status) {
  return ({ DRAFT: 'draft', SENT: 'sent', ACCEPTED: 'accepted', REJECTED: 'rejected', EXPIRED: 'expired' })[status] || 'draft'
}

function opportunityStage(stage) {
  return ({ NEW: 'prospect', QUOTED: 'proposal', SAMPLE: 'negotiation', NEGOTIATION: 'negotiation', WON: 'won', LOST: 'lost' })[stage] || 'prospect'
}

function inquiryStatus(status) {
  return ({ NEW: 'new', ASSIGNED: 'assigned', FOLLOWING: 'following', QUOTED: 'quoted', WON: 'won', LOST: 'lost', CLOSED: 'closed' })[status] || 'new'
}

function orderStatus(status) {
  return ({ DRAFT: 'pending', CONFIRMED: 'confirmed', CANCELLED: 'cancelled' })[status] || 'pending'
}

function paymentStatus(status) {
  return ({ REGISTERED: 'pending', CONFIRMED: 'completed', REJECTED: 'pending' })[status] || 'pending'
}

function legacyPiiKey(secret) {
  const raw = secret.trim()
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex')
  const decoded = Buffer.from(raw, 'base64url')
  if (decoded.length === 32) return decoded
  return createHash('sha256').update(raw).digest()
}

function decryptLegacyPii(ciphertext, legacyValue, secret) {
  if (!ciphertext) return legacyValue || null
  const [version, ivEncoded, tagEncoded, dataEncoded] = String(ciphertext).split('.')
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !dataEncoded) throw new Error('旧 PII 密文格式无效')
  const decipher = createDecipheriv('aes-256-gcm', legacyPiiKey(secret), Buffer.from(ivEncoded, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataEncoded, 'base64url')), decipher.final()]).toString('utf8')
}

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

function normalizePhone(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const plus = raw.startsWith('+') ? '+' : ''
  const digits = raw.replace(/[^\d]/g, '')
  return digits.length >= 6 ? `${plus}${digits}` : null
}

function encryptTargetPii(value) {
  if (!value) return null
  const secret = required('PII_ENCRYPTION_KEY')
  const key = /^[a-f0-9]{64}$/i.test(secret) ? Buffer.from(secret, 'hex') : scryptSync(secret, 'nexfab-contact-pii-v1', 32)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64')}:${ciphertext.toString('base64')}:${cipher.getAuthTag().toString('base64')}`
}

function targetPiiHash(kind, value) {
  return value ? createHmac('sha256', required('PII_ENCRYPTION_KEY')).update(`${kind}:${value}`).digest('hex') : null
}

function encryptedContact(input) {
  const email = normalizeEmail(input.email)
  const phone = normalizePhone(input.phone)
  const whatsapp = normalizePhone(input.whatsapp)
  return {
    ...input,
    email: null,
    phone: null,
    whatsapp: null,
    emailCiphertext: encryptTargetPii(email),
    phoneCiphertext: encryptTargetPii(phone),
    whatsappCiphertext: encryptTargetPii(whatsapp),
    emailHash: targetPiiHash('EMAIL', email),
    phoneHash: targetPiiHash('PHONE', phone),
    whatsappHash: targetPiiHash('WHATSAPP', whatsapp),
  }
}

function targetCounts(db) {
  return Promise.all([db.user.count(), db.customer.count(), db.contact.count(), db.quotation.count(), db.order.count()])
}

async function main() {
  const apply = process.env.NEXFAB_CONFIRM_V2_IMPORT === CONFIRMATION
  const legacyEnvFile = required('LEGACY_ENV_FILE')
  const legacyDatabaseUrl = readEnvValue(legacyEnvFile, 'DATABASE_URL')
  const legacyPiiSecret = readEnvValue(legacyEnvFile, 'PII_ENCRYPTION_KEY') || readEnvValue(legacyEnvFile, 'ENCRYPTION_KEY')
  if (!legacyDatabaseUrl || !legacyPiiSecret) throw new Error('旧环境缺少 DATABASE_URL 或 PII_ENCRYPTION_KEY')
  const legacyClientPath = required('LEGACY_PRISMA_CLIENT')
  const { PrismaClient: LegacyPrismaClient } = await import(legacyClientPath)
  const source = new LegacyPrismaClient({ datasources: { db: { url: legacyDatabaseUrl } } })
  const target = new PrismaClient()

  try {
    const sourceCounts = {
      users: await source.user.count(), customers: await source.customer.count(), contacts: await source.contact.count(),
      opportunities: await source.opportunity.count(), quotes: await source.quote.count(), orders: await source.salesOrder.count(),
      payments: await source.orderPayment.count(), samples: await source.sampleRequest.count(), auditLogs: await source.auditLog.count(),
    }
    const [targetUsers, targetCustomers, targetContacts, targetQuotations, targetOrders] = await targetCounts(target)
    if (targetUsers || targetCustomers || targetContacts || targetQuotations || targetOrders) throw new Error('目标 SQLite 不是空库，拒绝覆盖已有数据')
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', source: sourceCounts, targetEmpty: true }))
    if (!apply) return

    const [teams, sourceUsers, categories, products, docs, sourceCustomers, sourceContacts, opportunities, inquiries, leads, quoteRows, quoteVersions, approvals, sampleRows, orderRows, orderItems, fulfillmentEvents, payments, documents, shipments, communicationEvents, leadFollowUps, followUps, channelMessages] = await Promise.all([
      source.team.findMany(), source.user.findMany(), source.productCategory.findMany(), source.product.findMany(), source.productDoc.findMany(),
      source.customer.findMany(), source.contact.findMany(), source.opportunity.findMany(), source.inquiry.findMany(), source.lead.findMany(),
      source.quote.findMany(), source.quoteVersion.findMany(), source.quoteApproval.findMany(), source.sampleRequest.findMany({ include: { product: { select: { name: true, sku: true } } } }),
      source.salesOrder.findMany(), source.orderItem.findMany(), source.fulfillmentEvent.findMany(), source.orderPayment.findMany(),
      source.tradeDocument.findMany(), source.shipment.findMany(), source.communicationEvent.findMany(), source.leadFollowUp.findMany(), source.followUp.findMany(), source.channelMessage.findMany(),
    ])

    await target.$transaction(async (tx) => {
      for (const row of teams) await tx.team.create({ data: { id: row.id, name: row.name, leaderId: row.managerId } })
      for (const row of sourceUsers) {
        const primaryRole = role(row.role)
        if (!row.passwordHash) throw new Error('发现无密码哈希的旧账号，拒绝迁移认证数据')
        const passwordHash = row.passwordHash.includes(':') && !row.passwordHash.startsWith('scrypt:') ? `scrypt:${row.passwordHash}` : row.passwordHash
        await tx.user.create({ data: { id: row.id, email: row.email, name: row.name, passwordHash, primaryRole, dataScope: dataScope(primaryRole), teamId: row.teamId, isActive: row.status === 'ACTIVE', createdAt: row.createdAt } })
      }
      for (const row of categories) await tx.productCategory.create({ data: { ...row } })
      for (const row of products) await tx.product.create({ data: { id: row.id, productCode: row.sku, name: row.name, categoryId: row.categoryId, specs: row.specs, packing: row.packing, costVersions: row.costVersions, isActive: row.active, createdAt: row.createdAt, updatedAt: row.updatedAt } })
      for (const row of docs) await tx.productDoc.create({ data: { ...row } })
      for (const row of sourceCustomers) await tx.customer.create({ data: { id: row.id, companyName: row.name, country: row.country, website: row.website, ownerId: row.ownerId, createdAt: row.createdAt, updatedAt: row.updatedAt } })
      for (const row of sourceContacts) {
        const email = decryptLegacyPii(row.emailCiphertext, row.email, legacyPiiSecret)
        const phone = decryptLegacyPii(row.phoneCiphertext, row.phone, legacyPiiSecret)
        await tx.contact.create({ data: { id: row.id, ...encryptedContact({ customerId: row.customerId, name: row.name, position: row.title, email, phone, createdAt: row.createdAt, updatedAt: row.createdAt }) } })
      }
      for (const row of opportunities) await tx.opportunity.create({ data: { id: row.id, customerId: row.customerId, ownerId: row.ownerId, title: row.name, stage: opportunityStage(row.stage), amount: number(row.amount), currency: row.currency, createdAt: row.createdAt, updatedAt: row.updatedAt } })
      for (const row of inquiries) await tx.inquiry.create({ data: { id: row.id, inquiryNo: row.code, customerId: row.customerId, source: row.source, subject: row.subject, content: row.content, language: row.language || 'en', status: inquiryStatus(row.status), priority: String(row.priority || 'normal').toLowerCase(), assignedTo: row.ownerId, assignedAt: row.createdAt, createdAt: row.createdAt, updatedAt: row.updatedAt } })
      for (const row of leads) {
        let customerId = row.convertedCustomerId
        if (!customerId) {
          customerId = `legacy-lead-${row.id}`
          await tx.customer.create({ data: { id: customerId, companyName: row.companyName, country: row.country, source: 'legacy_lead', status: 'prospect', ownerId: row.ownerId || row.createdById, createdAt: row.createdAt, updatedAt: row.updatedAt } })
        }
        const email = decryptLegacyPii(row.emailCiphertext, row.email, legacyPiiSecret)
        const phone = decryptLegacyPii(row.phoneCiphertext, row.phone, legacyPiiSecret)
        if (row.contactName && (email || phone)) await tx.contact.create({ data: { id: `legacy-lead-contact-${row.id}`, ...encryptedContact({ customerId, name: row.contactName, email, phone, createdAt: row.createdAt, updatedAt: row.updatedAt }) } })
        await tx.inquiry.create({ data: { id: `legacy-lead-inquiry-${row.id}`, inquiryNo: `LEAD-${row.code}`, customerId, source: row.source, subject: `历史线索：${row.companyName}`, content: json({ channel: row.channel, productInterest: row.productInterest, estimatedQuantity: row.estimatedQuantity, buyerRole: row.buyerRole }), language: row.language || 'en', status: inquiryStatus(row.status), priority: String(row.priority || 'normal').toLowerCase(), assignedTo: row.ownerId || row.createdById, createdAt: row.createdAt, updatedAt: row.updatedAt } })
      }
      for (const row of quoteRows) await tx.quotation.create({ data: { id: row.id, quoteNo: `LEGACY-${row.id}`, customerId: row.customerId, currency: row.currency, status: quotationStatus(row.status), totalAmount: number(row.totalAmount), totalCost: number(row.totalCost), profitRate: number(row.grossMargin), notes: row.notes, createdById: row.createdById, ownerId: row.ownerId, createdAt: row.createdAt, updatedAt: row.updatedAt } })
      for (const row of quoteVersions) {
        await tx.quoteVersion.create({ data: { id: row.id, quotationId: row.quoteId, version: row.version, itemsJson: json(row.items), totalAmount: number(row.totalAmount), totalCost: number(row.totalCost), grossMargin: number(row.grossMargin), notes: row.notes, createdById: row.createdById, createdAt: row.createdAt } })
        const items = Array.isArray(row.items) ? row.items : []
        for (let index = 0; index < items.length; index++) {
          const item = items[index] || {}
          await tx.quotationItem.create({ data: { id: `${row.id}-item-${index}`, quotationId: row.quoteId, productId: item.productId || null, productName: item.name || item.productName || item.sku || '历史报价项', productSpec: item.specification || item.spec || null, quantity: Math.max(1, Math.round(number(item.quantity, 1))), unit: item.unit || 'PCS', unitPrice: number(item.unitPrice), cost: number(item.unitCost ?? item.cost), totalPrice: number(item.amount ?? item.totalPrice) } })
        }
      }
      for (const row of approvals) await tx.approval.create({ data: { id: row.id, type: row.type, refId: row.quoteId, requester: row.requestedById, approver: row.decidedById, status: row.status, aiRisk: row.reason, createdAt: row.createdAt, updatedAt: row.updatedAt } })
      for (const row of orderRows) await tx.order.create({ data: { id: row.id, orderNo: row.orderNo, quotationId: row.quoteId, customerId: row.customerId, totalAmount: number(row.totalAmount), currency: row.currency, status: orderStatus(row.status), paymentStatus: String(row.paymentStatus || 'UNPAID').toLowerCase(), fulfillmentStatus: String(row.fulfillmentStatus || 'PENDING').toLowerCase(), createdById: row.createdById, createdAt: row.createdAt, updatedAt: row.updatedAt } })
      for (const row of orderItems) await tx.orderItem.create({ data: { id: row.id, orderId: row.salesOrderId, productId: row.productId, sku: row.sku, name: row.name, quantity: number(row.quantity, 1), unitPrice: number(row.unitPrice), unitCost: number(row.unitCost), amount: number(row.amount), cost: number(row.cost), snapshotJson: json(row.snapshot, '{}') } })
      for (const row of fulfillmentEvents) await tx.fulfillmentEvent.create({ data: { id: row.id, orderId: row.salesOrderId, type: row.type, note: row.note, createdById: row.createdById, createdAt: row.createdAt } })
      for (const row of payments) await tx.payment.create({ data: { id: row.id, orderId: row.salesOrderId, amount: number(row.amount), currency: row.currency, status: paymentStatus(row.status), paymentDate: row.receivedAt, notes: row.note, createdAt: row.createdAt, updatedAt: row.updatedAt } })
      for (const row of sampleRows) await tx.sample.create({ data: { id: row.id, customerId: row.customerId, productName: row.product?.name || row.product?.sku || '历史样品', quantity: Math.max(1, Math.round(number(row.quantity, 1))), status: String(row.status || 'pending').toLowerCase(), trackingNo: row.trackingNo, shippingMethod: row.courier, testResult: json(row.feedback, '{}'), createdAt: row.createdAt, updatedAt: row.updatedAt } })
      const activities = [
        ...documents.map((row) => ({ id: `legacy-doc-${row.id}`, type: 'legacy_trade_document', subject: `${row.type} ${row.documentNo}`, content: json({ version: row.version, status: row.status, currency: row.currency, totalAmount: number(row.totalAmount) }, '{}'), entityType: 'order', entityId: row.salesOrderId, userId: row.createdById, createdAt: row.createdAt })),
        ...shipments.map((row) => ({ id: `legacy-shipment-${row.id}`, type: 'legacy_shipment', subject: row.transportMode, content: json({ status: row.status, carrier: row.carrier, trackingNo: row.trackingNo, bookingNo: row.bookingNo, billOfLadingNo: row.billOfLadingNo, etd: row.etd, atd: row.atd, eta: row.eta }, '{}'), entityType: 'order', entityId: row.salesOrderId, userId: row.createdById, createdAt: row.createdAt })),
        ...communicationEvents.map((row) => ({ id: `legacy-comms-${row.id}`, type: String(row.type).toLowerCase(), subject: row.summary, content: null, entityType: 'customer', entityId: row.customerId, userId: row.createdById, createdAt: row.occurredAt })),
        ...leadFollowUps.map((row) => ({ id: `legacy-lead-followup-${row.id}`, type: String(row.type).toLowerCase(), subject: '历史线索跟进', content: row.content, entityType: 'inquiry', entityId: `legacy-lead-inquiry-${row.leadId}`, userId: row.authorId, createdAt: row.createdAt })),
        ...followUps.map((row) => ({ id: `legacy-followup-${row.id}`, type: String(row.type).toLowerCase(), subject: '历史跟进', content: row.content, entityType: 'opportunity', entityId: row.opportunityId, userId: row.createdById, createdAt: row.createdAt })),
        ...channelMessages.map((row) => ({ id: `legacy-channel-message-${row.id}`, type: row.channel || 'legacy_channel', subject: row.direction, content: row.content, entityType: 'inquiry', entityId: row.inquiryId, userId: row.createdById, createdAt: row.occurredAt })),
      ]
      for (const row of activities) await tx.activity.create({ data: row })
    }, { timeout: 120000 })

    const targetCountsAfter = { users: await target.user.count(), customers: await target.customer.count(), contacts: await target.contact.count(), quotations: await target.quotation.count(), orders: await target.order.count(), contactPlaintext: await target.contact.count({ where: { OR: [{ email: { not: null } }, { phone: { not: null } }, { whatsapp: { not: null } }] } }) }
    if (targetCountsAfter.contactPlaintext !== 0) throw new Error('迁移后检测到联系人明文，拒绝发布')
    console.log(JSON.stringify({ mode: 'apply', migrated: targetCountsAfter, auditLogsRetainedInPostgresBackup: sourceCounts.auditLogs }))
  } finally {
    await source.$disconnect()
    await target.$disconnect()
  }
}

main().catch((error) => { console.error(`migration failed: ${error.message}`); process.exit(1) })

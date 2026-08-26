import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from 'node:crypto'
import { HttpError } from './http.mjs'

const VERSION = 'v1'
const ALG = 'aes-256-gcm'

function encryptionKey() {
  const value = process.env.PII_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
  if (value) {
    const raw = value.trim()
    if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex')
    const decoded = Buffer.from(raw, 'base64url')
    if (decoded.length === 32) return decoded
    return createHash('sha256').update(raw).digest()
  }
  if (process.env.NODE_ENV === 'test') return createHash('sha256').update('nexfab-memory-pii-test-key').digest()
  throw new HttpError(503, 'PII_ENCRYPTION_NOT_CONFIGURED', 'PII 加密服务尚未配置。')
}
function blank(value) { return value == null || value === '' }

export function normalizePiiEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}
export function normalizePiiPhone(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const plus = raw.startsWith('+') ? '+' : ''
  const digits = raw.replace(/[^\d]/g, '')
  return digits.length >= 6 ? `${plus}${digits}` : null
}
export function piiHash(kind, value) {
  if (blank(value)) return null
  const normalized = kind === 'EMAIL' ? normalizePiiEmail(value) : kind === 'PHONE' ? normalizePiiPhone(value) : String(value).trim().toLowerCase()
  if (!normalized) return null
  return createHmac('sha256', encryptionKey()).update(`${kind}:${normalized}`).digest('hex')
}
export function maskEmail(value) {
  const email = normalizePiiEmail(value)
  if (!email) return null
  const [local, domain] = email.split('@')
  return `${local.slice(0, Math.min(2, local.length)) || '*'}***@${domain}`
}
export function maskPhone(value) {
  const phone = normalizePiiPhone(value)
  if (!phone) return null
  return `${phone.startsWith('+') ? '+' : ''}***${phone.slice(-4)}`
}
export function encryptPii(value) {
  if (blank(value)) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALG, encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${VERSION}.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`
}
export function decryptPii(ciphertext, legacyValue = null) {
  if (!ciphertext) return legacyValue || null
  const [version, ivEncoded, tagEncoded, dataEncoded] = String(ciphertext).split('.')
  if (version !== VERSION || !ivEncoded || !tagEncoded || !dataEncoded) throw new HttpError(500, 'PII_DECRYPT_FAILED', 'PII 密文格式无效。')
  try {
    const decipher = createDecipheriv(ALG, encryptionKey(), Buffer.from(ivEncoded, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(dataEncoded, 'base64url')), decipher.final()]).toString('utf8')
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(500, 'PII_DECRYPT_FAILED', 'PII 解密失败。')
  }
}
function encryptedPayload(data) {
  const email = normalizePiiEmail(data.email)
  const phone = normalizePiiPhone(data.phone)
  return {
    email: null,
    phone: null,
    emailCiphertext: email ? encryptPii(email) : null,
    phoneCiphertext: data.phone ? encryptPii(data.phone) : null,
    emailHash: email ? piiHash('EMAIL', email) : null,
    phoneHash: phone ? piiHash('PHONE', phone) : null,
  }
}
export function prepareEncryptedContact(data) { return { ...data, ...encryptedPayload(data) } }
export function prepareEncryptedLead(data) { return { ...data, ...encryptedPayload(data) } }
function hasAny(row, fields) {
  return fields.some((field) => Object.prototype.hasOwnProperty.call(row, field))
}

export function revealEncryptedContact(row) {
  if (!row) return row
  const next = { ...row }
  if (hasAny(row, ['email', 'emailCiphertext', 'emailEncrypted'])) next.email = decryptPii(row.emailCiphertext || row.emailEncrypted, row.email)
  if (hasAny(row, ['phone', 'phoneCiphertext', 'phoneEncrypted'])) next.phone = decryptPii(row.phoneCiphertext || row.phoneEncrypted, row.phone)
  delete next.emailCiphertext
  delete next.phoneCiphertext
  delete next.emailEncrypted
  delete next.phoneEncrypted
  delete next.emailHash
  delete next.phoneHash
  return next
}

export function revealEncryptedLead(row) {
  if (!row) return row
  const next = { ...row }
  if (hasAny(row, ['email', 'emailCiphertext', 'emailEncrypted'])) next.email = decryptPii(row.emailCiphertext || row.emailEncrypted, row.email)
  if (hasAny(row, ['phone', 'phoneCiphertext', 'phoneEncrypted'])) next.phone = decryptPii(row.phoneCiphertext || row.phoneEncrypted, row.phone)
  delete next.emailCiphertext
  delete next.phoneCiphertext
  delete next.emailEncrypted
  delete next.phoneEncrypted
  delete next.emailHash
  delete next.phoneHash
  return next
}

export function publicPiiStorageSummary(row) {
  return { emailEncrypted: Boolean(row?.emailCiphertext || row?.emailEncrypted), phoneEncrypted: Boolean(row?.phoneCiphertext || row?.phoneEncrypted), emailHashPresent: Boolean(row?.emailHash), phoneHashPresent: Boolean(row?.phoneHash) }
}
export function protectPiiFields(data, fields) {
  const next = { ...data }
  for (const field of fields) {
    next[`${field}Ciphertext`] = encryptPii(next[field])
    next[`${field}Hash`] = field === 'email' ? piiHash('EMAIL', next[field]) : field === 'phone' ? piiHash('PHONE', next[field]) : null
    next[field] = null
  }
  return next
}
export function revealPiiFields(row, fields) {
  if (!row) return row
  const next = { ...row }
  for (const field of fields) {
    next[field] = decryptPii(next[`${field}Ciphertext`] || next[`${field}Encrypted`], next[field])
  }
  return next
}

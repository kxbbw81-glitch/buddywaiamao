import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'node:crypto'
import type { Prisma } from '@prisma/client'

const SALT = 'nexfab-contact-pii-v1'

function getPiiSecret(): string {
  const secret = process.env.PII_ENCRYPTION_KEY
  // 修复说明：[P0-PII 密钥]，原因：联系人 PII 不能复用公开默认值或会话密钥；生产迁移和运行必须显式配置独立 PII_ENCRYPTION_KEY。
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('PII_ENCRYPTION_KEY 未配置')
  return secret || 'nexfab-dev-contact-pii-key'
}

function getPiiKey(): Buffer {
  const secret = getPiiSecret()
  return /^[a-f0-9]{64}$/i.test(secret) ? Buffer.from(secret, 'hex') : scryptSync(secret, SALT, 32)
}

function encryptPii(value: string | null) {
  if (!value) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getPiiKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64')}:${ciphertext.toString('base64')}:${cipher.getAuthTag().toString('base64')}`
}

function decryptPii(value: unknown) {
  const encoded = typeof value === 'string' ? value : ''
  if (!encoded) return null
  try {
    const parts = encoded.split(':')
    const [, ivEncoded, dataEncoded, tagEncoded] =
      parts.length === 4 && parts[0] === 'v1' ? parts : ['', parts[0], parts[1], parts[2]]
    if (!ivEncoded || !dataEncoded || !tagEncoded) return null
    const decipher = createDecipheriv('aes-256-gcm', getPiiKey(), Buffer.from(ivEncoded, 'base64'))
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(dataEncoded, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

function normalizeEmail(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

function normalizePhone(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const plus = raw.startsWith('+') ? '+' : ''
  const digits = raw.replace(/[^\d]/g, '')
  return digits.length >= 6 ? `${plus}${digits}` : null
}

function piiHash(kind: string, value: string | null) {
  if (!value) return null
  return createHmac('sha256', getPiiSecret()).update(`${kind}:${value}`).digest('hex')
}

export function prepareEncryptedContact(input: Record<string, unknown>): Prisma.ContactUncheckedCreateInput {
  const email = normalizeEmail(input.email)
  const phone = normalizePhone(input.phone)
  const whatsapp = normalizePhone(input.whatsapp)
  return {
    ...input,
    email: null,
    phone: null,
    whatsapp: null,
    emailCiphertext: encryptPii(email),
    phoneCiphertext: encryptPii(phone),
    whatsappCiphertext: encryptPii(whatsapp),
    emailHash: piiHash('EMAIL', email),
    phoneHash: piiHash('PHONE', phone),
    whatsappHash: piiHash('WHATSAPP', whatsapp),
  } as Prisma.ContactUncheckedCreateInput
}

export function prepareEncryptedContactPatch(input: Record<string, unknown>) {
  const patch: Record<string, unknown> = {}
  for (const [field, kind, normalize] of [
    ['email', 'EMAIL', normalizeEmail],
    ['phone', 'PHONE', normalizePhone],
    ['whatsapp', 'WHATSAPP', normalizePhone],
  ] as const) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue
    const value = normalize(input[field])
    patch[field] = null
    patch[`${field}Ciphertext`] = encryptPii(value)
    patch[`${field}Hash`] = piiHash(kind, value)
  }
  return patch
}

export function revealEncryptedContact<T extends Record<string, unknown>>(contact: T): Omit<T, 'emailCiphertext' | 'phoneCiphertext' | 'whatsappCiphertext' | 'emailHash' | 'phoneHash' | 'whatsappHash'> & { email: string | null; phone: string | null; whatsapp: string | null } {
  const result = {
    ...contact,
    // 修复说明：[P0-PII 兼容迁移]，原因：历史 SQLite 明文联系人在 backfill 前仍需授权可读；密文优先，缺密文时只兼容返回旧明文字段。
    email: decryptPii(contact.emailCiphertext) || contact.email || null,
    phone: decryptPii(contact.phoneCiphertext) || contact.phone || null,
    whatsapp: decryptPii(contact.whatsappCiphertext) || contact.whatsapp || null,
  } as Record<string, unknown>
  delete result.emailCiphertext
  delete result.phoneCiphertext
  delete result.whatsappCiphertext
  delete result.emailHash
  delete result.phoneHash
  delete result.whatsappHash
  return result as Omit<T, 'emailCiphertext' | 'phoneCiphertext' | 'whatsappCiphertext' | 'emailHash' | 'phoneHash' | 'whatsappHash'> & { email: string | null; phone: string | null; whatsapp: string | null }
}

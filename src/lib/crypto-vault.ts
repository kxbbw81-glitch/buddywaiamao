import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from 'node:crypto'

/**
 * AES-256-GCM 加密封装（用于 AI Provider apiKey 等敏感字段）
 * 密钥从 AUTH_SECRET 派生（scrypt），salt 固定常量。
 * 输出格式：base64(iv):base64(ciphertext):base64(authTag)
 */

const SALT = 'nexfab-ai-key-salt-v1'
const KEY_LEN = 32

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  // 修复说明：[P0-密钥安全]，原因：生产环境缺少 AUTH_SECRET 时回退公开默认值会使 AI Provider 密钥可被离线解密；生产必须显式配置密钥。
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET 未配置')
  return scryptSync(secret || 'nexfab-dev-secret-change-in-production', SALT, KEY_LEN)
}

export function encrypt(plain: string): string {
  if (!plain) return ''
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${ct.toString('base64')}:${tag.toString('base64')}`
}

export function decrypt(enc: string): string {
  if (!enc) return ''
  try {
    const [ivB64, ctB64, tagB64] = enc.split(':')
    if (!ivB64 || !ctB64 || !tagB64) return ''
    const key = getKey()
    const iv = Buffer.from(ivB64, 'base64')
    const ct = Buffer.from(ctB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ct), decipher.final()])
    return plain.toString('utf8')
  } catch {
    return ''
  }
}

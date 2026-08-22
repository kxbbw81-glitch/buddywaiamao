import { db } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto-vault'

/**
 * AI 配置（V3.12 第九章）：
 * - 多实例 AiProviderConfig（apiKey AES-256-GCM 加密，按账号隔离）
 * - 兼容旧 AiSetting key-value（getAiConfig/saveAiConfig 保留，回退用）
 */

export interface AiConfig {
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  configured: boolean
}

const DEFAULTS = {
  provider: 'openai-compatible',
  baseUrl: '',
  model: 'gpt-4o-mini',
  apiKey: '',
}

const KEYS = {
  provider: 'ai.provider',
  baseUrl: 'ai.baseUrl',
  model: 'ai.model',
  apiKey: 'ai.apiKey',
} as const

// ============ 兼容：key-value 单配置（回退） ============

export async function getAiConfig(): Promise<AiConfig> {
  const rows = await db.aiSetting.findMany({ where: { key: { in: Object.values(KEYS) } } })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const provider = map.get(KEYS.provider) || DEFAULTS.provider
  const baseUrl = map.get(KEYS.baseUrl) || process.env.AI_BASE_URL || DEFAULTS.baseUrl
  const model = map.get(KEYS.model) || process.env.AI_MODEL || DEFAULTS.model
  const apiKey = map.get(KEYS.apiKey) || process.env.AI_API_KEY || DEFAULTS.apiKey
  return {
    provider,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
    apiKey,
    configured: Boolean(apiKey && baseUrl),
  }
}

export async function saveAiConfig(patch: Partial<Record<'provider' | 'baseUrl' | 'model' | 'apiKey', string>>): Promise<void> {
  const entries: Array<[string, string]> = []
  if (patch.provider !== undefined) entries.push([KEYS.provider, patch.provider])
  if (patch.baseUrl !== undefined) entries.push([KEYS.baseUrl, patch.baseUrl.replace(/\/+$/, '')])
  if (patch.model !== undefined) entries.push([KEYS.model, patch.model])
  if (patch.apiKey !== undefined && patch.apiKey !== '') entries.push([KEYS.apiKey, patch.apiKey])
  for (const [key, value] of entries) {
    await db.aiSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
  }
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '****'
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`
}

// ============ 多实例 AiProviderConfig ============

export interface AiProviderConfigPublic {
  id: string
  ownerId: string
  name: string
  provider: string
  baseUrl: string
  model: string
  apiKeyMasked: string
  temperature: number
  enabled: boolean
  isDefault: boolean
  lastTestedAt: string | null
  lastTestOk: boolean | null
  createdAt: string
}

interface ProviderConfigRow {
  id: string; ownerId: string; name: string; provider: string; baseUrl: string; model: string;
  apiKeyEncrypted: string; temperature: number; enabled: boolean; isDefault: boolean;
  lastTestedAt: Date | null; lastTestOk: boolean | null; createdAt: Date;
}

export function toPublicProviderConfig(c: ProviderConfigRow): AiProviderConfigPublic {
  const plain = decrypt(c.apiKeyEncrypted)
  return {
    id: c.id, ownerId: c.ownerId, name: c.name, provider: c.provider, baseUrl: c.baseUrl, model: c.model,
    apiKeyMasked: maskApiKey(plain), temperature: c.temperature, enabled: c.enabled, isDefault: c.isDefault,
    lastTestedAt: c.lastTestedAt?.toISOString() || null, lastTestOk: c.lastTestOk, createdAt: c.createdAt.toISOString(),
  }
}

/** 取用户默认配置 → AiConfig（供 callLlm；找不到回退 key-value） */
export async function getActiveAiConfig(userId: string): Promise<AiConfig> {
  const cfg = await db.aiProviderConfig.findFirst({
    where: { ownerId: userId, enabled: true, isDefault: true },
  })
  if (cfg) {
    const apiKey = decrypt(cfg.apiKeyEncrypted)
    return {
      provider: cfg.provider, baseUrl: cfg.baseUrl.replace(/\/+$/, ''), model: cfg.model, apiKey,
      configured: Boolean(apiKey && cfg.baseUrl),
    }
  }
  return getAiConfig()
}

export async function listAiProviderConfigs(userId: string): Promise<AiProviderConfigPublic[]> {
  const list = await db.aiProviderConfig.findMany({
    where: { ownerId: userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  return list.map(toPublicProviderConfig)
}

export async function createAiProviderConfig(userId: string, data: {
  name: string; provider?: string; baseUrl?: string; model?: string; apiKey?: string; temperature?: number; isDefault?: boolean
}) {
  if (data.isDefault) {
    await db.aiProviderConfig.updateMany({ where: { ownerId: userId, isDefault: true }, data: { isDefault: false } })
  }
  return db.aiProviderConfig.create({
    data: {
      ownerId: userId,
      name: data.name,
      provider: data.provider || 'openai-compatible',
      baseUrl: (data.baseUrl || '').replace(/\/+$/, ''),
      model: data.model || '',
      apiKeyEncrypted: data.apiKey ? encrypt(data.apiKey) : '',
      temperature: data.temperature ?? 0.4,
      enabled: true,
      isDefault: data.isDefault ?? false,
    },
  })
}

export async function updateAiProviderConfig(id: string, userId: string, data: {
  name?: string; provider?: string; baseUrl?: string; model?: string; apiKey?: string; temperature?: number; enabled?: boolean; isDefault?: boolean
}) {
  if (data.isDefault) {
    await db.aiProviderConfig.updateMany({ where: { ownerId: userId, isDefault: true }, data: { isDefault: false } })
  }
  return db.aiProviderConfig.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.provider !== undefined ? { provider: data.provider } : {}),
      ...(data.baseUrl !== undefined ? { baseUrl: data.baseUrl.replace(/\/+$/, '') } : {}),
      ...(data.model !== undefined ? { model: data.model } : {}),
      ...(data.apiKey !== undefined && data.apiKey !== '' ? { apiKeyEncrypted: encrypt(data.apiKey) } : {}),
      ...(data.temperature !== undefined ? { temperature: data.temperature } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
    },
  })
}

export async function deleteAiProviderConfig(id: string, userId: string) {
  return db.aiProviderConfig.deleteMany({ where: { id, ownerId: userId } })
}

// ============ 模块开关 ============

export async function getModuleSwitches() {
  return db.aiModuleSwitch.findMany({ orderBy: { module: 'asc' } })
}

export async function ensureModuleSwitch(module: string) {
  return db.aiModuleSwitch.upsert({ where: { module }, update: {}, create: { module, enabled: true } })
}

export async function setModuleSwitch(module: string, enabled?: boolean, configId?: string | null) {
  await ensureModuleSwitch(module)
  return db.aiModuleSwitch.update({
    where: { module },
    data: {
      ...(enabled !== undefined ? { enabled } : {}),
      ...(configId !== undefined ? { configId: configId || null } : {}),
    },
  })
}

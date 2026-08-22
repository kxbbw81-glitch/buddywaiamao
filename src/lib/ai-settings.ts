import { db } from '@/lib/db'

/**
 * AI 配置（存 AiSetting key-value 表，管理角色可通过 /api/ai-config 修改）
 * 环境变量作为兜底：AI_BASE_URL / AI_MODEL / AI_API_KEY
 */

export interface AiConfig {
  provider: string
  baseUrl: string
  model: string
  apiKey: string
  /** apiKey 或 baseUrl+model 齐备则视为已接入真实 LLM */
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

export async function getAiConfig(): Promise<AiConfig> {
  const rows = await db.aiSetting.findMany({
    where: { key: { in: Object.values(KEYS) } },
  })
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
    await db.aiSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  }
}

/** 脱敏展示：只保留前 4 后 4 位 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '****'
  return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`
}

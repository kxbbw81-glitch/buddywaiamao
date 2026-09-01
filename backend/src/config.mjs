import { aiQueueStatus } from './ai-queue.mjs'
export function configurationStatus(env = process.env) {
  const databaseConfigured = Boolean(env.DATABASE_URL)
  const sessionConfigured = Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32)
  const piiConfigured = Boolean(env.PII_ENCRYPTION_KEY || env.ENCRYPTION_KEY) || env.NODE_ENV === 'test'
  return {
    database: databaseConfigured ? 'configured' : 'unconfigured',
    session: sessionConfigured ? 'configured' : 'unconfigured',
    pii: piiConfigured ? 'configured' : 'unconfigured',
    ai: env.AI_ENABLED === 'true' ? 'enabled' : 'disabled',
    aiQueue: aiQueueStatus(env),
    ready: databaseConfigured && sessionConfigured && piiConfigured,
  }
}

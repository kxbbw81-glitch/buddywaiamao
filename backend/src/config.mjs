export function configurationStatus(env = process.env) {
  const databaseConfigured = Boolean(env.DATABASE_URL)
  const sessionConfigured = Boolean(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32)
  return {
    database: databaseConfigured ? 'configured' : 'unconfigured',
    session: sessionConfigured ? 'configured' : 'unconfigured',
    ai: env.AI_ENABLED === 'true' ? 'enabled' : 'disabled',
    ready: databaseConfigured && sessionConfigured,
  }
}

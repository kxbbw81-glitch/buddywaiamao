import { HttpError } from './http.mjs'

let client

export async function prisma() {
  if (client) return client
  if (process.env.NODE_ENV === 'test' && process.env.NEXFAB_MEMORY_TEST_DB === 'true') {
    const { createMemoryPrisma } = await import('./memory-test-prisma.mjs')
    client = await createMemoryPrisma()
    return client
  }
  if (!process.env.DATABASE_URL) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', '后端迁移数据库尚未配置。')
  try {
    const { PrismaClient } = await import('@prisma/client')
    client = new PrismaClient()
    return client
  } catch {
    throw new HttpError(503, 'DATABASE_CLIENT_UNAVAILABLE', '数据库客户端尚未准备就绪。')
  }
}

export function testMemoryState() {
  return process.env.NODE_ENV === 'test' && process.env.NEXFAB_MEMORY_TEST_DB === 'true' ? client?.__state || null : null
}

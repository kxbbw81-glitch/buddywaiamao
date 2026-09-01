import { HttpError } from './http.mjs'

let client
// 修复说明：[中危-稳定性]，原因：原实现缓存实例而非 Promise，首次初始化（动态 import 是真实异步点）期间的并发调用会创建多个 PrismaClient/内存实例，造成多连接池泄漏或测试数据串台；现缓存初始化 Promise，失败时清空缓存允许重试。
let clientPromise

async function createClient() {
  if (process.env.NODE_ENV === 'test' && process.env.NEXFAB_MEMORY_TEST_DB === 'true') {
    const { createMemoryPrisma } = await import('./memory-test-prisma.mjs')
    return createMemoryPrisma()
  }
  if (!process.env.DATABASE_URL) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', '后端迁移数据库尚未配置。')
  try {
    const { PrismaClient } = await import('@prisma/client')
    return new PrismaClient()
  } catch {
    throw new HttpError(503, 'DATABASE_CLIENT_UNAVAILABLE', '数据库客户端尚未准备就绪。')
  }
}

export function prisma() {
  if (!clientPromise) {
    clientPromise = createClient()
      .then((created) => {
        client = created
        return created
      })
      .catch((error) => {
        clientPromise = undefined
        throw error
      })
  }
  return clientPromise
}

export function testMemoryState() {
  return process.env.NODE_ENV === 'test' && process.env.NEXFAB_MEMORY_TEST_DB === 'true' ? client?.__state || null : null
}

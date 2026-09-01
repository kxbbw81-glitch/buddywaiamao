import { PrismaClient } from '@prisma/client'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 未配置；拒绝执行 pgvector 预检。')
if (process.argv.includes('--apply')) throw new Error('本脚本只读预检，不会执行迁移；请在已备份的测试库中另行执行 prisma migrate deploy。')

const db = new PrismaClient()

try {
  const extensions = await db.$queryRaw`
    SELECT extname, extversion
    FROM pg_extension
    WHERE extname = 'vector'
  `
  const column = await db.$queryRaw`
    SELECT a.atttypid::regtype::text AS type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'KnowledgeChunk'
      AND n.nspname = current_schema()
      AND a.attname = 'embedding'
      AND a.attnum > 0
      AND NOT a.attisdropped
  `
  const indexes = await db.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'KnowledgeChunk'
      AND indexname = 'KnowledgeChunk_embedding_hnsw_idx'
  `

  if (extensions.length !== 1) throw new Error('pgvector 扩展缺失：先在测试 PostgreSQL 16 实例启用 vector 扩展。')
  if (column.length !== 1 || column[0].type !== 'vector') throw new Error('KnowledgeChunk.embedding vector 列缺失：先执行受控 prisma migrate deploy。')
  if (indexes.length !== 1) throw new Error('KnowledgeChunk_embedding_hnsw_idx 缺失：先执行受控 prisma migrate deploy。')

  console.log(JSON.stringify({ result: 'passed', mode: 'pgvector-readonly-preflight', extension: extensions[0].extversion, embeddingType: column[0].type, index: indexes[0].indexname }))
} finally {
  await db.$disconnect()
}

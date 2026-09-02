import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const schema = readFileSync(new URL('prisma/schema.prisma', root), 'utf8')
const migration = readFileSync(new URL('prisma/migrations/20260825160000_pgvector_knowledge_embeddings/migration.sql', root), 'utf8')
const preflight = readFileSync(new URL('scripts/verify-pgvector.mjs', root), 'utf8')

assert.match(schema, /embedding\s+Unsupported\("vector\(1536\)"\)\?/, 'Prisma schema must declare the pgvector column as unsupported')
assert.match(migration, /CREATE EXTENSION IF NOT EXISTS vector;/, 'migration must enable pgvector')
assert.match(migration, /ALTER TABLE "KnowledgeChunk"\s+ADD COLUMN "embedding" vector\(1536\);/s, 'migration must add the expected embedding dimension')
assert.match(migration, /CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx"[\s\S]*USING hnsw \("embedding" vector_cosine_ops\)/, 'migration must add cosine HNSW index')
assert.doesNotMatch(migration, /DROP\s+(TABLE|DATABASE|SCHEMA)/i, 'migration must not contain destructive drops')
assert.match(preflight, /只读预检/, 'preflight must state it is read-only')
assert.match(preflight, /pg_extension/, 'preflight must verify the vector extension')
assert.match(preflight, /KnowledgeChunk_embedding_hnsw_idx/, 'preflight must verify the HNSW index')
assert.match(preflight, /prisma migrate deploy/, 'preflight must point to the controlled migration command')

console.log(JSON.stringify({ result: 'passed', mode: 'p2-pgvector-migration-contract', dimension: 1536, index: 'KnowledgeChunk_embedding_hnsw_idx', destructiveSql: false }))

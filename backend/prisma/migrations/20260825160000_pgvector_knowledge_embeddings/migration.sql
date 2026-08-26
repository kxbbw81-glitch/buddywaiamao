-- P2.3: 仅为已审核知识片段预留 pgvector 存储和近邻索引。
-- 写入 embedding 必须由受控 worker 完成，查询仍需保留来源引用、RBAC 和无依据拒答门禁。
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeChunk"
  ADD COLUMN "embedding" vector(1536);

CREATE INDEX "KnowledgeChunk_embedding_hnsw_idx"
  ON "KnowledgeChunk"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

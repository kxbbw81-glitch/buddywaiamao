# NexFab AI CRM V2.0 P0 PII 静态加密方案

> 状态：P0 必须补齐。`CustomerFingerprint` 只用于查重索引，不能替代 PII 加密。

## 1. 范围

第一轮覆盖高频个人信息字段：

- `Contact.email`
- `Contact.phone`
- `Lead.email`
- `Lead.phone`

后续可扩展到 WhatsApp、社媒账号、身份证件、银行流水、单证收件人等字段。

## 2. 存储策略

| 字段类型 | 存储字段 | 用途 |
| --- | --- | --- |
| 明文字段 | `email` / `phone` | 兼容历史读取与迁移前数据；新写入置空 |
| 密文字段 | `emailCiphertext` / `phoneCiphertext` | AES-256-GCM 加密后的紧凑密文字符串 |
| 查重索引 | `emailHash` / `phoneHash` | HMAC-SHA256 归一化值，用于查找，不可逆 |
| 指纹表 | `CustomerFingerprint.normalized` | 业务查重索引，仍保留，但不是加密层 |

## 3. 加密与密钥

- 算法：AES-256-GCM。
- 每个字段独立随机 IV。
- 认证标签 `tag` 与密文一起保存，当前格式为 `v1.iv.tag.ciphertext`，便于兼容旧代码。
- 密钥来源：`PII_ENCRYPTION_KEY`，支持 32 字节 base64/hex 或任意长 passphrase 派生。
- 测试环境允许使用固定测试密钥；生产不得提交或打印密钥。

## 4. 兼容读取

读取优先级：

1. 如果存在 `emailCiphertext` / `phoneCiphertext`，则解密返回 `email` / `phone`。
2. 如果密文字段为空，但历史明文字段存在，则返回历史明文，便于分阶段迁移。
3. 新写入数据必须写密文和 hash，明文字段置空。

## 5. 查重与索引

- `CustomerFingerprint` 继续用归一化值做业务查重。
- `emailHash` / `phoneHash` 用于后续直接索引查询和迁移核对。
- 不允许把 hash 当作明文展示。

## 6. AI 脱敏与审计

- AI 输入摘要和日志不得保存邮箱、电话、token、key 等敏感明文。
- 审计日志只记录字段名、是否加密、fingerprintCount、hash 是否存在，不记录原值。
- 业务接口返回明文只面向已授权且通过数据范围校验的角色。

## 7. 迁移步骤

1. 新增密文字段和 hash 字段，保留历史明文字段。
2. 新写入走加密兼容层，明文字段置空。
3. 使用 `backend/scripts/backfill-pii.mjs`：读取历史明文 → 写密文/hash → 清空明文；默认仅 dry-run，必须显式传入 `--apply` 才会写库。
4. 迁移前备份，迁移后抽样解密核对。
5. 回滚时可保留密文字段，不反向写回明文；如必须回滚，需在受控环境执行单独解密导出。

## 8. 回滚原则

- schema 新字段可向前兼容旧代码，但旧代码不会读密文。
- 生产回滚前必须确认是否允许短期读取历史明文字段为空的数据。
- 禁止在日志、报告或 Git 中输出解密后的批量 PII。


## 9. P0 实现证据

- 新增 `backend/src/pii.mjs`：AES-256-GCM 加密、兼容解密、HMAC-SHA256 索引、邮箱/电话脱敏。
- 更新 `Contact` / `Lead` schema：新增 `emailCiphertext`、`phoneCiphertext`、`emailHash`、`phoneHash`，保留历史明文字段用于兼容迁移。
- 新增迁移：`backend/prisma/migrations/20260825140000_pii_encryption/migration.sql`。
- 更新 CRM / 获客写入链路：联系人、线索、线索转客户联系人新写入均加密存储。
- 更新指纹查重：EMAIL / PHONE 指纹不再保存原始归一化值，改为 HMAC 索引 + 脱敏展示值。
- 更新 AI Gateway redaction：输入摘要中邮箱、电话、token、key 等敏感信息不回显。
- 验证命令：`npm run test:p0-pii-encryption`，结果 PASS。
- 历史数据演练：`npm run test:p0-pii-backfill`；生产受控执行前先备份，再运行 `npm run p0:pii-backfill -- --apply`，只记录汇总数，禁止输出明文。

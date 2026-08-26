# NexFab AI CRM V2.0 集成与连接器说明

> 本文是外部工具、Webhook、通知、自动化的治理入口。第一版先做台账与人工确认，不直接自动处理外部动作。

## 1. 当前可复用实现

| 能力 | 文件 / 模型 | 测试 |
| --- | --- | --- |
| 通知 | `Notification`、`integration-routes.mjs` | `test:p2-integration` |
| 连接器台账 | `IntegrationConnection`、`integration-routes.mjs` | `test:p2-integration` |
| Webhook 接收台账 | `WebhookEvent`、`integration-routes.mjs` | `test:p2-integration` |
| 自动化规则/运行 | `AutomationRule`、`AutomationRun`、`automation-routes.mjs` | `test:p2-automation` |
| ToolCall 人工批准 | `ToolCall`、`ai-gateway-routes.mjs` | `test:p2-tool-call` |

## 2. 第一版边界

- 不保存明文密钥；连接器只保存 `secretRef` 或脱敏摘要。
- Webhook 默认只记录，不自动处理正式业务。
- ToolCall 禁止 `executeNow` / 自动执行，必须人工确认。
- finance 对多数销售/AI/连接器能力无权访问或只读受限。
- 列表页不返回完整配置、metadata 或敏感 payload。

## 3. 后续可接入渠道

| 渠道 | 建议接入方式 | 当前状态 |
| --- | --- | --- |
| 邮件 IMAP/SMTP | 连接器 + Webhook/轮询 + 人工确认 | 后置，需凭据授权 |
| B2B 平台 | API/Webhook 台账 | 后置，需平台授权 |
| 官网表单 | Webhook 接收台账 | 可优先接入 |
| 社媒 | 作为获客渠道视图，不单独重造系统 | 后置，需官方 API 授权 |
| 物流/ERP | ToolCall + 连接器 + 对账台账 | P3 增强 |

## 4. 验收命令

```bash
cd backend
npm run test:p2-integration
npm run test:p2-automation
npm run test:p2-tool-call
```

# 变更记录

## 2026-08-22 — G1 BLOCK 修正（待复审）

- 修正认证字段归属：`passwordHash` 仅保留在 `User`，与登录查询及 PostgreSQL 初始迁移一致。
- 修正 Prisma enum 写法，`schema.prisma` 已能通过 `prisma validate`。
- 客户列表不再内联加载完整联系人；响应仅返回联系人/商机计数。
- 联系人和跟进记录列表增加 `page`、`pageSize`、`skip`、`take` 与 `total` 响应边界。
- 补充无数据库回归测试，覆盖嵌套列表分页、会话、角色导航及范围控制。
- 增加仅测试环境启用的内存适配器和 HTTP smoke，验证 admin/manager/sales/finance/exec 的 G1 完整主链路、权限边界与审计写入；正常运行仍只接受 PostgreSQL。

当前策略：先跑通 G1 本地闭环，再处理性能、超时和压测等优化项；未进入 P2–P4。

## 2026-08-23 — P2 产品 PIM（待审核）

- 新增产品分类、产品 PIM 和产品资料元数据的 PostgreSQL schema 与迁移。
- 新增产品分类/产品/资料的分页 API、输入校验和事务内审计。
- 产品读取权限为销售/经理/管理层/超管；仅经理与超管可写，财务无权访问、管理层只读。
- 增加隔离 HTTP smoke，覆盖创建分类/产品/资料、销售与管理层写入 403、财务访问 403、审计记录。

## 2026-08-23 — P2 报价中心最小闭环（RUNNABLE，待审核）

- 新增 Quote、QuoteVersion 与 QuoteStatus，报价关联客户、可选商机、创建人、负责人，并以版本 JSON 保存必须关联 Product 的最小报价明细。
- 新增快速报价、报价列表、报价详情、报价版本分页 API。
- 报价读取权限为 sales/manager/exec/admin；写入权限为 sales/manager/admin；exec 只读，finance 403。
- sales 仅能操作自己客户范围，manager 可读团队范围，admin/exec 可全局读；写操作在事务内写 AuditLog。
- 新增 `test:p2-quote`，覆盖五角色登录、快速报价、版本查询、sales 越权 403、manager 团队范围、exec 写入 403、finance 403 与审计记录。

## 2026-08-23 — P2 订单履约最小闭环（RUNNABLE，待审核）

- 新增 SalesOrder、OrderItem、FulfillmentEvent 以及订单、收款、履约状态枚举，订单从 Quote 转化并快照 QuoteVersion.items。
- 新增报价转订单、订单列表、订单详情、订单门禁 API；门禁先返回待收金额、履约状态、是否可发货和待补事项，不接入真实财务回款。
- 订单读取权限覆盖 sales/manager/finance/exec/admin；写入/报价转订单仅允许 sales/manager/admin；exec 与 finance 只读。
- sales 仅能转本人客户/报价范围，manager 可读团队范围，finance/exec/admin 全局读；从报价转订单在事务内写 OrderItem、FulfillmentEvent 与 AuditLog。
- 新增 `test:p2-order`，覆盖五角色登录、从报价生成订单、订单详情/列表、gate、sales 越权 403、manager 团队范围、exec/finance 写入 403、重复转单不崩溃与审计记录。

## 2026-08-23 — P2 财务回款最小闭环（RUNNABLE，待审核）

- 新增 OrderPayment 与 OrderPaymentStatus，回款关联 SalesOrder、Customer、登记人和确认人。
- 新增回款分页列表、登记回款、财务确认回款 API，支持按 status/orderId 过滤。
- 订单 gate 改为汇总 CONFIRMED 回款计算 paidAmount、pendingAmount 与 paymentStatus；登记未确认回款不减少待收金额。
- sales/manager 可登记本人或团队范围订单，finance/admin 可全局登记；finance/admin 可确认；exec 只读；finance/exec/admin 全局读。
- 登记和确认都在事务内写 AuditLog；确认后同步 SalesOrder.paymentStatus，且禁止确认后超过订单总额。
- 新增 `test:p2-payment`，覆盖五角色登录、从报价生成订单、登记收款、finance/admin 确认、gate 待收金额变化、越权 403、超额确认拒绝与审计记录。

## 2026-08-23 — P2 沟通时间线最小闭环（RUNNABLE，待审核）

- 新增 CommunicationEvent、CommunicationEventType、CommunicationDirection，支持关联 Customer 与可选 Opportunity。
- 新增沟通时间线分页列表与人工沟通记录创建 API，支持 customerId、opportunityId、type 过滤。
- sales/manager/exec/admin 可读，sales/manager/admin 可写；exec 只读；finance 无沟通中心权限返回 403。
- sales 仅本人客户/商机范围，manager 团队范围，admin/exec 全局读；写操作在事务内写 AuditLog。
- 新增 `test:p2-timeline`，覆盖五角色登录、分页与过滤、创建沟通记录、sales 越权 403、exec 写入 403、finance 403 与审计记录。

## 2026-08-23 — P2 AI/RAG 只读占位闭环（RUNNABLE，待审核）

- 实现 `POST /api/rag/query`，支持 query、module/context、customerId、opportunityId、productId。
- 不接真实 OpenAI、MCP、向量库、知识库或外部服务；返回 deterministic fallback，明确 `RAG_NOT_CONFIGURED`。
- sales/manager/exec/admin 可读，finance 无 AI/RAG 权限返回 403；无写接口。
- 带客户/商机上下文时执行数据范围校验：sales 本人范围，manager 团队范围，admin/exec 全局读。
- 增加 query 长度与必填校验，并避免返回密钥、环境变量、系统提示词或文件绝对内容。
- 新增 `test:p2-rag`，覆盖五角色登录、fallback 查询、空 query 400、超长 query 400、finance 403、sales 越权上下文 403、manager 团队上下文、exec 只读查询与敏感词脱敏。

# NexFab AI CRM V2.0 报价 Excel V2 审计索引

> 本文是 V2.0 指定文档入口，复用既有审计资料，不重写报价体系。

## 1. 当前结论

Excel V2 可以作为业务规则样本，但不能作为生产报价计算引擎。生产报价必须进入后端确定性规则引擎，并保留规则版本、费用来源、审批和发送留痕。

## 2. 已确认风险

| 风险 | 影响 | 当前处理 |
| --- | --- | --- |
| DDP 链路引用文本费用项，例如 `DHL` | 可能产生类似 `#VALUE!` 的计算错误 | `quote-excel-audit` 标记 BLOCKED；运行时报价拒绝文本费用 |
| 利润率单元格/引用口径疑似错位 | 毛利审批可能失真 | 后端统一按规则引擎计算毛利 |
| 物流费用区域与标签语义错位 | CIF/DDP 费用来源不可靠 | 迁移前必须清洗成结构化费用项 |
| 产品选择缺少可靠数据验证 | 销售可能选错产品 | 后端按产品 ID / SKU 绑定 |
| 说明书公式是文本 | 不能直接执行 | 仅作为人工迁移参考 |

## 3. 证据文件

- 外部审计说明：`/Users/dream/Documents/NexFab_CRM交接资料/NexFab_ExcelV2报价规则审计与迁移说明_20260823.md`
- 当前总结：`docs/QUOTE_ENGINE.md`
- 审计实现：`backend/src/quote-excel-audit.mjs`
- 审计测试：`backend/test/p2-excel-audit-smoke.mjs`
- 验证命令：`npm run test:p2-excel-audit`

## 4. 第一版验收口径

- 脏 Excel 摘要应返回 BLOCKED。
- DDP 公式错误、文本费用、无命名区域/无数据验证应被识别。
- 清洗后可以创建干净规则草稿。
- 审计接口不得创建正式 `QuoteRuleSet` / `Quote` / `QuoteVersion`。

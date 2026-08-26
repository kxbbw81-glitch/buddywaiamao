# NexFab AI CRM V2.0 报价中心与 Excel V2 迁移说明

## 1. 结论

Excel V2 可作为报价业务蓝本，但不能作为上线计算引擎。当前报价必须走后端确定性规则引擎，AI 只能解释、提示和生成草稿，不能编造价格或绕过审批。

## 2. Excel V2 已知风险

来自 `/Users/dream/Documents/NexFab_CRM交接资料/NexFab_ExcelV2报价规则审计与迁移说明_20260823.md`：

- DDP 链路引用到文本 `DHL`，导致 `#VALUE!`。
- 利润率引用疑似错位，不能直接照抄单元格。
- 物流费用引用区域与标签语义错位。
- 产品选择缺少可靠下拉约束。
- 操作说明书公式是说明文本，不应作为可执行规则。

## 3. 当前可复用实现

| 能力 | 文件 | 测试 |
| --- | --- | --- |
| 报价路由 | `backend/src/quote-routes.mjs` | `test:p2-quote` |
| 规则引擎 | `backend/src/quote-engine.mjs` | `test:p2-quote-rules` |
| Excel 只读审计 | `backend/src/quote-excel-audit.mjs` | `test:p2-excel-audit` |
| PDF 生成 | `backend/src/quote-pdf.mjs` | `test:p2-quote-send` |
| 低毛利审批 / 版本锁定 | `backend/src/quote-routes.mjs` | `test:p2-quote-lock` |

## 4. 第一版报价边界

- 第一版不做折扣。
- 保留数量梯度价，但梯度必须逐档独立计算。
- 毛利率口径：`margin = (售价 - 成本) / 售价`。
- EXW/FOB/CIF/DDP 必须由规则版本和费用项计算。
- 文本费用项必须拒绝或进入审计错误，不能参与数字求和。
- 低于成本硬拦截；低毛利进入审批或硬拦截。
- 正式报价必须有规则版本、费用来源、币种、有效期、计算快照和 PDF/发送留痕。

## 5. 后续工作包

1. 强化规则版本字段：汇率、目的国、物流、税费、有效期。
2. 增加标准导入模板：产品、供应商、成本、包装、物流、报价规则。
3. 增加正式导入批次表与冲突报告，不把示例数据直接写生产。
4. 报价 PDF 模板视觉精修转优化支线。

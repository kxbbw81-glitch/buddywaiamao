# Task 5-b: Data Export Developer - Work Record

## Task
Add CSV data export functionality to the CRM lists.

## Changes Made

### New File: `src/lib/export-csv.ts`
- `exportToCSV(data, filename, columns)` function
- BOM for Excel Chinese compatibility
- RFC 4180 CSV escaping (commas, quotes, newlines)
- Nested object value extraction (dot notation)
- Smart value formatting (objects → name/companyName, booleans → 是/否)
- Browser download via Blob + URL.createObjectURL

### Modified Files (5 list views)
1. `customer-list-view.tsx` - Export: 公司名称, 国家, 级别, 来源, 负责人, 最后联系日期, 询盘数, 状态
2. `inquiry-list-view.tsx` - Export: 询盘编号, 主题, 客户, 来源, 状态, 优先级, 负责人, 创建时间
3. `quotation-list-view.tsx` - Export: 报价编号, 客户, 贸易条款, 金额, 利润率, 状态, 创建日期
4. `order-list-view.tsx` - Export: 订单编号, 客户, 金额, 付款条款, 状态, 创建日期
5. `payment-list-view.tsx` - Export: 付款编号, 订单, 客户, 金额, 付款方式, 状态, 到期日

### UI Pattern
- DropdownMenu with '导出' trigger button (outline, sm, Download icon)
- Menu item: '导出CSV' with emerald-600 Download icon
- Toast: sonner `toast.success('导出成功，共 N 条数据')`
- All status/level/source values mapped to Chinese labels before export

## Verification
- ESLint: 0 errors
- All text in Chinese
- emerald/teal colors only (no blue/purple)
- shadcn/ui DropdownMenu components used

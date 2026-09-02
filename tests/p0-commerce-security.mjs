import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const mustInclude = (relative, fragment) => assert.ok(read(relative).includes(fragment), `${relative} 缺少: ${fragment}`)
const mustExclude = (relative, fragment) => assert.ok(!read(relative).includes(fragment), `${relative} 不应包含: ${fragment}`)

for (const route of [
  'src/app/api/quotations/route.ts',
  'src/app/api/quotations/[id]/route.ts',
  'src/app/api/orders/route.ts',
  'src/app/api/orders/[id]/route.ts',
  'src/app/api/orders/from-quote/[id]/route.ts',
  'src/app/api/payments/route.ts',
  'src/app/api/payments/[id]/confirm/route.ts',
  'src/app/api/samples/route.ts',
  'src/app/api/samples/[id]/route.ts',
  'src/app/api/inquiries/[id]/route.ts',
  'src/app/api/bulk-update-status/route.ts',
]) {
  mustInclude(route, 'requireAuth')
}

mustInclude('src/app/api/quotations/route.ts', 'createdById: auth.user.id')
mustInclude('src/app/api/quotations/route.ts', "status: 'draft'")
mustInclude('src/app/api/quotations/route.ts', 'tx.quoteVersion.create')
mustExclude('src/app/api/quotations/[id]/route.ts', 'updateData.totalAmount')
mustExclude('src/app/api/quotations/[id]/route.ts', 'updateData.totalCost')
mustExclude('src/app/api/quotations/[id]/route.ts', 'updateData.profitRate')
mustInclude('src/app/api/orders/route.ts', '订单必须从已接受报价生成')
mustInclude('src/lib/order-from-quote.ts', "quote.status !== 'accepted'")
mustInclude('src/lib/order-from-quote.ts', 'quote.marginCheckPassed === false')
mustExclude('src/app/api/orders/[id]/route.ts', 'updateData.paidAmount')
mustExclude('src/app/api/orders/[id]/route.ts', 'updateData.trackingNo')
mustExclude('src/app/api/orders/[id]/route.ts', 'updateData.shippingMethod')
mustInclude('src/app/api/payments/route.ts', "status: 'pending'")
mustInclude('src/app/api/payments/[id]/confirm/route.ts', 'FINANCE_CONFIRM_ROLES')
mustInclude('src/app/api/payments/[id]/confirm/route.ts', 'PAYMENT_CONFIRMED')
mustInclude('src/app/api/bulk-update-status/route.ts', '必须使用专用审批、履约或财务确认流程')
mustInclude('src/components/crm/views/order-form-dialog.tsx', '/api/orders/from-quote/')
mustInclude('src/components/crm/views/payment-kanban-view.tsx', '/api/payments/${itemId}/confirm')
mustInclude('src/components/crm/views/quotation-kanban-view.tsx', '/api/quotations/${itemId}')

console.log(JSON.stringify({ result: 'passed', mode: 'p0-commerce-security-contract', protectedRoutes: 11 }))

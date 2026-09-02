import type { PublicUser } from '@/lib/auth'

/**
 * 商业单据的数据范围和职责边界。
 * 修复说明：[P0-商业单据越权]，原因：报价、订单、回款和样品的旧接口未统一会话、角色和客户归属校验，
 * 造成已登录用户可通过直接调用读取或改写不属于自己的业务数据。
 */
export const SALES_OPERATION_ROLES = ['super_admin', 'management', 'sales_manager', 'sales']
export const FINANCE_CONFIRM_ROLES = ['super_admin', 'management', 'finance']

export function quotationScopeWhere(user: PublicUser): Record<string, unknown> {
  if (user.primaryRole !== 'sales') return {}
  return {
    OR: [
      { ownerId: user.id },
      { customer: { ownerId: user.id } },
    ],
  }
}

export function orderScopeWhere(user: PublicUser): Record<string, unknown> {
  if (user.primaryRole !== 'sales') return {}
  return { customer: { ownerId: user.id } }
}

export function paymentScopeWhere(user: PublicUser): Record<string, unknown> {
  if (user.primaryRole !== 'sales') return {}
  return { order: { customer: { ownerId: user.id } } }
}

export function sampleScopeWhere(user: PublicUser): Record<string, unknown> {
  if (user.primaryRole !== 'sales') return {}
  return {
    OR: [
      { customer: { ownerId: user.id } },
      { customerId: null, inquiry: { assignedTo: user.id } },
    ],
  }
}

export function inquiryScopeWhere(user: PublicUser): Record<string, unknown> {
  if (user.primaryRole !== 'sales') return {}
  return {
    OR: [
      { assignedTo: user.id },
      { customer: { ownerId: user.id } },
    ],
  }
}

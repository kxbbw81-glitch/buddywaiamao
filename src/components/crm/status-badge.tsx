'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  INQUIRY_STATUS_LABELS,
  QUOTATION_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SAMPLE_STATUS_LABELS,
  CUSTOMER_LEVEL_LABELS,
  PRIORITY_LABELS,
} from '@/lib/types'
import type { InquiryStatus, QuotationStatus, OrderStatus, PaymentStatus, SampleStatus, CustomerLevel, Priority } from '@/lib/types'

type StatusType = 'inquiry' | 'quotation' | 'order' | 'payment' | 'sample' | 'customer_level' | 'customer' | 'priority'

const statusBadgeMap: Record<StatusType, Record<string, string>> = {
  inquiry: {
    new: 'badge-new badge-inquiry',
    assigned: 'badge-assigned badge-inquiry',
    following: 'badge-following badge-inquiry',
    quoted: 'badge-quoted badge-inquiry',
    won: 'badge-won badge-inquiry',
    lost: 'badge-lost badge-inquiry',
    pooled: 'badge-pooled badge-inquiry',
    closed: 'badge-closed badge-inquiry',
  },
  quotation: {
    draft: 'badge-draft badge-quotation',
    pending: 'badge-pending-approval badge-quotation',
    sent: 'badge-sent badge-quotation',
    accepted: 'badge-accepted badge-quotation',
    rejected: 'badge-rejected badge-quotation',
    expired: 'badge-expired badge-quotation',
    cancelled: 'badge-cancelled badge-quotation',
  },
  order: {
    pending: 'badge-order-pending badge-order',
    confirmed: 'badge-confirmed badge-order',
    in_production: 'badge-in_production badge-order',
    ready: 'badge-ready badge-order',
    shipped: 'badge-shipped badge-order',
    completed: 'badge-completed badge-order',
    cancelled: 'badge-order-cancelled badge-order',
  },
  payment: {
    pending: 'badge-payment-pending',
    partial: 'badge-partial',
    completed: 'badge-payment-completed',
    overdue: 'badge-overdue',
  },
  sample: {
    pending: 'badge-pending-approval',
    approved: 'badge-accepted',
    sent: 'badge-sent',
    in_transit: 'badge-shipped',
    delivered: 'badge-completed',
    testing: 'badge-following',
    confirmed: 'badge-accepted',
    rejected: 'badge-rejected',
  },
  customer_level: {
    A: 'badge-level-A',
    B: 'badge-level-B',
    C: 'badge-level-C',
    D: 'badge-level-D',
  },
  priority: {
    low: 'badge-priority-low',
    normal: 'badge-priority-normal',
    high: 'badge-priority-high',
    urgent: 'badge-priority-urgent',
  },
  customer: {
    active: 'badge-accepted',
    inactive: 'badge-pooled',
    lost: 'badge-rejected',
  },
}

const labelMaps: Record<StatusType, Record<string, string>> = {
  inquiry: INQUIRY_STATUS_LABELS,
  quotation: QUOTATION_STATUS_LABELS,
  order: ORDER_STATUS_LABELS,
  payment: PAYMENT_STATUS_LABELS,
  sample: SAMPLE_STATUS_LABELS,
  customer_level: CUSTOMER_LEVEL_LABELS,
  customer: { active: '活跃', inactive: '非活跃', lost: '已流失' },
  priority: PRIORITY_LABELS,
}

// Dot colors for inquiry statuses
const inquiryDotColors: Record<string, string> = {
  new: 'bg-sky-500',
  assigned: 'bg-violet-500',
  following: 'bg-amber-500',
  quoted: 'bg-teal-500',
  won: 'bg-emerald-500',
  lost: 'bg-rose-500',
  pooled: 'bg-gray-400',
  closed: 'bg-gray-300',
}

interface StatusBadgeProps {
  status: string
  type: StatusType
  className?: string
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const label = labelMaps[type]?.[status] || status
  const variant = statusBadgeMap[type]?.[status] || ''

  const isALevel = type === 'customer_level' && status === 'A'
  const isInquiry = type === 'inquiry'
  const isOrder = type === 'order'

  return (
    <Badge
      variant="secondary"
      className={cn(
        'font-medium border-0',
        isALevel && 'text-sm px-2.5 py-0.5 badge-glow-emerald',
        isInquiry && 'pl-1.5 gap-1',
        isOrder && 'text-[11px] opacity-90',
        className,
        variant,
      )}
    >
      {isInquiry && inquiryDotColors[status] && (
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', inquiryDotColors[status])} />
      )}
      {label}
    </Badge>
  )
}

'use client'

import { Construction } from 'lucide-react'
import { EmptyState } from '@/components/crm/empty-state'

interface NavigationPlaceholderViewProps {
  moduleLabel: string
  itemLabel: string
  description: string
}

/**
 * 导航重构期间的明确入口壳层。
 * 不伪造业务数据或接口；已有实现仍直接复用原页面。
 */
export function NavigationPlaceholderView({
  moduleLabel,
  itemLabel,
  description,
}: NavigationPlaceholderViewProps) {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="rounded-xl border bg-card px-4 py-2 text-sm text-muted-foreground">
        {moduleLabel} / {itemLabel}
      </div>
      <EmptyState
        icon={<Construction className="h-12 w-12" />}
        title={`${itemLabel}正在接入`}
        description={`${description} 当前导航已按新结构保留入口，待后续复用现有能力或完成对应功能后接入。`}
      />
    </div>
  )
}

'use client'

import { Bot, Construction, Map } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getNavigationModule, PHASE_COLORS } from '@/lib/navigation'
import type { ModuleKey } from '@/lib/types'

interface NavigationPlaceholderViewProps {
  moduleKey?: ModuleKey
  moduleLabel: string
  itemLabel: string
  description: string
}

/**
 * 蓝图卡片页（对照原型 renderBlueprint 规格）。
 * 该模块尚未实现的二级菜单以蓝图卡片呈现：功能描述 + AI 能力标注；
 * 不伪造业务数据或接口；已有实现的入口仍直接复用原页面。
 */
export function NavigationPlaceholderView({
  moduleKey,
  moduleLabel,
  itemLabel,
  description,
}: NavigationPlaceholderViewProps) {
  const module = moduleKey ? getNavigationModule(moduleKey) : undefined
  const phaseColor = module ? PHASE_COLORS[module.phase] : undefined
  const blueprintItems = (module?.items || []).filter((item) => !item.existingView)
  const current = blueprintItems.find((item) => item.label === itemLabel)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Map className="h-3 w-3" />
            {moduleLabel}
          </div>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {itemLabel}
            {phaseColor && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: `${phaseColor}1A`, color: phaseColor }}
              >
                蓝图页 · {moduleLabel}
              </span>
            )}
          </CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description} 该页面按交接文档蓝图规格实现中，导航已按新结构保留入口。
          </p>
        </CardHeader>
      </Card>

      {blueprintItems.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <Construction className="h-3.5 w-3.5" />
            {moduleLabel}蓝图功能（{blueprintItems.length} 项待接入）
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {blueprintItems.map((item) => (
              <Card
                key={item.key}
                className={cn(
                  'border-dashed transition-colors',
                  item.label === itemLabel && 'border-solid shadow-sm'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="text-sm font-semibold"
                      style={{ color: item.label === itemLabel ? phaseColor : undefined }}
                    >
                      {item.label}
                    </div>
                    {item.label === itemLabel && <Badge variant="secondary" className="text-[10px]">当前页</Badge>}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  {item.ai && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-md bg-purple-50 px-2 py-1 text-[11px] text-purple-700">
                      <Bot className="h-3 w-3" />
                      AI · 该页面规划嵌入 AI 能力
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!current && blueprintItems.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Construction className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">{itemLabel}正在接入</p>
            <p className="max-w-md text-xs text-muted-foreground">
              {description} 待后续复用现有能力或完成对应功能后接入。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

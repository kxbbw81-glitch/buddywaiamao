'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Bot, ChevronDown, ChevronRight, CircleDollarSign, Funnel,
  LayoutDashboard, LogOut, MessageSquare, PackageSearch, Settings, Tag,
  Target, Truck, Users, Wrench, Zap, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCRMStore } from '@/store/use-crm-store'
import { ROLE_LABELS } from '@/lib/types'
import type { ModuleKey, UserRole } from '@/lib/types'
import { NAVIGATION_MODULES, ROLE_DEFAULT_EXPANDED, canAccessModule, PHASE_COLORS, AIHUB_MODULE_KEY } from '@/lib/navigation'
import type { NavigationModule, NavigationSubItem } from '@/lib/navigation'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarRail,
  SidebarSeparator, useSidebar,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const MODULE_ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Funnel,
  Users,
  Target,
  MessageSquare,
  PackageSearch,
  Tag,
  Truck,
  CircleDollarSign,
  Bot,
  Wrench,
  BarChart3,
  Settings,
}

const MODULE_BADGE_QUERY: Partial<Record<ModuleKey, string>> = {
  acquisition: 'inquiries',
  quote: 'quotations',
  fulfillment: 'samples',
  finance: 'payments',
}

const avatarColors: Record<string, string> = {
  super_admin: 'bg-emerald-600 text-white',
  management: 'bg-amber-600 text-white',
  sales_manager: 'bg-teal-600 text-white',
  sales: 'bg-emerald-500 text-white',
  finance: 'bg-rose-500 text-white',
}

export function CRMSidebar() {
  const {
    currentUser, currentModule, currentSubView, setCurrentNavigation,
    setAiDrawerOpen, logout,
  } = useCRMStore()
  const { state } = useSidebar()
  const [expandedModules, setExpandedModules] = useState<Set<ModuleKey>>(() => {
    const role = currentUser?.primaryRole as UserRole | undefined
    return new Set(role ? ROLE_DEFAULT_EXPANDED[role] : ['workbench'])
  })
  const initials = currentUser?.name ? currentUser.name.slice(0, 2) : 'N'
  const avatarColor = avatarColors[currentUser?.primaryRole || 'sales'] || 'bg-emerald-600 text-white'
  const visibleModules = NAVIGATION_MODULES.filter((module) => canAccessModule(currentUser?.primaryRole as UserRole | undefined, module))

  // AI Agent 预置/自定义 skills 分类动态追加（V3.12：aihub 仅硬编码「Agent 对话」，其余分类由侧栏从 skills 表动态渲染）
  const { data: aihubCats } = useQuery({
    queryKey: ['aihub-skill-categories'],
    queryFn: () => fetch('/api/agent/skills').then((r) => r.json()).then((p) => p.data || []),
    staleTime: 60000,
  })
  const getModuleItems = (module: NavigationModule): NavigationSubItem[] => {
    if (module.key === AIHUB_MODULE_KEY) {
      const dyn: NavigationSubItem[] = (aihubCats || []).map((c: { key: string; name: string }) => ({
        key: `agent-cat-${c.key}`,
        label: c.name,
        description: '动态 skills 分类（从 SkillCategory 表渲染）',
      }))
      return [...module.items, ...dyn]
    }
    return module.items
  }

  const setExpanded = (moduleKey: ModuleKey, open: boolean) => {
    setExpandedModules((previous) => {
      const next = new Set(previous)
      if (open) next.add(moduleKey)
      else next.delete(moduleKey)
      return next
    })
  }

  const selectSubItem = (moduleKey: ModuleKey, subKey: string) => {
    setCurrentNavigation(moduleKey, subKey)
    setExpanded(moduleKey, true)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 sidebar-gradient-header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <Zap className="h-5 w-5" />
          </div>
          {state === 'expanded' && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold">NexFab AI</span>
              <span className="truncate text-[11px] text-muted-foreground">外贸智能 CRM</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleModules.map((module) => {
                const Icon = MODULE_ICONS[module.icon] || LayoutDashboard
                const isActive = currentModule === module.key
                const isExpanded = expandedModules.has(module.key)
                const badgeQuery = MODULE_BADGE_QUERY[module.key]
                const phaseColor = PHASE_COLORS[module.phase]
                const items = getModuleItems(module)

                return (
                  <Collapsible key={module.key} open={isExpanded} onOpenChange={(open) => setExpanded(module.key, open)} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={module.label}
                          isActive={isActive}
                          className={cn('transition-all', isActive && 'font-medium')}
                          style={isActive ? { backgroundColor: `${phaseColor}1F`, color: phaseColor } : undefined}
                        >
                          <Icon className="size-4" style={{ color: phaseColor }} />
                          <span>{module.label}</span>
                          {badgeQuery && <SidebarBadgeCount query={badgeQuery} />}
                          {state === 'expanded' && (isExpanded ? <ChevronDown className="ml-1 size-4" /> : <ChevronRight className="ml-1 size-4" />)}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {items.map((item) => (
                            <SidebarMenuSubItem key={item.key}>
                              <SidebarMenuSubButton asChild isActive={isActive && (currentSubView ? currentSubView === item.key : item.key === items[0]?.key)}>
                                <button type="button" onClick={() => selectSubItem(module.key, item.key)}>
                                  <span>{item.label}</span>
                                  {item.ai && (
                                    <span className="ml-1 rounded bg-purple-100 px-1 text-[9px] font-medium leading-tight text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">AI</span>
                                  )}
                                  {item.demo && (
                                    <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-medium leading-tight text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">▶</span>
                                  )}
                                </button>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="p-2">
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-sidebar-accent">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={cn('text-xs font-semibold', avatarColor)}>{initials}</AvatarFallback>
                </Avatar>
                {state === 'expanded' && (
                  <div className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate font-medium">{currentUser.name}</span>
                    <Badge variant="secondary" className="h-4 w-fit px-1.5 py-0 text-[10px]">
                      {ROLE_LABELS[currentUser.primaryRole as UserRole] || currentUser.primaryRole}
                    </Badge>
                  </div>
                )}
                {state === 'expanded' && <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              {currentUser.primaryRole === 'super_admin' && (
                <>
                  <DropdownMenuItem onClick={() => selectSubItem('system', 'system-settings')}>
                    <Settings className="mr-2 h-4 w-4" />系统设置
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="AI 助手" onClick={() => setAiDrawerOpen(true)}>
              <Bot className="size-4" />
              <span>AI 助手</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function SidebarBadgeCount({ query }: { query: string }) {
  const isSampleBadge = query === 'samples'
  const { data } = useQuery({
    queryKey: ['sidebar-badge', query],
    queryFn: isSampleBadge
      ? () => fetch('/api/dashboard').then((response) => response.json()).then((payload) => ({ total: payload.data?.kpis?.pendingSamples || 0 }))
      : () => fetch(`/api/${query}?pageSize=1`).then((response) => response.json()),
    staleTime: 60000,
  })
  const count = data?.total || 0
  if (count === 0) return null
  return <span className="ml-auto min-w-[20px] rounded-full bg-emerald-100 px-1.5 py-0.5 text-center text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">{count > 99 ? '99+' : count}</span>
}

'use client'

import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Target,
  Users,
  Package,
  FileText,
  FlaskConical,
  ShoppingCart,
  DollarSign,
  BarChart3,
  Bot,
  Settings,
  LogOut,
  ChevronDown,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCRMStore } from '@/store/use-crm-store'
import { ROLE_LABELS } from '@/lib/types'
import type { ModuleKey, UserRole } from '@/lib/types'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems: Array<{ key: ModuleKey; label: string; icon: React.ElementType; roles?: UserRole[]; badgeQuery?: string }> = [
  { key: 'workbench', label: '工作台', icon: LayoutDashboard },
  { key: 'inquiries', label: '目标线索', icon: Target, badgeQuery: 'inquiries' },
  { key: 'customers', label: '客户档案', icon: Users },
  { key: 'products', label: '产品资料库', icon: Package },
  { key: 'quotations', label: '报价管理', icon: FileText, badgeQuery: 'quotations' },
  { key: 'samples', label: '样品管理', icon: FlaskConical, roles: ['super_admin', 'management', 'sales_manager', 'sales'], badgeQuery: 'samples' },
  { key: 'orders', label: '合同订单', icon: ShoppingCart },
  { key: 'payments', label: '收款管理', icon: DollarSign },
  { key: 'analytics', label: '数据分析', icon: BarChart3, roles: ['super_admin', 'management', 'sales_manager'] },
  { key: 'settings', label: '系统设置', icon: Settings },
]

const avatarColors: Record<string, string> = {
  super_admin: 'bg-emerald-600 text-white',
  management: 'bg-amber-600 text-white',
  sales_manager: 'bg-teal-600 text-white',
  sales: 'bg-emerald-500 text-white',
  finance: 'bg-rose-500 text-white',
}

export function CRMSidebar() {
  const { currentUser, currentModule, setCurrentModule, setAiDrawerOpen, logout } = useCRMStore()
  const { state } = useSidebar()

  const visibleItems = navItems.filter(
    (item) => !item.roles || currentUser?.primaryRole === 'super_admin' || item.roles.includes(currentUser?.primaryRole as UserRole)
  )

  const initials = currentUser?.name ? currentUser.name.slice(0, 2) : 'N'
  const avatarColor = avatarColors[currentUser?.primaryRole || 'sales'] || 'bg-emerald-600 text-white'

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 sidebar-gradient-header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0 shadow-sm">
            <Zap className="h-5 w-5" />
          </div>
          {state === 'expanded' && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm truncate">NexFab AI</span>
              <span className="text-[11px] text-muted-foreground truncate">外贸智能CRM</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive = currentModule === item.key
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={isActive}
                      onClick={() => {
                        setCurrentModule(item.key)
                        if (item.key === 'workbench') return
                      }}
                      className={cn(
                        'transition-all',
                        isActive && 'sidebar-active-accent bg-emerald-50 dark:bg-emerald-950/30 font-medium'
                      )}
                    >
                      <item.icon className={cn('size-4', isActive && 'text-emerald-600 dark:text-emerald-400')} />
                      <span>{item.label}</span>
                      {item.badgeQuery && (
                        <SidebarBadgeCount query={item.badgeQuery} />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-2">
        {currentUser && state === 'expanded' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent transition-colors text-sm">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className={cn('text-xs font-semibold', avatarColor)}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1 text-left">
                  <span className="truncate font-medium">{currentUser.name}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 w-fit">
                    {ROLE_LABELS[currentUser.primaryRole as UserRole] || currentUser.primaryRole}
                  </Badge>
                </div>
                <ChevronDown className="size-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem onClick={() => setCurrentModule('settings')}>
                <Settings className="mr-2 h-4 w-4" />
                个人设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {currentUser && state === 'collapsed' && (
          <div className="flex justify-center">
            <Avatar className="h-8 w-8 cursor-pointer" onClick={() => setCurrentModule('settings')}>
              <AvatarFallback className={cn('text-xs font-semibold', avatarColor)}>
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="AI 助手"
              onClick={() => setAiDrawerOpen(true)}
            >
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

// Badge count component for sidebar items
function SidebarBadgeCount({ query }: { query: string }) {
  const isSpecial = query === 'samples'
  const { data } = useQuery({
    queryKey: ['sidebar-badge', query],
    queryFn: isSpecial
      ? () => fetch('/api/dashboard').then((r) => r.json()).then((d) => ({ total: d.data?.kpis?.pendingSamples || 0 }))
      : () => fetch(`/api/${query}?pageSize=1`).then((r) => r.json()),
    staleTime: 60000,
  })
  const count = data?.total || 0
  if (count === 0) return null
  return (
    <span className="ml-auto text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 px-1.5 py-0.5 min-w-[20px] text-center crm-number">
      {count > 99 ? '99+' : count}
    </span>
  )
}

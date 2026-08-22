'use client'

import { Settings, LogOut, ChevronDown } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { ROLE_LABELS, type UserRole } from '@/lib/types'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export function UserMenu() {
  const { currentUser, setCurrentNavigation, logout } = useCRMStore()

  if (!currentUser) return null

  const role = currentUser.primaryRole as UserRole
  const roleLabel = ROLE_LABELS[role] || role
  const firstChar = currentUser.name.charAt(0)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        >
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs font-semibold">
              {firstChar}
            </AvatarFallback>
          </Avatar>
          <span className="hidden md:block text-sm font-medium leading-none">
            {currentUser.name}
          </span>
          <Badge variant="secondary" className="hidden md:inline-flex h-5 px-1.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40">
            {roleLabel}
          </Badge>
          <ChevronDown className="hidden md:block h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        {/* User Info Section */}
        <DropdownMenuLabel className="p-0">
          <div className="flex items-start gap-3 px-3 py-3">
            <Avatar className="h-10 w-10 flex-shrink-0 mt-0.5">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-sm font-semibold">
                {firstChar}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-semibold leading-none truncate">
                {currentUser.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {currentUser.email}
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40">
                  {roleLabel}
                </Badge>
                {currentUser.department && (
                  <span className="text-[11px] text-muted-foreground">
                    {currentUser.department}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Menu Items */}
        {role === 'super_admin' && (
          <>
            <DropdownMenuItem
              className="cursor-pointer text-sm gap-2.5 py-2.5 focus:bg-emerald-50 dark:focus:bg-emerald-950/30 focus:text-emerald-700 dark:focus:text-emerald-400"
              onSelect={() => setCurrentNavigation('system', 'system-settings')}
            >
              <Settings className="h-4 w-4" />
              <span>系统设置</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem
          className="cursor-pointer text-sm gap-2.5 py-2.5 focus:bg-red-50 dark:focus:bg-red-950/30 focus:text-red-600 dark:focus:text-red-400"
          onSelect={logout}
        >
          <LogOut className="h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

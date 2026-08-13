'use client'

import { Bot, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCRMStore } from '@/store/use-crm-store'
import { MODULE_LABELS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { NotificationDropdown } from '@/components/crm/notification-dropdown'
import { GlobalSearchDialog } from '@/components/crm/global-search-dialog'
import { UserMenu } from '@/components/crm/user-menu'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export function CRMHeader() {
  const { currentModule, setAiDrawerOpen } = useCRMStore()
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-6" />

      <Breadcrumb className="hidden sm:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#" className="text-muted-foreground">NexFab CRM</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">{MODULE_LABELS[currentModule] || currentModule}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <GlobalSearchDialog />

        <Button variant="ghost" size="icon" className="relative h-9 w-9" onClick={() => setAiDrawerOpen(true)}>
          <Bot className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">切换主题</span>
        </Button>

        <NotificationDropdown />

        <Separator orientation="vertical" className="h-6" />

        <UserMenu />
      </div>
    </header>
  )
}

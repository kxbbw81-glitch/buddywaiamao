'use client'

import { useEffect, useRef } from 'react'
import { useCRMStore } from '@/store/use-crm-store'
import { useSettingsStore } from '@/store/use-settings-store'
import type { NotificationSettings } from '@/store/use-settings-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ROLE_LABELS } from '@/lib/types'
import {
  Mail, Building2, Shield, Bell, Monitor, Info, Layers,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

// ─── 通知选项配置 ────────────────────────────────────────────────────────────

const NOTIFICATION_OPTIONS: {
  key: keyof NotificationSettings
  title: string
  description: string
}[] = [
  { key: 'inquiry', title: '新询盘到达', description: '收到新询盘时推送通知' },
  { key: 'approval', title: '报价审批', description: '报价提交审批时推送通知' },
  { key: 'orderStatus', title: '订单状态变更', description: '订单状态更新时推送通知' },
  { key: 'payment', title: '付款提醒', description: '逾期付款自动推送提醒' },
]

// ─── Component ───────────────────────────────────────────────────────────────

export function SettingsView() {
  const { currentUser } = useCRMStore()
  const { theme, setTheme } = useTheme()

  // Zustand settings store (hydrated once on mount)
  const {
    notifications,
    display,
    hydrated,
    hydrate,
    toggleNotification,
    setPageSize,
    setCompactTable,
    setDarkMode,
    setLanguage,
  } = useSettingsStore()

  // Hydrate from localStorage on first client mount
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true
      hydrate()
    }
  }, [hydrate])

  // Debounced toast
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => toast.success('已保存'), 300)
  }
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  // Dark mode sync: next-themes → store on hydration
  useEffect(() => {
    if (hydrated && theme) {
      const isDark = theme === 'dark'
      if (display.darkMode !== isDark) {
        setDarkMode(isDark)
      }
    }
  }, [hydrated, display.darkMode, setDarkMode, theme])

  // Handlers
  const handleToggleNotification = (key: keyof NotificationSettings) => {
    toggleNotification(key)
    showToast()
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(value as '10' | '20' | '50')
    showToast()
  }

  const handleCompactTableChange = (checked: boolean) => {
    setCompactTable(checked)
    showToast()
  }

  const handleDarkModeChange = (checked: boolean) => {
    setDarkMode(checked)
    setTheme(checked ? 'dark' : 'light')
    showToast()
  }

  const handleLanguageChange = (value: string) => {
    setLanguage(value as 'zh-CN' | 'en')
    showToast()
  }

  if (!currentUser) return null

  const initials = currentUser.name.slice(0, 2)
  const roleLabel = ROLE_LABELS[currentUser.primaryRole as keyof typeof ROLE_LABELS] || currentUser.primaryRole

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">个人设置</h2>
        <p className="text-sm text-muted-foreground">管理您的账户信息和偏好设置</p>
      </div>

      {/* ── 个人信息卡片 ── */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-emerald-500 to-teal-600" />
        <CardContent className="pt-0 relative">
          <div className="-mt-10 flex items-end gap-4">
            <div className="h-20 w-20 rounded-xl bg-emerald-600 dark:bg-emerald-700 flex items-center justify-center shadow-lg border-4 border-background">
              <span className="text-2xl font-bold text-white">
                {initials}
              </span>
            </div>
            <div className="pb-1 min-w-0">
              <p className="text-lg font-semibold leading-tight">{currentUser.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 hover:bg-emerald-100">
                  {roleLabel}
                </Badge>
                {currentUser.department && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {currentUser.department}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">邮箱</Label>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {currentUser.email}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">部门</Label>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {currentUser.department || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">角色</Label>
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                {roleLabel}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">状态</Label>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={currentUser.isActive ? 'default' : 'secondary'} className="text-xs">
                  {currentUser.isActive ? '活跃' : '停用'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 通知偏好 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            通知偏好
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {NOTIFICATION_OPTIONS.map((opt, idx) => (
            <div key={opt.key}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{opt.title}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
                <Switch
                  checked={notifications[opt.key]}
                  onCheckedChange={() => handleToggleNotification(opt.key)}
                />
              </div>
              {idx < NOTIFICATION_OPTIONS.length - 1 && (
                <Separator className="mt-4" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── 显示设置 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            显示设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 默认每页条数 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">默认每页条数</p>
              <p className="text-xs text-muted-foreground">列表默认显示的数据条数</p>
            </div>
            <Select value={display.pageSize} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 条</SelectItem>
                <SelectItem value="20">20 条</SelectItem>
                <SelectItem value="50">50 条</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* 紧凑表格模式 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">紧凑表格模式</p>
              <p className="text-xs text-muted-foreground">减少表格行间距以显示更多数据</p>
            </div>
            <Switch
              checked={display.compactTable}
              onCheckedChange={handleCompactTableChange}
            />
          </div>

          <Separator />

          {/* 深色模式 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">深色模式</p>
              <p className="text-xs text-muted-foreground">切换深色/浅色主题</p>
            </div>
            <Switch
              checked={display.darkMode}
              onCheckedChange={handleDarkModeChange}
            />
          </div>

          <Separator />

          {/* 界面语言 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">界面语言</p>
              <p className="text-xs text-muted-foreground">选择系统显示语言</p>
            </div>
            <Select value={display.language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">中文（简体）</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── 关于系统 ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            关于系统
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">NexFab AI CRM</p>
              <p className="text-xs text-muted-foreground">v1.0.0</p>
            </div>
          </div>
          <Separator />
          <div className="text-xs text-muted-foreground space-y-1.5">
            <p>技术栈：Next.js 16 + TypeScript + Tailwind CSS 4 + Prisma (SQLite)</p>
            <p>UI 组件：shadcn/ui (New York) + Lucide Icons + Framer Motion</p>
            <p>状态管理：Zustand + TanStack React Query</p>
            <p>数据图表：Recharts</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

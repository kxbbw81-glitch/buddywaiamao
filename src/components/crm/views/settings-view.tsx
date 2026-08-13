'use client'

import { useState } from 'react'
import { useCRMStore } from '@/store/use-crm-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ROLE_LABELS } from '@/lib/types'
import {
  User, Mail, Building2, Shield, Bell, Globe, Monitor, Info, Layers,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export function SettingsView() {
  const { currentUser } = useCRMStore()
  const { theme, setTheme } = useTheme()
  const [notifications, setNotifications] = useState({
    inquiry: true,
    approval: true,
    orderStatus: true,
    payment: true,
  })
  const [compactTable, setCompactTable] = useState(false)
  const [pageSize, setPageSize] = useState('20')

  if (!currentUser) return null

  const initials = currentUser.name.slice(0, 2)
  const roleLabel = ROLE_LABELS[currentUser.primaryRole as keyof typeof ROLE_LABELS] || currentUser.primaryRole

  const toggleNotif = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">个人设置</h2>
        <p className="text-sm text-muted-foreground">管理您的账户信息和偏好设置</p>
      </div>

      {/* Profile Card */}
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

      {/* Notification Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            通知偏好
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">询盘通知</p>
              <p className="text-xs text-muted-foreground">新询盘到达时通知</p>
            </div>
            <Switch
              checked={notifications.inquiry}
              onCheckedChange={() => toggleNotif('inquiry')}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">报价审批</p>
              <p className="text-xs text-muted-foreground">报价提交审批时通知</p>
            </div>
            <Switch
              checked={notifications.approval}
              onCheckedChange={() => toggleNotif('approval')}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">订单状态变更</p>
              <p className="text-xs text-muted-foreground">订单状态更新时通知</p>
            </div>
            <Switch
              checked={notifications.orderStatus}
              onCheckedChange={() => toggleNotif('orderStatus')}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">付款提醒</p>
              <p className="text-xs text-muted-foreground">逾期付款自动提醒</p>
            </div>
            <Switch
              checked={notifications.payment}
              onCheckedChange={() => toggleNotif('payment')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Display Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            显示设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">默认每页条数</p>
              <p className="text-xs text-muted-foreground">列表默认显示的数据条数</p>
            </div>
            <Select value={pageSize} onValueChange={setPageSize}>
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">紧凑表格模式</p>
              <p className="text-xs text-muted-foreground">减少表格行间距以显示更多数据</p>
            </div>
            <Switch
              checked={compactTable}
              onCheckedChange={setCompactTable}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">深色模式</p>
              <p className="text-xs text-muted-foreground">切换深色/浅色主题</p>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">界面语言</p>
              <p className="text-xs text-muted-foreground">选择系统显示语言</p>
            </div>
            <Badge variant="outline" className="text-xs">中文（简体）</Badge>
          </div>
        </CardContent>
      </Card>

      {/* About System */}
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

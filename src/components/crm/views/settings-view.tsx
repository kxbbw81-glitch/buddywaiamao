'use client'

import { useCRMStore } from '@/store/use-crm-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ROLE_LABELS } from '@/lib/types'
import { User, Mail, Building2, Shield, Bell, Globe } from 'lucide-react'
import { useTheme } from 'next-themes'

export function SettingsView() {
  const { currentUser } = useCRMStore()
  const { theme, setTheme } = useTheme()

  if (!currentUser) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">个人设置</h2>
        <p className="text-sm text-muted-foreground">管理您的账户信息和偏好设置</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
              <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {currentUser.name.slice(0, 2)}
              </span>
            </div>
            <div>
              <p className="font-medium">{currentUser.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">{ROLE_LABELS[currentUser.primaryRole as keyof typeof ROLE_LABELS] || currentUser.primaryRole}</Badge>
                {currentUser.department && <span className="text-sm text-muted-foreground">{currentUser.department}</span>}
              </div>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
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
                {ROLE_LABELS[currentUser.primaryRole as keyof typeof ROLE_LABELS] || currentUser.primaryRole}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            偏好设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            通知设置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">询盘通知</p>
              <p className="text-xs text-muted-foreground">新询盘到达时通知</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">报价到期提醒</p>
              <p className="text-xs text-muted-foreground">报价即将到期时提醒</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">付款提醒</p>
              <p className="text-xs text-muted-foreground">逾期付款自动提醒</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

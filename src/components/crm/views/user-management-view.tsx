'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  Crown,
  Users,
  UserCheck,
  Wallet,
  Plus,
  Search,
  Pencil,
  Power,
  UserX,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  Target,
  Package,
  FileText,
  FlaskConical,
  ShoppingCart,
  DollarSign,
  BarChart3,
  ClipboardList,
} from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { ROLE_LABELS } from '@/lib/types'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

type UserRecord = {
  id: string
  name: string
  email: string
  primaryRole: string
  department: string | null
  isActive: boolean
  createdAt: string
  _count: {
    assignedInquiries: number
    createdCustomers: number
    createdQuotations: number
    createdOrders: number
    activities: number
  }
}

// Role permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, { label: string; modules: string[]; color: string; bgLight: string; bgDark: string; icon: React.ElementType; borderColor: string }> = {
  super_admin: {
    label: '超级管理员',
    modules: ['全部权限'],
    color: 'text-emerald-700',
    bgLight: 'bg-emerald-50 border-emerald-200',
    bgDark: 'dark:bg-emerald-950/30 dark:border-emerald-800',
    icon: ShieldCheck,
    borderColor: 'border-l-emerald-500',
  },
  management: {
    label: '管理层',
    modules: ['工作台', '客户档案', '目标线索', '产品资料', '报价管理', '合同订单', '收款管理', '数据分析', '活动记录'],
    color: 'text-amber-700',
    bgLight: 'bg-amber-50 border-amber-200',
    bgDark: 'dark:bg-amber-950/30 dark:border-amber-800',
    icon: Crown,
    borderColor: 'border-l-amber-500',
  },
  sales_manager: {
    label: '销售经理',
    modules: ['工作台', '客户档案', '目标线索', '产品资料', '报价管理', '合同订单', '样品管理', '活动记录'],
    color: 'text-teal-700',
    bgLight: 'bg-teal-50 border-teal-200',
    bgDark: 'dark:bg-teal-950/30 dark:border-teal-800',
    icon: Users,
    borderColor: 'border-l-teal-500',
  },
  sales: {
    label: '销售专员',
    modules: ['工作台', '客户档案', '目标线索', '产品资料', '报价管理', '合同订单', '样品管理', '活动记录'],
    color: 'text-sky-700',
    bgLight: 'bg-sky-50 border-sky-200',
    bgDark: 'dark:bg-sky-950/30 dark:border-sky-800',
    icon: UserCheck,
    borderColor: 'border-l-sky-500',
  },
  finance: {
    label: '财务',
    modules: ['工作台', '客户档案', '报价管理', '合同订单', '收款管理', '数据分析'],
    color: 'text-rose-700',
    bgLight: 'bg-rose-50 border-rose-200',
    bgDark: 'dark:bg-rose-950/30 dark:border-rose-800',
    icon: Wallet,
    borderColor: 'border-l-rose-500',
  },
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  '工作台': LayoutDashboard,
  '客户档案': Users,
  '目标线索': Target,
  '产品资料': Package,
  '报价管理': FileText,
  '合同订单': ShoppingCart,
  '样品管理': FlaskConical,
  '收款管理': DollarSign,
  '数据分析': BarChart3,
  '活动记录': ClipboardList,
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  super_admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  management: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  sales_manager: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  sales: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  finance: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
}

export function UserManagementView() {
  const { currentUser } = useCRMStore()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [toggleUser, setToggleUser] = useState<UserRecord | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('sales')
  const [formDepartment, setFormDepartment] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', searchQuery],
    queryFn: () =>
      fetch(`/api/users${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`)
        .then((r) => r.json()),
    staleTime: 30000,
  })

  const users: UserRecord[] = usersData?.data || []
  const totalUsers: number = usersData?.total || 0

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; primaryRole: string; department: string }) => {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const result = await res.json()
        if (!result.success) throw new Error(result.error)
        return result
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const result = await res.json()
        if (!result.success) throw new Error(result.error)
        return result
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeDialog()
      toast.success(editingUser ? '用户已更新' : '用户已创建')
    },
    onError: (error: Error) => {
      setFormError(error.message)
    },
  })

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(toggleUser?.isActive ? '用户已停用' : '用户已启用')
      setToggleUser(null)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const openCreateDialog = useCallback(() => {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormRole('sales')
    setFormDepartment('')
    setFormError('')
    setDialogOpen(true)
  }, [])

  const openEditDialog = useCallback((user: UserRecord) => {
    setEditingUser(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormRole(user.primaryRole as UserRole)
    setFormDepartment(user.department || '')
    setFormError('')
    setDialogOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setDialogOpen(false)
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormRole('sales')
    setFormDepartment('')
    setFormError('')
    setFormSubmitting(false)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formName.trim() || !formEmail.trim() || !formRole) {
      setFormError('请填写所有必填项')
      return
    }
    setFormError('')
    setFormSubmitting(true)
    try {
      await saveMutation.mutateAsync({
        name: formName.trim(),
        email: formEmail.trim(),
        primaryRole: formRole,
        department: formDepartment.trim() || undefined,
      })
    } finally {
      setFormSubmitting(false)
    }
  }, [formName, formEmail, formRole, formDepartment, saveMutation])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // Non-super_admin guard
  if (currentUser?.primaryRole !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldCheck className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground text-lg">无权访问此页面</p>
        <p className="text-sm text-muted-foreground/70 mt-1">仅超级管理员可访问权限中心</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">权限中心</h1>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                {totalUsers} 位用户
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">管理系统用户和角色权限配置</p>
          </div>
        </div>
        <Button onClick={openCreateDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          新建用户
        </Button>
      </motion.div>

      {/* User List Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base">用户列表</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索姓名、邮箱或部门..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">{searchQuery ? '未找到匹配的用户' : '暂无用户数据'}</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px]">姓名</TableHead>
                    <TableHead className="w-[200px]">邮箱</TableHead>
                    <TableHead className="w-[100px]">主角色</TableHead>
                    <TableHead className="w-[100px]">部门</TableHead>
                    <TableHead className="w-[80px]">状态</TableHead>
                    <TableHead className="w-[100px]">创建时间</TableHead>
                    <TableHead className="w-[120px] text-right pr-4">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn('text-xs', ROLE_BADGE_STYLES[user.primaryRole] || '')}
                        >
                          {ROLE_LABELS[user.primaryRole as UserRole] || user.primaryRole}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{user.department || '-'}</TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            活跃
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 gap-1">
                            <XCircle className="h-3 w-3" />
                            停用
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditDialog(user)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'h-8 w-8 p-0',
                              user.isActive
                                ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
                            )}
                            onClick={() => setToggleUser(user)}
                          >
                            {user.isActive ? <Power className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold">角色权限概览</h2>
          <Badge variant="outline" className="text-xs">只读</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(Object.entries(ROLE_PERMISSIONS) as [UserRole, typeof ROLE_PERMISSIONS[UserRole]][]).map(
            ([role, config]) => {
              const Icon = config.icon
              return (
                <motion.div
                  key={role}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <Card
                    className={cn(
                      'border-l-4 overflow-hidden transition-shadow hover:shadow-md',
                      config.bgLight,
                      config.bgDark,
                      config.borderColor
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', config.bgLight, config.bgDark)}>
                          <Icon className={cn('h-5 w-5', config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base">{config.label}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {role === 'super_admin' ? '拥有系统全部权限' : `${config.modules.length} 个模块权限`}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {role === 'super_admin' ? (
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <ShieldCheck className={cn('h-4 w-4', config.color)} />
                          <span className={config.color}>全部权限</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {config.modules.map((mod) => {
                            const ModIcon = MODULE_ICONS[mod]
                            return (
                              <div
                                key={mod}
                                className={cn(
                                  'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md',
                                  config.bgLight,
                                  config.bgDark,
                                  config.color
                                )}
                              >
                                {ModIcon && <ModIcon className="h-3 w-3" />}
                                <span>{mod}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            }
          )}
        </div>
      </motion.div>

      {/* Create/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? '编辑用户' : '新建用户'}</DialogTitle>
            <DialogDescription>
              {editingUser ? '修改用户的基本信息和角色配置' : '填写新用户的基本信息'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="user-name">
                姓名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-name"
                placeholder="请输入姓名"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">
                邮箱 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-email"
                type="email"
                placeholder="请输入邮箱"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-role">
                主角色 <span className="text-destructive">*</span>
              </Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as UserRole)}>
                <SelectTrigger id="user-role">
                  <SelectValue placeholder="请选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4', ROLE_BADGE_STYLES[key])}>
                          {label}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-dept">部门</Label>
              <Input
                id="user-dept"
                placeholder="请输入部门（选填）"
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" />
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={formSubmitting}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={formSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {formSubmitting ? '提交中...' : editingUser ? '保存修改' : '创建用户'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Active AlertDialog */}
      <AlertDialog open={!!toggleUser} onOpenChange={(open) => { if (!open) setToggleUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {toggleUser?.isActive ? (
                <>
                  <UserX className="h-5 w-5 text-amber-500" />
                  确认停用用户
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  确认启用用户
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleUser?.isActive
                ? `确定要停用用户「${toggleUser?.name}」吗？停用后该用户将无法登录系统。`
                : `确定要启用用户「${toggleUser?.name}」吗？启用后该用户可以正常登录系统。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toggleUser) {
                  toggleMutation.mutate({
                    id: toggleUser.id,
                    isActive: !toggleUser.isActive,
                  })
                }
              }}
              className={cn(
                toggleUser?.isActive
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              )}
            >
              {toggleUser?.isActive ? '确认停用' : '确认启用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

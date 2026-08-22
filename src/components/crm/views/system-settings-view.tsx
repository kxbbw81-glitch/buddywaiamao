'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  Building2,
  RefreshCw,
  Save,
  Network,
  GitBranch,
  Workflow,
  FileText,
  Plug,
  ShieldCheck,
  Globe,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'

type CompanyData = {
  companyName: string
  website: string
  email: string
  mainProducts: string
  phone: string
  address: string
  updatedAt: string | null
}

type MirrorData = {
  url: string
  lastCheckedAt: string | null
  lastKnownVersion: string
}

type VersionData = {
  currentVersion: string
  latestVersion: string
  lastCheckedAt: string | null
}

const EXTENSION_CARDS = [
  {
    key: 'org',
    icon: Network,
    color: '#534AB7',
    title: '组织架构',
    desc: '部门、汇报关系、岗位与角色映射',
  },
  {
    key: 'flow',
    icon: Workflow,
    color: '#185FA5',
    title: '流程配置',
    desc: '收款门禁、报价审批流、单证放行规则',
  },
  {
    key: 'template',
    icon: FileText,
    color: '#854F0B',
    title: '模板管理',
    desc: '邮件、单证、报价单模板维护',
  },
  {
    key: 'integration',
    icon: Plug,
    color: '#0F6E56',
    title: '外部集成',
    desc: '汇率源、物流、邮件、社媒授权',
  },
] as const

const formatLastChecked = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function SystemSettingsView() {
  const queryClient = useQueryClient()

  const [company, setCompany] = useState<CompanyData>({
    companyName: '',
    website: '',
    email: '',
    mainProducts: '',
    phone: '',
    address: '',
    updatedAt: null,
  })
  const [activeCard, setActiveCard] = useState<(typeof EXTENSION_CARDS)[number] | null>(null)
  const [mirrorUrl, setMirrorUrl] = useState('')

  const companyQuery = useQuery({
    queryKey: ['admin-company'],
    queryFn: async () => {
      const r = await fetch('/api/admin/settings/company')
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error || '读取失败')
      return j.data as CompanyData
    },
  })

  const versionQuery = useQuery({
    queryKey: ['admin-version'],
    queryFn: async () => {
      const r = await fetch('/api/admin/settings/version')
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error || '读取失败')
      return j.data as VersionData
    },
  })

  const mirrorQuery = useQuery({
    queryKey: ['admin-mirror'],
    queryFn: async () => {
      const r = await fetch('/api/admin/settings/mirror')
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error || '读取失败')
      return j.data as MirrorData
    },
  })

  // 受控表单：拉取后回填
  useEffect(() => {
    if (companyQuery.data) setCompany(companyQuery.data)
  }, [companyQuery.data])
  useEffect(() => {
    if (mirrorQuery.data) setMirrorUrl(mirrorQuery.data.url ?? '')
  }, [mirrorQuery.data])

  const saveCompany = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/settings/company', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(company),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error || '保存失败')
      return j.data
    },
    onSuccess: () => {
      toast.success('公司资料已保存')
      queryClient.invalidateQueries({ queryKey: ['admin-company'] })
    },
    onError: (e: Error) => toast.error(`保存失败：${e.message}`),
  })

  const saveMirror = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/settings/mirror', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: mirrorUrl }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error || '保存失败')
      return j.data
    },
    onSuccess: () => {
      toast.success('镜像源已保存')
      queryClient.invalidateQueries({ queryKey: ['admin-mirror'] })
    },
    onError: (e: Error) => toast.error(`保存失败：${e.message}`),
  })

  const checkUpdate = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/settings/check-update', { method: 'POST' })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.error || '检查失败')
      return j.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-version'] })
      queryClient.invalidateQueries({ queryKey: ['admin-mirror'] })
      if (data.status === 'up_to_date') toast.success(`已是最新版本 ${data.latestVersion}`)
      else toast.success(`发现新版本 ${data.latestVersion}`)
    },
    onError: (e: Error) => toast.error(`检查更新失败：${e.message}`),
  })

  return (
    <div className="space-y-4 p-1">
      {/* 面包屑 */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="text-muted-foreground">系统管理</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium text-foreground">系统设置</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <ShieldCheck className="size-5 text-muted-foreground" />
          系统设置
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          公司资料（对外单证与邮件抬头的来源）与系统更新：组织架构 / 流程配置 / 模板管理 / 外部集成等扩展设置。
          账号管理请前往「账号与权限」子页。仅超级管理员。
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ===== 公司资料 + 系统更新 ===== */}
        <div className="space-y-4 lg:col-span-2">
          {/* 公司资料 */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-4 text-[#185FA5]" />
                  公司资料
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => saveCompany.mutate()}
                  disabled={saveCompany.isPending || companyQuery.isLoading}
                >
                  <Save className="mr-1 size-3.5" />
                  {saveCompany.isPending ? '保存中…' : '保存'}
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                {companyQuery.isLoading ? (
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
                    <Field label="公司名称" required>
                      <Input
                        value={company.companyName}
                        onChange={(e) => setCompany((s) => ({ ...s, companyName: e.target.value }))}
                        placeholder="请输入公司中文或英文名称"
                      />
                    </Field>
                    <Field label="公司官网">
                      <div className="relative">
                        <Globe className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          value={company.website}
                          onChange={(e) => setCompany((s) => ({ ...s, website: e.target.value }))}
                          placeholder="https://www.example.com"
                        />
                      </div>
                    </Field>
                    <Field label="对外邮箱">
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          type="email"
                          value={company.email}
                          onChange={(e) => setCompany((s) => ({ ...s, email: e.target.value }))}
                          placeholder="sales@example.com"
                        />
                      </div>
                    </Field>
                    <Field label="公司电话">
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          value={company.phone}
                          onChange={(e) => setCompany((s) => ({ ...s, phone: e.target.value }))}
                          placeholder="+86 755 8888 6666"
                        />
                      </div>
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="主营业务">
                        <Input
                          value={company.mainProducts}
                          onChange={(e) => setCompany((s) => ({ ...s, mainProducts: e.target.value }))}
                          placeholder="例：LED 照明、智能家居、工业配件（出口欧美 12 年）"
                        />
                      </Field>
                    </div>
                    <div className="md:col-span-2">
                      <Field label="公司地址">
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-8"
                            value={company.address}
                            onChange={(e) => setCompany((s) => ({ ...s, address: e.target.value }))}
                            placeholder="例：深圳市宝安区百乡街道 XX 大厦 8 楼"
                          />
                        </div>
                      </Field>
                    </div>
                  </div>
                )}
                {company.updatedAt && (
                  <p className="mt-3 text-right text-xs text-muted-foreground">
                    最近更新：{formatLastChecked(company.updatedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* 系统更新 */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between border-b">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="size-4 text-[#0F6E56]" />
                  系统更新
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => checkUpdate.mutate()}
                  disabled={checkUpdate.isPending || versionQuery.isLoading}
                >
                  <RefreshCw className={`mr-1 size-3.5 ${checkUpdate.isPending ? 'animate-spin' : ''}`} />
                  {checkUpdate.isPending ? '检查中…' : '检查更新'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <SettingRow
                  label="当前版本"
                  value={versionQuery.isLoading ? '…' : versionQuery.data?.currentVersion || 'v3.6.0'}
                  valueClassName="font-mono"
                />
                <SettingRow
                  label="最新版本"
                  value={
                    versionQuery.isLoading
                      ? '…'
                      : versionQuery.data?.latestVersion || '尚未检查'
                  }
                  valueClassName="font-mono"
                />
                <SettingRow
                  label="上次检查"
                  value={
                    versionQuery.isLoading
                      ? '…'
                      : formatLastChecked(versionQuery.data?.lastCheckedAt || mirrorQuery.data?.lastCheckedAt)
                  }
                  valueClassName="font-mono"
                />
                <div className="border-t pt-4">
                  <h3 className="mb-2 text-sm font-medium">镜像源配置</h3>
                  <div className="flex gap-2">
                    <Input
                      className="flex-1 font-mono text-xs"
                      value={mirrorUrl}
                      onChange={(e) => setMirrorUrl(e.target.value)}
                      placeholder="https://gitee.com/your-org/crm-releases/raw/main"
                    />
                    <Button
                      variant="outline"
                      onClick={() => saveMirror.mutate()}
                      disabled={saveMirror.isPending}
                    >
                      <Save className="mr-1 size-3.5" />
                      保存
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    填写带签名 manifest.json 所在目录，正式更新会先备份数据库。备份失败时回退不覆盖程序。
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ===== 扩展设置 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1"
        >
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <Workflow className="size-4 text-[#534AB7]" />
                扩展设置
              </CardTitle>
              <Button variant="link" size="sm" className="text-xs">
                说明
              </Button>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-4">
              {EXTENSION_CARDS.map((c) => {
                const Icon = c.icon
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setActiveCard(c)}
                    className="group w-full rounded-lg border border-transparent bg-muted/40 p-3 text-left transition-all hover:border-border hover:bg-background hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex size-9 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${c.color}1A`, color: c.color }}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{c.title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{c.desc}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 扩展设置说明弹窗 */}
      <Dialog open={!!activeCard} onOpenChange={(o) => !o && setActiveCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeCard && (
                <>
                  <activeCard.icon className="size-4" style={{ color: activeCard.color }} />
                  {activeCard.title}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {activeCard?.desc}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="mb-1.5 font-medium text-foreground">后续模块支持</p>
            <p>
              该扩展能力归属 Phase 2 蓝图卡，详情设计文档：组织架构 → 部门 → 用户 → 角色映射；流程配置 →
              收款门禁/审批/放行 3 类规则；模板管理 → 邮件/单证/报价单三类字段模板；外部集成 →
              汇率源 7×24 拉取、物流单号回写、IMAP/SMTP 授权、主流社媒 OAuth。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

function SettingRow({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="flex items-center justify-between border-b border-dashed pb-2 text-sm last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClassName || ''}>{value}</span>
    </div>
  )
}

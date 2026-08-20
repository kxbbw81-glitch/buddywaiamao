'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Eye, MessageSquare, Share2, Pencil, Trash2, Copy, ChevronLeft, ChevronRight,
  FileText, TrendingUp, BarChart3, CalendarDays, Zap, Filter,
  Linkedin, Instagram, Twitter, Globe2, ShoppingBag, X, Search,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/utils'
import type { SocialPlatform, SocialPostStatus } from '@/lib/types'
import { SOCIAL_PLATFORM_LABELS, SOCIAL_POST_STATUS_LABELS } from '@/lib/types'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useToast } from '@/hooks/use-toast'

// ============ Constants ============

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bgClass: string; textClass: string; borderClass: string; icon: React.ElementType }> = {
  linkedin: { label: 'LinkedIn', color: '#0077b5', bgClass: 'bg-[#0077b5]', textClass: 'text-[#0077b5]', borderClass: 'border-l-[#0077b5]', icon: Linkedin },
  facebook: { label: 'Facebook', color: '#64748b', bgClass: 'bg-slate-500', textClass: 'text-slate-500', borderClass: 'border-l-slate-500', icon: Globe2 },
  twitter: { label: 'Twitter', color: '#64748b', bgClass: 'bg-slate-500', textClass: 'text-slate-500', borderClass: 'border-l-slate-500', icon: Twitter },
  instagram: { label: 'Instagram', color: '#e11d48', bgClass: 'bg-rose-500', textClass: 'text-rose-500', borderClass: 'border-l-rose-500', icon: Instagram },
  alibaba: { label: '阿里巴巴', color: '#f97316', bgClass: 'bg-orange-500', textClass: 'text-orange-500', borderClass: 'border-l-orange-500', icon: ShoppingBag },
}

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  scheduled: 'outline',
  published: 'default',
  failed: 'destructive',
}

const PIE_COLORS = ['#10b981', '#14b8a6', '#f59e0b', '#e11d48', '#f97316']

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

// ============ Types ============

interface PostData {
  id: string
  title: string
  content: string
  platform: string
  status: string
  scheduledAt: string | null
  publishedAt: string | null
  customerId: string | null
  productId: string | null
  tags: string
  likes: number
  comments: number
  shares: number
  clicks: number
  createdAt: string
  customer?: { id: string; companyName: string; country: string | null } | null
  product?: { id: string; name: string; productCode: string } | null
  creator?: { id: string; name: string } | null
}

interface FormData {
  title: string
  platform: string
  content: string
  tags: string
  status: string
  scheduledAt: string
  customerId: string
  productId: string
}

// ============ Main Component ============

export function SocialMediaView() {
  const [activeTab, setActiveTab] = useState('content')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    title: '', platform: 'linkedin', content: '', tags: '', status: 'draft',
    scheduledAt: '', customerId: '', productId: '',
  })
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Fetch posts
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['social-posts', platformFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (platformFilter !== 'all') params.set('platform', platformFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('pageSize', '100')
      return fetch(`/api/social-posts?${params}`).then(r => r.json()).then(d => d.data || [])
    },
  })

  // Fetch calendar posts
  const calMonth = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}`
  const { data: calPosts } = useQuery({
    queryKey: ['social-posts-calendar', calMonth],
    queryFn: () => {
      return fetch(`/api/social-posts?month=${calMonth}&pageSize=100`).then(r => r.json()).then(d => d.data || [])
    },
    enabled: activeTab === 'calendar',
  })

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['social-posts-stats'],
    queryFn: () => fetch('/api/social-posts/stats').then(r => r.json()).then(d => d.data),
    enabled: activeTab === 'stats',
  })

  // Fetch customers for combobox
  const { data: customers } = useQuery({
    queryKey: ['customers-combobox'],
    queryFn: () => fetch('/api/customers?pageSize=100').then(r => r.json()).then(d => d.data || []),
    enabled: dialogOpen,
  })

  // Fetch products for combobox
  const { data: products } = useQuery({
    queryKey: ['products-combobox'],
    queryFn: () => fetch('/api/products?pageSize=100').then(r => r.json()).then(d => d.data || []),
    enabled: dialogOpen,
  })

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const tagsArr = data.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean)
      const payload = { ...data, tags: JSON.stringify(tagsArr) }
      if (editingId) {
        return fetch(`/api/social-posts/${editingId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        }).then(r => r.json())
      }
      return fetch('/api/social-posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }).then(r => r.json())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      queryClient.invalidateQueries({ queryKey: ['social-posts-stats'] })
      queryClient.invalidateQueries({ queryKey: ['social-posts-calendar'] })
      setDialogOpen(false)
      setEditingId(null)
      resetForm()
      toast({ title: editingId ? '更新成功' : '创建成功' })
    },
    onError: () => {
      toast({ title: '操作失败', variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/social-posts/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      queryClient.invalidateQueries({ queryKey: ['social-posts-stats'] })
      queryClient.invalidateQueries({ queryKey: ['social-posts-calendar'] })
      toast({ title: '删除成功' })
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: async (post: PostData) => {
      const payload = {
        title: `${post.title} (副本)`,
        content: post.content,
        platform: post.platform,
        status: 'draft',
        tags: post.tags,
        customerId: post.customerId,
        productId: post.productId,
      }
      return fetch('/api/social-posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }).then(r => r.json())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
      toast({ title: '复制成功' })
    },
  })

  const resetForm = useCallback(() => {
    setForm({ title: '', platform: 'linkedin', content: '', tags: '', status: 'draft', scheduledAt: '', customerId: '', productId: '' })
  }, [])

  const openCreate = useCallback(() => {
    resetForm()
    setEditingId(null)
    setDialogOpen(true)
  }, [resetForm])

  const openEdit = useCallback((post: PostData) => {
    const tagsArr = JSON.parse(post.tags || '[]')
    setForm({
      title: post.title,
      platform: post.platform,
      content: post.content,
      tags: tagsArr.join(', '),
      status: post.status,
      scheduledAt: post.scheduledAt ? post.scheduledAt.slice(0, 16) : '',
      customerId: post.customerId || '',
      productId: post.productId || '',
    })
    setEditingId(post.id)
    setDialogOpen(true)
  }, [])

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: (Date | null)[] = []
    for (let i = 0; i < startDow; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d))
    return days
  }, [calendarMonth])

  const calendarPostMap = useMemo(() => {
    const map: Record<string, PostData[]> = {}
    for (const p of calPosts || []) {
      const date = p.scheduledAt ? p.scheduledAt.slice(0, 10) : p.createdAt.slice(0, 10)
      if (!map[date]) map[date] = []
      map[date].push(p)
    }
    return map
  }, [calPosts])

  const selectedDateStr = selectedDate ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` : ''
  const selectedDayPosts = selectedDateStr ? (calendarPostMap[selectedDateStr] || []) : []

  const today = new Date()
  const isToday = (d: Date) =>
    d && d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()

  const prevMonth = () => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  const goToday = () => { setCalendarMonth(new Date()); setSelectedDate(new Date()) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">社媒运营</h1>
          <p className="text-sm text-muted-foreground mt-1">管理社交媒体内容发布和互动数据</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Plus className="h-4 w-4" />
          新建帖子
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="content" className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <FileText className="h-3.5 w-3.5" /> 内容管理
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <CalendarDays className="h-3.5 w-3.5" /> 发布日历
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <BarChart3 className="h-3.5 w-3.5" /> 数据统计
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <div className="mt-6">
          {activeTab === 'content' && (
            <ContentTab
              posts={postsData || []}
              loading={postsLoading}
              platformFilter={platformFilter}
              statusFilter={statusFilter}
              setPlatformFilter={setPlatformFilter}
              setStatusFilter={setStatusFilter}
              onEdit={openEdit}
              onDelete={(id) => deleteMutation.mutate(id)}
              onDuplicate={duplicateMutation.mutate}
            />
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <CalendarTab
              calendarMonth={calendarMonth}
              calendarDays={calendarDays}
              calendarPostMap={calendarPostMap}
              selectedDate={selectedDate}
              selectedDayPosts={selectedDayPosts}
              isToday={isToday}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              onGoToday={goToday}
              onSelectDate={setSelectedDate}
              onEdit={openEdit}
            />
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <StatsTab stats={stats} loading={statsLoading} />
          )}
        </div>
      </Tabs>

      {/* Post Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingId(null); resetForm() } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑帖子' : '新建帖子'}</DialogTitle>
            <DialogDescription>{editingId ? '修改社媒帖子内容' : '创建新的社媒帖子'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>标题</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="帖子标题" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>平台</Label>
                <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SOCIAL_PLATFORM_LABELS) as [SocialPlatform, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>状态</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(SOCIAL_POST_STATUS_LABELS) as [SocialPostStatus, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>内容</Label>
              <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="帖子内容..." rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>标签（逗号分隔）</Label>
                <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="标签1, 标签2" />
              </div>
              {form.status === 'scheduled' && (
                <div className="grid gap-2">
                  <Label>排期时间</Label>
                  <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>关联客户（可选）</Label>
                <CustomerCombobox customers={customers || []} value={form.customerId} onChange={v => setForm(f => ({ ...f, customerId: v }))} />
              </div>
              <div className="grid gap-2">
                <Label>关联产品（可选）</Label>
                <ProductCombobox products={products || []} value={form.productId} onChange={v => setForm(f => ({ ...f, productId: v }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); resetForm() }}>取消</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.title.trim()}
            >
              {saveMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============ Content Tab ============

function ContentTab({ posts, loading, platformFilter, statusFilter, setPlatformFilter, setStatusFilter, onEdit, onDelete, onDuplicate }: {
  posts: PostData[]
  loading: boolean
  platformFilter: string
  statusFilter: string
  setPlatformFilter: (v: string) => void
  setStatusFilter: (v: string) => void
  onEdit: (p: PostData) => void
  onDelete: (id: string) => void
  onDuplicate: (p: PostData) => void
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>筛选:</span>
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="全部平台" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            {(Object.entries(SOCIAL_PLATFORM_LABELS) as [SocialPlatform, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {(Object.entries(SOCIAL_POST_STATUS_LABELS) as [SocialPostStatus, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">共 {posts.length} 条</span>
      </div>

      {/* Post Cards */}
      {posts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {posts.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ============ Post Card ============

function PostCard({ post, index, onEdit, onDelete, onDuplicate }: {
  post: PostData; index: number; onEdit: (p: PostData) => void; onDelete: (id: string) => void; onDuplicate: (p: PostData) => void
}) {
  const config = PLATFORM_CONFIG[post.platform] || PLATFORM_CONFIG.linkedin
  const PlatformIcon = config.icon
  const tagsArr = JSON.parse(post.tags || '[]')

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Card className={cn(
        'overflow-hidden transition-all duration-200 hover:shadow-md border-l-[3px]',
        config.borderClass,
      )}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Platform icon */}
            <div className={cn('shrink-0 w-10 h-10 rounded-lg flex items-center justify-center', config.bgClass, 'bg-opacity-10')}>
              <PlatformIcon className={cn('h-5 w-5', config.textClass)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={cn('text-sm font-medium', config.textClass)}>{config.label}</span>
                <Badge variant={STATUS_VARIANT[post.status] || 'secondary'} className="text-xs">
                  {SOCIAL_POST_STATUS_LABELS[post.status as SocialPostStatus] || post.status}
                </Badge>
                {(post.scheduledAt || post.publishedAt) && (
                  <span className="text-xs text-muted-foreground">
                    {post.scheduledAt ? `排期: ${post.scheduledAt.slice(0, 16).replace('T', ' ')}` : ''}
                    {post.publishedAt ? `发布: ${post.publishedAt.slice(0, 16).replace('T', ' ')}` : ''}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-sm mb-1 truncate">{post.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.content}</p>

              {/* Tags & Relations */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                {tagsArr.map((tag: string, ti: number) => (
                  <Badge key={ti} variant="outline" className="text-xs font-normal px-2 py-0">#{tag}</Badge>
                ))}
                {post.customer && (
                  <Badge variant="secondary" className="text-xs font-normal gap-1">
                    <Globe2 className="h-3 w-3" /> {post.customer.companyName}
                  </Badge>
                )}
                {post.product && (
                  <Badge variant="secondary" className="text-xs font-normal gap-1">
                    <Zap className="h-3 w-3" /> {post.product.name}
                  </Badge>
                )}
              </div>

              {/* Engagement */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{formatNumber(post.likes)}</span>
                <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{formatNumber(post.comments)}</span>
                <span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" />{formatNumber(post.shares)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex sm:flex-col gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(post)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDuplicate(post)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(post.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============ Empty State ============

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
        <Share2 className="h-9 w-9 text-emerald-400" />
      </div>
      <h3 className="text-base font-medium mb-1">还没有社媒内容</h3>
      <p className="text-sm text-muted-foreground">点击新建开始创作</p>
    </div>
  )
}

// ============ Calendar Tab ============

function CalendarTab({ calendarMonth, calendarDays, calendarPostMap, selectedDate, selectedDayPosts, isToday, onPrevMonth, onNextMonth, onGoToday, onSelectDate, onEdit }: {
  calendarMonth: Date
  calendarDays: (Date | null)[]
  calendarPostMap: Record<string, PostData[]>
  selectedDate: Date | null
  selectedDayPosts: PostData[]
  isToday: (d: Date) => boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onGoToday: () => void
  onSelectDate: (d: Date | null) => void
  onEdit: (p: PostData) => void
}) {
  const monthLabel = `${calendarMonth.getFullYear()}年${calendarMonth.getMonth() + 1}月`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">发布日历</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onGoToday}>今天</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium min-w-[100px] text-center">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">周{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="h-16" />
              const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
              const hasPosts = (calendarPostMap[dateStr]?.length || 0) > 0
              const isSelected = selectedDate && day.getFullYear() === selectedDate.getFullYear() && day.getMonth() === selectedDate.getMonth() && day.getDate() === selectedDate.getDate()
              const todayFlag = isToday(day)
              return (
                <button
                  key={dateStr}
                  onClick={() => onSelectDate(day)}
                  className={cn(
                    'h-16 rounded-lg text-sm flex flex-col items-center justify-center gap-1 transition-all hover:bg-muted/50 relative',
                    isSelected && 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-400',
                  )}
                >
                  <span className={cn(
                    'text-sm',
                    todayFlag && 'bg-emerald-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-medium',
                  )}>
                    {day.getDate()}
                  </span>
                  {hasPosts && !isSelected && (
                    <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day detail panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedDate
              ? `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 排期内容`
              : '选择日期查看详情'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedDayPosts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">暂无排期内容</p>
            )}
            {selectedDayPosts.map(post => {
              const cfg = PLATFORM_CONFIG[post.platform] || PLATFORM_CONFIG.linkedin
              const PI = cfg.icon
              return (
                <div
                  key={post.id}
                  className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => onEdit(post)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <PI className={cn('h-4 w-4', cfg.textClass)} />
                    <span className="text-xs font-medium">{cfg.label}</span>
                    <Badge variant={STATUS_VARIANT[post.status] || 'secondary'} className="text-[10px] ml-auto">
                      {SOCIAL_POST_STATUS_LABELS[post.status as SocialPostStatus] || post.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium truncate">{post.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.content}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============ Stats Tab ============

function StatsTab({ stats, loading }: {
  stats: {
    totalPosts: number
    publishedPosts: number
    totalEngagement: number
    avgEngagementRate: number
    platformDistribution: { platform: string; count: number }[]
    monthlyTrend: { month: string; likes: number; comments: number; shares: number; clicks: number; engagement: number }[]
  } | undefined
  loading: boolean
}) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    )
  }

  const kpis = [
    { label: '总帖子数', value: formatNumber(stats.totalPosts), icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: '已发布', value: formatNumber(stats.publishedPosts), icon: Share2, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/30' },
    { label: '总互动量', value: formatNumber(stats.totalEngagement), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    { label: '平均互动率', value: `${stats.avgEngagementRate}%`, icon: BarChart3, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30' },
  ]

  // Pie chart data
  const pieData = stats.platformDistribution.map((d) => ({
    name: PLATFORM_CONFIG[d.platform]?.label || d.platform,
    value: d.count,
  }))

  // Area chart data
  const areaData = stats.monthlyTrend.map((d) => ({
    ...d,
    label: d.month.slice(5),
  }))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon
          return (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2.5 rounded-lg', kpi.bg)}>
                      <Icon className={cn('h-5 w-5', kpi.color)} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      <p className="text-xl font-bold tabular-nums crm-number">{kpi.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">平台分布</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">暂无数据</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {pieData.map((d, i) => (
                    <span key={d.name} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.name} ({d.value})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Engagement Trend Area Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">互动趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {areaData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">暂无数据</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaData}>
                    <defs>
                      <linearGradient id="engagementGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    />
                    <Area type="monotone" dataKey="engagement" stroke="#10b981" fill="url(#engagementGrad)" strokeWidth={2} name="互动量" />
                    <Area type="monotone" dataKey="likes" stroke="#14b8a6" fill="none" strokeWidth={1.5} strokeDasharray="4 4" name="点赞" />
                    <Area type="monotone" dataKey="comments" stroke="#f59e0b" fill="none" strokeWidth={1.5} strokeDasharray="4 4" name="评论" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============ Customer Combobox ============

function CustomerCombobox({ customers, value, onChange }: {
  customers: { id: string; companyName: string; country: string | null }[]
  value: string
  onChange: (v: string) => void
}) {
  const selected = customers.find(c => c.id === value)
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selected ? selected.companyName : '选择客户...'}
          <X className={cn('ml-2 h-4 w-4 shrink-0', value && 'opacity-100')} onClick={(e) => { e.stopPropagation(); onChange('') }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索客户..." />
          <CommandList>
            <CommandEmpty>未找到客户</CommandEmpty>
            <CommandGroup>
              {customers.map(c => (
                <CommandItem key={c.id} value={c.companyName} onSelect={() => { onChange(c.id); setOpen(false) }}>
                  <Search className="mr-2 h-4 w-4 shrink-0" />
                  {c.companyName}
                  {c.country && <span className="ml-2 text-xs text-muted-foreground">{c.country}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ============ Product Combobox ============

function ProductCombobox({ products, value, onChange }: {
  products: { id: string; name: string; productCode: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const selected = products.find(p => p.id === value)
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selected ? `${selected.productCode} ${selected.name}` : '选择产品...'}
          <X className={cn('ml-2 h-4 w-4 shrink-0', value && 'opacity-100')} onClick={(e) => { e.stopPropagation(); onChange('') }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索产品..." />
          <CommandList>
            <CommandEmpty>未找到产品</CommandEmpty>
            <CommandGroup>
              {products.map(p => (
                <CommandItem key={p.id} value={`${p.productCode} ${p.name}`} onSelect={() => { onChange(p.id); setOpen(false) }}>
                  <Search className="mr-2 h-4 w-4 shrink-0" />
                  {p.productCode} - {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

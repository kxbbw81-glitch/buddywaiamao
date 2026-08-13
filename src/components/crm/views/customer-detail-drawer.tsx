'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Globe, MapPin, Building2, ExternalLink, Edit, ShoppingCart,
  Phone, Mail, UserCircle, Star, ChevronRight, FileText, Plus,
  MessageCircle, Loader2, UserPlus, Pencil, Trash2,
} from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { StatusBadge } from '@/components/crm/status-badge'
import { DetailSkeleton } from '@/components/crm/loading-skeleton'
import { INQUIRY_SOURCE_LABELS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const COUNTRY_FLAGS: Record<string, string> = {
  '美国': '🇺🇸', '德国': '🇩🇪', '阿联酋': '🇦🇪', '日本': '🇯🇵', '尼日利亚': '🇳🇬',
  '马来西亚': '🇲🇾', '瑞典': '🇸🇪', '印度': '🇮🇳', '英国': '🇬🇧', '法国': '🇫🇷',
  '巴西': '🇧🇷', '澳大利亚': '🇦🇺', '韩国': '🇰🇷', '中国': '🇨🇳',
}

function ContactInlineForm({ customerId }: { customerId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [isDecisionMaker, setIsDecisionMaker] = useState(false)
  

  const handleSave = async () => {
    if (!name.trim()) { toast.error('请输入联系人姓名'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          name: name.trim(), position: position.trim() || undefined,
          email: email.trim() || undefined, phone: phone.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined, isDecisionMaker,
        }),
      })
      if (res.ok) {
        toast.success('联系人已添加')
        queryClient.invalidateQueries({ queryKey: ['customer', customerId] })
        setName(''); setPosition(''); setEmail(''); setPhone(''); setWhatsapp(''); setIsDecisionMaker(false)
        setExpanded(false)
      } else { toast.error('添加失败') }
    } catch { toast.error('网络错误') }
    finally { setSaving(false) }
  }

  return (
    <Card className="border-dashed">
      {expanded ? (
        <div className="p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-1.5"><UserPlus className="h-4 w-4 text-emerald-600" />新建联系人</p>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="姓名 *" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
            <Input placeholder="职位" value={position} onChange={(e) => setPosition(e.target.value)} className="h-8 text-sm" />
            <Input placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" type="email" />
            <Input placeholder="电话" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-sm" />
            <Input placeholder="WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="h-8 text-sm" />
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer h-8">
              <input type="checkbox" checked={isDecisionMaker} onChange={(e) => setIsDecisionMaker(e.target.checked)} className="rounded border-input" />
              决策者
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpanded(false)}>取消</Button>
            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
              添加
            </Button>
          </div>
        </div>
      ) : (
        <button
          className="w-full flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
          onClick={() => setExpanded(true)}
        >
          <UserPlus className="h-4 w-4" />
          添加联系人
        </button>
      )}
    </Card>
  )
}

export function CustomerDetailDrawer() {
  const { selectedCustomerId, selectCustomer, selectQuotation, openCustomerForm, openInquiryForm, openQuotationForm, currentUser } = useCRMStore()
  

  const { data, isLoading } = useQuery({
    queryKey: ['customer', selectedCustomerId],
    queryFn: () => fetch(`/api/customers/${selectedCustomerId}`).then((r) => r.json()),
    enabled: !!selectedCustomerId,
  })

  const { data: quotationsData } = useQuery({
    queryKey: ['customer-quotations', selectedCustomerId],
    queryFn: () => fetch(`/api/quotations?customerId=${selectedCustomerId}&pageSize=50`).then((r) => r.json()),
    enabled: !!selectedCustomerId,
  })

  const customer = data?.data
  const quotations = quotationsData?.data || []

  const open = !!selectedCustomerId
  const flag = COUNTRY_FLAGS[customer?.country || ''] || '🌍'

  const totalRevenue = (customer?.orders || []).reduce((sum: number, o: Record<string, unknown>) => sum + (o.totalAmount as number || 0), 0)

  const handleEdit = () => {
    if (!customer) return
    openCustomerForm(customer.id)
  }

  const handleCreateInquiry = () => {
    openInquiryForm()
  }

  const handleCreateQuotation = () => {
    openQuotationForm()
  }

  const handleQuotationClick = (quotationId: string) => {
    selectQuotation(quotationId)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && selectCustomer(null)}>
      <SheetContent className="w-full sm:max-w-xl p-0">
        {isLoading || !customer ? (
          <DetailSkeleton />
        ) : (
          <>
            <SheetHeader className="p-6 pb-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-lg flex items-center gap-2">
                      {flag} {customer.companyName}
                    </SheetTitle>
                    {customer.companyNameEn && customer.companyNameEn !== customer.companyName && (
                      <p className="text-sm text-muted-foreground">{customer.companyNameEn}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <StatusBadge status={customer.customerLevel} type="customer_level" />
                    <StatusBadge status={customer.status} type="customer" />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {customer.country && (
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{customer.country}{customer.city ? ` · ${customer.city}` : ''}</span>
                  )}
                  {customer.industry && (
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{customer.industry}</span>
                  )}
                  {customer.website && (
                    <a href={customer.website.startsWith('http') ? customer.website : `https://${customer.website}`} target="_blank" rel="noopener" className="flex items-center gap-1 text-emerald-600 hover:underline">
                      <Globe className="h-3.5 w-3.5" />官网
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleEdit}>
                    <Edit className="h-3 w-3 mr-1" />编辑
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCreateInquiry}>
                    <Plus className="h-3 w-3 mr-1" />创建询盘
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCreateQuotation}>
                    <FileText className="h-3 w-3 mr-1" />创建报价
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <Separator />

            <Tabs defaultValue="overview" className="px-6">
              <TabsList className="w-full justify-start flex-wrap">
                <TabsTrigger value="overview" className="text-xs">概览</TabsTrigger>
                <TabsTrigger value="contacts" className="text-xs">联系人</TabsTrigger>
                <TabsTrigger value="inquiries" className="text-xs">询盘</TabsTrigger>
                <TabsTrigger value="quotations" className="text-xs">报价</TabsTrigger>
                <TabsTrigger value="orders" className="text-xs">订单</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">备注</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 pb-6 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <Card className="p-3"><p className="text-xs text-muted-foreground">询盘总数</p><p className="text-lg font-bold crm-number">{customer.inquiries?.length || 0}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">报价总数</p><p className="text-lg font-bold crm-number">{customer.quotations?.length || 0}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">订单总数</p><p className="text-lg font-bold crm-number">{customer.orders?.length || 0}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">联系人</p><p className="text-lg font-bold crm-number">{customer.contacts?.length || 0}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">订单总额</p><p className="text-lg font-bold crm-number text-emerald-600">{formatCurrency(totalRevenue)}</p></Card>
                </div>

                <Card className="p-4">
                  <h4 className="text-sm font-medium mb-2">公司信息</h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">客户来源</span><span>{INQUIRY_SOURCE_LABELS[customer.source as keyof typeof INQUIRY_SOURCE_LABELS] || customer.source}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">负责人</span><span>{customer.owner?.name || '未分配'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">AI评分</span><span className="font-medium text-emerald-600">{customer.aiScore}/100</span></div>
                    {customer.lastContactAt && (
                      <div className="flex justify-between"><span className="text-muted-foreground">最后联系</span><span>{format(new Date(customer.lastContactAt), 'yyyy-MM-dd', { locale: zhCN })}</span></div>
                    )}
                  </div>
                </Card>

                {(customer.activities && customer.activities.length > 0) && (
                  <Card className="p-4">
                    <h4 className="text-sm font-medium mb-2">最近动态</h4>
                    <div className="space-y-2">
                      {customer.activities.slice(0, 5).map((act: Record<string, unknown>) => (
                        <div key={act.id as string} className="flex items-start gap-2 text-xs">
                          <span className="text-muted-foreground shrink-0">{format(new Date(act.createdAt as string), 'MM-dd HH:mm')}</span>
                          <span className="font-medium">{(act.user as Record<string, unknown>)?.name || '系统'}</span>
                          <span className="text-muted-foreground">{act.subject as string || act.type as string}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {customer.notes && (
                  <Card className="p-4">
                    <h4 className="text-sm font-medium mb-2">备注</h4>
                    <p className="text-sm text-muted-foreground">{customer.notes}</p>
                  </Card>
                )}

                {customer.tags && (JSON.parse(customer.tags) as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(JSON.parse(customer.tags) as string[]).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="contacts" className="mt-4 pb-6 space-y-3 crm-tab-content">
                <ContactInlineForm customerId={selectedCustomerId!} />
                {customer.contacts?.length > 0 ? customer.contacts.map((contact: Record<string, unknown>) => (
                  <Card key={contact.id as string} className="p-4 group hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-medium text-sm shrink-0">
                          {(contact.name as string)?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-sm flex items-center gap-1.5">
                            {contact.name as string}
                            {contact.isDecisionMaker && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                          </p>
                          <p className="text-xs text-muted-foreground">{contact.position as string || ''}</p>
                        </div>
                      </div>
                      {contact.isDecisionMaker && <Badge className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">决策者</Badge>}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-emerald-600" onClick={() => startEditContact(contact)} aria-label="编辑联系人">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-rose-600" onClick={() => handleDeleteContact(contact.id!)} aria-label="删除联系人">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {contact.email && <span className="flex items-center gap-1 hover:text-emerald-600 transition-colors"><Mail className="h-3 w-3" />{contact.email as string}</span>}
                      {contact.phone && <span className="flex items-center gap-1 hover:text-emerald-600 transition-colors"><Phone className="h-3 w-3" />{contact.phone as string}</span>}
                      {contact.whatsapp && <span className="flex items-center gap-1 hover:text-emerald-600 transition-colors"><MessageCircle className="h-3 w-3" />{contact.whatsapp as string}</span>}
                    </div>
                  </Card>
                )) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <UserCircle className="h-6 w-6" />
                    </div>
                    <p className="text-sm">暂无联系人</p>
                    <p className="text-xs mt-1">使用上方表单添加第一个联系人</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="inquiries" className="mt-4 pb-6">
                {customer.inquiries?.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader><TableRow><TableHead className="text-xs">编号</TableHead><TableHead className="text-xs">主题</TableHead><TableHead className="text-xs">状态</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {customer.inquiries.slice(0, 10).map((inq: Record<string, unknown>) => (
                          <TableRow key={inq.id as string}>
                            <TableCell className="text-xs font-mono">{inq.inquiryNo as string}</TableCell>
                            <TableCell className="text-xs">{inq.subject as string}</TableCell>
                            <TableCell><StatusBadge status={inq.status as string} type="inquiry" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-sm text-muted-foreground py-8 text-center">暂无询盘</p>}
              </TabsContent>

              {/* 报价 Tab */}
              <TabsContent value="quotations" className="mt-4 pb-6">
                {quotations.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">报价编号</TableHead>
                          <TableHead className="text-xs text-right">总金额</TableHead>
                          <TableHead className="text-xs text-right">利润率</TableHead>
                          <TableHead className="text-xs">状态</TableHead>
                          <TableHead className="text-xs">有效期</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quotations.map((q: Record<string, unknown>) => {
                          const profitRate = q.profitRate as number
                          return (
                            <TableRow
                              key={q.id as string}
                              className="cursor-pointer crm-table-row"
                              onClick={() => handleQuotationClick(q.id as string)}
                            >
                              <TableCell className="text-xs font-mono font-medium">{q.quoteNo as string}</TableCell>
                              <TableCell className="text-xs text-right crm-number font-medium">{formatCurrency(q.totalAmount as number)}</TableCell>
                              <TableCell className="text-xs text-right crm-number">
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="h-1.5 w-8 rounded-full overflow-hidden bg-muted">
                                    <div
                                      className={cn(
                                        'h-full rounded-full',
                                        profitRate >= 20 ? 'bg-emerald-500' : profitRate >= 10 ? 'bg-amber-500' : 'bg-red-500'
                                      )}
                                      style={{ width: `${Math.min(Math.max(profitRate, 0), 50) * 2}%` }}
                                    />
                                  </div>
                                  <span className={cn(
                                    profitRate >= 20 ? 'text-emerald-600 font-medium' : profitRate >= 10 ? 'text-amber-600' : 'text-red-600 font-bold'
                                  )}>
                                    {profitRate.toFixed(1)}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell><StatusBadge status={q.status as string} type="quotation" /></TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {q.validUntil ? format(new Date(q.validUntil as string), 'yyyy-MM-dd', { locale: zhCN }) : '-'}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-sm text-muted-foreground py-8 text-center">暂无报价记录</p>}
              </TabsContent>

              <TabsContent value="orders" className="mt-4 pb-6">
                {customer.orders?.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader><TableRow><TableHead className="text-xs">订单号</TableHead><TableHead className="text-xs">金额</TableHead><TableHead className="text-xs">状态</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {customer.orders.slice(0, 10).map((order: Record<string, unknown>) => (
                          <TableRow key={order.id as string}>
                            <TableCell className="text-xs font-mono">{order.orderNo as string}</TableCell>
                            <TableCell className="text-xs crm-number">{formatCurrency(order.totalAmount as number)}</TableCell>
                            <TableCell><StatusBadge status={order.status as string} type="order" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <p className="text-sm text-muted-foreground py-8 text-center">暂无订单</p>}
              </TabsContent>

              <TabsContent value="notes" className="mt-4 pb-6">
                <Textarea
                  placeholder="添加备注..."
                  defaultValue={customer.notes || ''}
                  rows={6}
                  onBlur={(e) => {
                    fetch(`/api/customers/${selectedCustomerId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ notes: e.target.value }),
                    }).then(() => toast.success('备注已保存')).catch(() => toast.error('保存失败'))
                  }}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

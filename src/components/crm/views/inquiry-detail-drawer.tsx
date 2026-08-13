'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { StatusBadge } from '@/components/crm/status-badge'
import { DetailSkeleton } from '@/components/crm/loading-skeleton'
import { INQUIRY_STATUS_LABELS, INQUIRY_SOURCE_LABELS, PRIORITY_LABELS } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { CheckCircle2, Clock, FileText, Phone, Mail, MessageCircle, MapPin, Send, Loader2 } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'new', label: '新询盘' },
  { value: 'assigned', label: '已分配' },
  { value: 'following', label: '跟进中' },
  { value: 'quoted', label: '已报价' },
  { value: 'won', label: '已成交' },
  { value: 'lost', label: '已流失' },
  { value: 'pooled', label: '公海' },
  { value: 'closed', label: '已关闭' },
]

const FOLLOWUP_TYPE_OPTIONS = [
  { value: '电话', label: '电话', icon: Phone },
  { value: '邮件', label: '邮件', icon: Mail },
  { value: 'WhatsApp', label: 'WhatsApp', icon: MessageCircle },
  { value: '现场拜访', label: '现场拜访', icon: MapPin },
  { value: '其他', label: '其他', icon: FileText },
]

const followUpTypeIcons: Record<string, React.ElementType> = {
  '电话': Phone,
  '邮件': Mail,
  'WhatsApp': MessageCircle,
  '现场拜访': MapPin,
  '其他': FileText,
  'follow_up': Clock,
  'email': Mail,
  'system': CheckCircle2,
  'note': FileText,
}

const followUpTypeColors: Record<string, string> = {
  '电话': 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30',
  '邮件': 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
  'WhatsApp': 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30',
  '现场拜访': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
  '其他': 'text-muted-foreground bg-muted',
}

export function InquiryDetailDrawer() {
  const { selectedInquiryId, selectInquiry, currentUser } = useCRMStore()
  const queryClient = useQueryClient()

  const [followUpNote, setFollowUpNote] = useState('')
  const [followUpType, setFollowUpType] = useState('电话')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['inquiry', selectedInquiryId],
    queryFn: () => fetch(`/api/inquiries/${selectedInquiryId}`).then((r) => r.json()),
    enabled: !!selectedInquiryId,
  })

  const inquiry = data?.data

  // Reset form when inquiry changes
  useEffect(() => {
    setFollowUpNote('')
    setFollowUpType('电话')
  }, [selectedInquiryId])

  const handleAssign = async () => {
    if (!inquiry || !currentUser) return
    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: currentUser.id, status: 'assigned' }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success('询盘已分配')
        queryClient.invalidateQueries({ queryKey: ['inquiry', selectedInquiryId] })
        queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      } else {
        toast.error(result.error || '操作失败')
      }
    } catch { toast.error('操作失败') }
  }

  const handleStatusChange = async (status: string) => {
    if (!inquiry) return
    try {
      const res = await fetch(`/api/inquiries/${inquiry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, lastFollowUpAt: new Date().toISOString() }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success('状态已更新')
        queryClient.invalidateQueries({ queryKey: ['inquiry', selectedInquiryId] })
        queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      } else {
        toast.error(result.error || '操作失败')
      }
    } catch { toast.error('操作失败') }
  }

  const handleSubmitFollowUp = async () => {
    if (!inquiry || !currentUser || !followUpNote.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'follow_up',
          subject: `${followUpType}跟进`,
          content: followUpNote.trim(),
          entityType: 'inquiry',
          entityId: inquiry.id,
          userId: currentUser.id,
        }),
      })
      const result = await res.json()
      if (result.success) {
        toast.success('跟进记录已添加')
        setFollowUpNote('')
        setFollowUpType('电话')
        // Update inquiry follow-up time
        await fetch(`/api/inquiries/${inquiry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastFollowUpAt: new Date().toISOString() }),
        })
        queryClient.invalidateQueries({ queryKey: ['inquiry', selectedInquiryId] })
        queryClient.invalidateQueries({ queryKey: ['inquiries'] })
      } else {
        toast.error(result.error || '添加失败')
      }
    } catch {
      toast.error('添加失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={!!selectedInquiryId} onOpenChange={(v) => !v && selectInquiry(null)}>
      <SheetContent className="w-full sm:max-w-xl p-0">
        {isLoading || !inquiry ? (
          <DetailSkeleton />
        ) : (
          <>
            <SheetHeader className="p-6 pb-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <SheetTitle className="text-base font-mono">{inquiry.inquiryNo}</SheetTitle>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={inquiry.status} type="inquiry" />
                    <StatusBadge status={inquiry.priority} type="priority" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold">{inquiry.subject}</h3>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{INQUIRY_SOURCE_LABELS[inquiry.source] || inquiry.source}</Badge>
                  <span>{inquiry.language === 'de' ? '德语' : inquiry.language === 'ja' ? '日语' : inquiry.language === 'fr' ? '法语' : '英语'}</span>
                  {inquiry.assignee && <span>负责人: {inquiry.assignee.name}</span>}
                </div>
              </div>
            </SheetHeader>

            <Separator />

            <Tabs defaultValue="content" className="px-6">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="content" className="text-xs">原始内容</TabsTrigger>
                <TabsTrigger value="followups" className="text-xs">跟进记录</TabsTrigger>
                <TabsTrigger value="quotations" className="text-xs">相关报价</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="mt-4 pb-6 space-y-4">
                {inquiry.customer && (
                  <Card className="p-4">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">客户信息</h4>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{inquiry.customer.companyName}</span>
                      <StatusBadge status={inquiry.customer.customerLevel} type="customer_level" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{inquiry.customer.country}{inquiry.customer.city ? ` · ${inquiry.customer.city}` : ''}</p>
                  </Card>
                )}

                <Card className="p-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">询盘内容</h4>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{inquiry.content || '暂无内容'}</div>
                </Card>

                {inquiry.contentTranslated && (
                  <Card className="p-4">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">AI 翻译</h4>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">{inquiry.contentTranslated}</div>
                  </Card>
                )}

                {inquiry.createdAt && (
                  <p className="text-xs text-muted-foreground">
                    创建于 {format(new Date(inquiry.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="followups" className="mt-4 pb-6 space-y-4">
                {/* Follow-up Timeline */}
                {inquiry.activities && inquiry.activities.length > 0 && (
                  <div className="space-y-0">
                    {[...inquiry.activities]
                      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
                        new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime()
                      )
                      .map((act: Record<string, unknown>, idx: number) => {
                        const actType = act.type as string
                        const displayType = act.subject?.toString().startsWith('电话') ? '电话'
                          : act.subject?.toString().startsWith('邮件') ? '邮件'
                          : act.subject?.toString().startsWith('WhatsApp') ? 'WhatsApp'
                          : act.subject?.toString().startsWith('现场') ? '现场拜访'
                          : actType === 'follow_up' ? '其他'
                          : actType === 'email' ? '邮件'
                          : actType
                        const IconComp = followUpTypeIcons[displayType] || Clock
                        const colorClass = followUpTypeColors[displayType] || 'text-muted-foreground bg-muted'
                        const isLast = idx === inquiry.activities.length - 1
                        const creatorName = (act.user as Record<string, unknown>)?.name as string || '系统'

                        return (
                          <div key={act.id as string} className="flex gap-3">
                            {/* Timeline line */}
                            <div className="flex flex-col items-center">
                              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', colorClass)}>
                                <IconComp className="h-3.5 w-3.5" />
                              </div>
                              {!isLast && <div className="w-px flex-1 bg-border min-h-6" />}
                            </div>

                            {/* Content */}
                            <div className={cn('flex-1 pb-4', isLast && 'pb-0')}>
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-muted text-muted-foreground'
                                  )}>
                                    {creatorName.charAt(0)}
                                  </div>
                                  <span className="text-xs font-medium">{creatorName}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(act.createdAt as string), 'MM-dd HH:mm', { locale: zhCN })}
                                </span>
                              </div>
                              {act.content && (
                                <p className="text-sm text-muted-foreground mt-0.5 pl-7">{act.content as string}</p>
                              )}
                              {!act.content && act.subject && (
                                <p className="text-sm text-muted-foreground mt-0.5 pl-7">{act.subject as string}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}

                {!inquiry.activities || inquiry.activities.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">暂无跟进记录</p>
                )}

                {/* Add Follow-up Form */}
                <Card className="p-4 border-dashed">
                  <h4 className="text-xs font-medium text-muted-foreground mb-3">添加跟进记录</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">类型:</span>
                      <Select value={followUpType} onValueChange={setFollowUpType}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FOLLOWUP_TYPE_OPTIONS.map((opt) => {
                            const OptIcon = opt.icon
                            return (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <OptIcon className="h-3.5 w-3.5" />
                                  {opt.label}
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      placeholder="输入跟进内容..."
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      rows={3}
                      className="text-sm resize-none"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleSubmitFollowUp}
                      disabled={isSubmitting || !followUpNote.trim()}
                    >
                      {isSubmitting ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />提交中...</>
                      ) : (
                        <><Send className="h-3.5 w-3.5 mr-1" />提交跟进</>
                      )}
                    </Button>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="quotations" className="mt-4 pb-6 space-y-3">
                {inquiry.quotations?.length > 0 ? inquiry.quotations.map((q: Record<string, unknown>) => (
                  <Card key={q.id as string} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium font-mono">{q.quoteNo as string}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrency(q.totalAmount as number)} · {q.tradeTerm as string}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={q.status as string} type="quotation" />
                        {q.creator && <span className="text-xs text-muted-foreground">{q.creator.name as string}</span>}
                      </div>
                    </div>
                    {q.items && (q.items as Record<string, unknown>[]).length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        {(q.items as Record<string, unknown>[]).map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-0.5">
                            <span className="text-muted-foreground">{item.productName as string}</span>
                            <span className="crm-number">{item.quantity as number} × {formatCurrency(item.unitPrice as number)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )) : <p className="text-sm text-muted-foreground py-8 text-center">暂无相关报价</p>}
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap items-center gap-2 px-6 pb-6">
              <div className="flex items-center gap-2 mr-auto">
                <span className="text-xs text-muted-foreground">状态:</span>
                <Select
                  value={inquiry.status}
                  onValueChange={(v) => handleStatusChange(v)}
                >
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!inquiry.assignedTo && (
                <Button size="sm" onClick={handleAssign}>分配给我</Button>
              )}
              {inquiry.status === 'new' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('following')}>开始跟进</Button>
              )}
              {inquiry.status === 'following' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('quoted')}>标记已报价</Button>
              )}
              {inquiry.status !== 'won' && inquiry.status !== 'lost' && inquiry.status !== 'closed' && (
                <Button size="sm" variant="destructive" onClick={() => handleStatusChange('lost')}>标记流失</Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

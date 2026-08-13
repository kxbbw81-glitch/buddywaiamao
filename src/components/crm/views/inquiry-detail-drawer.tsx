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
import { toast } from 'sonner'
import { CheckCircle2, Clock, FileText } from 'lucide-react'

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

export function InquiryDetailDrawer() {
  const { selectedInquiryId, selectInquiry, currentUser } = useCRMStore()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['inquiry', selectedInquiryId],
    queryFn: () => fetch(`/api/inquiries/${selectedInquiryId}`).then((r) => r.json()),
    enabled: !!selectedInquiryId,
  })

  const inquiry = data?.data

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

              <TabsContent value="followups" className="mt-4 pb-6 space-y-3">
                {inquiry.activities?.length > 0 ? inquiry.activities.map((act: Record<string, unknown>) => (
                  <Card key={act.id as string} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {act.type === 'follow_up' && <Clock className="h-3.5 w-3.5 text-amber-500" />}
                        {act.type === 'email' && <FileText className="h-3.5 w-3.5 text-emerald-500" />}
                        {act.type === 'system' && <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="text-sm font-medium">{act.subject as string || act.type as string}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(act.createdAt as string), 'MM-dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                    {act.content && <p className="text-xs text-muted-foreground mt-1">{act.content as string}</p>}
                    {act.user && <p className="text-xs text-muted-foreground mt-1">操作人: {(act.user as Record<string, unknown>).name as string}</p>}
                  </Card>
                )) : <p className="text-sm text-muted-foreground py-8 text-center">暂无跟进记录</p>}
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

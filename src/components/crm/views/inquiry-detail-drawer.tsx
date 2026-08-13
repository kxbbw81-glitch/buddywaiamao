'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useCRMStore } from '@/store/use-crm-store'
import { StatusBadge } from '@/components/crm/status-badge'
import { DetailSkeleton } from '@/components/crm/loading-skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)
}

const SOURCE_LABELS: Record<string, string> = {
  email: '邮件', website: '官网', whatsapp: 'WhatsApp', exhibition: '展会',
  b2b_alibaba: 'B2B平台', linkedin: 'LinkedIn', social_media: '社交媒体',
}

export function InquiryDetailDrawer() {
  const { selectedInquiryId, selectInquiry, currentUser } = useCRMStore()
  

  

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
      if (res.ok) {
        toast.success('询盘已分配')
        selectInquiry(null)
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
      if (res.ok) toast.success('状态已更新')
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
                  <Badge variant="outline" className="text-xs">{SOURCE_LABELS[inquiry.source] || inquiry.source}</Badge>
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
                    <p className="text-xs text-muted-foreground mt-1">{inquiry.customer.country} {inquiry.customer.city}</p>
                  </Card>
                )}

                <Card className="p-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">询盘内容</h4>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{inquiry.content}</div>
                </Card>

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
                      <span className="text-sm font-medium">{act.subject as string}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(act.createdAt as string), 'MM-dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{act.content as string}</p>
                    {act.user && <p className="text-xs text-muted-foreground mt-1">操作人: {(act.user as Record<string, unknown>).name as string}</p>}
                  </Card>
                )) : <p className="text-sm text-muted-foreground py-8 text-center">暂无跟进记录</p>}
              </TabsContent>

              <TabsContent value="quotations" className="mt-4 pb-6 space-y-3">
                {inquiry.quotations?.length > 0 ? inquiry.quotations.map((q: Record<string, unknown>) => (
                  <Card key={q.id as string} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium font-mono">{q.quoteNo as string}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(q.totalAmount as number)}</p>
                    </div>
                    <StatusBadge status={q.status as string} type="quotation" />
                  </Card>
                )) : <p className="text-sm text-muted-foreground py-8 text-center">暂无相关报价</p>}
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 px-6 pb-6">
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

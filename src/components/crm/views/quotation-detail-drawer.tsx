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
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)
}

export function QuotationDetailDrawer() {
  const { selectedQuotationId, selectQuotation } = useCRMStore()
  

  

  const { data, isLoading } = useQuery({
    queryKey: ['quotation', selectedQuotationId],
    queryFn: () => fetch(`/api/quotations/${selectedQuotationId}`).then((r) => r.json()),
    enabled: !!selectedQuotationId,
  })

  const quotation = data?.data

  const handleStatusUpdate = async (status: string) => {
    if (!quotation) return
    try {
      const res = await fetch(`/api/quotations/${quotation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) toast.success('状态已更新')
    } catch { toast.error('操作失败') }
  }

  return (
    <Sheet open={!!selectedQuotationId} onOpenChange={(v) => !v && selectQuotation(null)}>
      <SheetContent className="w-full sm:max-w-2xl p-0">
        {isLoading || !quotation ? (
          <DetailSkeleton />
        ) : (
          <>
            <SheetHeader className="p-6 pb-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <SheetTitle className="text-base font-mono">{quotation.quoteNo} v{quotation.version}</SheetTitle>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={quotation.status} type="quotation" />
                    <Badge variant="outline" className="text-xs">{quotation.tradeTerm}</Badge>
                  </div>
                </div>
                {quotation.customer && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{quotation.customer.companyName}</span>
                    <span>·</span>
                    <span>{quotation.customer.country}</span>
                  </div>
                )}
              </div>
            </SheetHeader>

            <Separator />

            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] crm-scrollbar">
              {/* Items Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">产品</TableHead>
                        <TableHead className="text-xs">规格</TableHead>
                        <TableHead className="text-xs text-right">数量</TableHead>
                        <TableHead className="text-xs">单位</TableHead>
                        <TableHead className="text-xs text-right">单价</TableHead>
                        <TableHead className="text-xs text-right">成本</TableHead>
                        <TableHead className="text-xs text-right">总价</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotation.items?.map((item: Record<string, unknown>) => (
                        <TableRow key={item.id as string}>
                          <TableCell className="text-xs font-medium">{item.productName as string}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.productSpec as string || '-'}</TableCell>
                          <TableCell className="text-xs text-right crm-number">{item.quantity as number}</TableCell>
                          <TableCell className="text-xs">{item.unit as string}</TableCell>
                          <TableCell className="text-xs text-right crm-number">{formatCurrency(item.unitPrice as number)}</TableCell>
                          <TableCell className="text-xs text-right crm-number text-muted-foreground">{formatCurrency(item.cost as number)}</TableCell>
                          <TableCell className="text-xs text-right crm-number font-medium">{formatCurrency(item.totalPrice as number)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Totals */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">总金额</p>
                  <p className="text-base font-bold crm-number">{formatCurrency(quotation.totalAmount)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">总成本</p>
                  <p className="text-base font-bold crm-number text-muted-foreground">{formatCurrency(quotation.totalCost)}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">利润率</p>
                  <p className={`text-base font-bold crm-number ${quotation.profitRate >= 20 ? 'text-emerald-600' : quotation.profitRate >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {quotation.profitRate.toFixed(1)}%
                  </p>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">汇率</p>
                  <p className="text-base font-bold crm-number">{quotation.exchangeRate}</p>
                </Card>
              </div>

              {/* Margin Check */}
              {quotation.marginCheckReason && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">⚠️ 利润预警</p>
                  <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">{quotation.marginCheckReason}</p>
                </div>
              )}

              {quotation.validUntil && (
                <p className="text-xs text-muted-foreground">
                  有效期至: {format(new Date(quotation.validUntil), 'yyyy-MM-dd', { locale: zhCN })}
                </p>
              )}

              <div className="flex gap-2">
                {quotation.status === 'draft' && (
                  <Button size="sm" onClick={() => handleStatusUpdate('sent')}>发送报价</Button>
                )}
                {quotation.status === 'sent' && (
                  <>
                    <Button size="sm" onClick={() => handleStatusUpdate('accepted')}>标记接受</Button>
                    <Button size="sm" variant="outline" onClick={() => handleStatusUpdate('rejected')}>标记拒绝</Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  prospect: '初步接触',
  qualified: '需求确认',
  proposal: '方案报价',
  negotiation: '商务谈判',
  won: '赢单',
  lost: '输单',
}

const LOST_REASONS: Record<string, string> = {
  price: '价格因素',
  competitor: '竞争对手',
  no_budget: '客户预算不足',
  no_response: '客户失联',
  product: '产品不匹配',
  other: '其他',
}

interface OpportunityFormValues {
  title: string
  customerId: string
  stage: string
  amount: string
  currency: string
  probability: string
  expectedCloseDate: string
  notes: string
  lostReason: string
}

const DEFAULT_FORM: OpportunityFormValues = {
  title: '',
  customerId: '',
  stage: 'prospect',
  amount: '',
  currency: 'USD',
  probability: '20',
  expectedCloseDate: '',
  notes: '',
  lostReason: '',
}

interface Props {
  open: boolean
  editId: string | null
  onClose: () => void
}

export function OpportunityFormDialog({ open, editId, onClose }: Props) {
  const { currentUser } = useCRMStore()
  const queryClient = useQueryClient()
  const isEdit = !!editId
  const isManager = ['super_admin', 'management', 'sales_manager'].includes(currentUser?.primaryRole || '')

  const [form, setForm] = useState<OpportunityFormValues>(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)

  // 客户下拉数据
  const { data: customerData } = useQuery({
    queryKey: ['customers-for-opportunity'],
    queryFn: () => fetch('/api/customers?pageSize=200').then((r) => r.json()),
    enabled: open,
  })
  const customers: { id: string; companyName: string; country?: string | null }[] = customerData?.data || []

  useEffect(() => {
    if (!open) {
      setForm(DEFAULT_FORM)
      return
    }
    if (editId) {
      fetch(`/api/opportunities/${editId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            const o = data.data
            setForm({
              title: o.title || '',
              customerId: o.customerId || '',
              stage: o.stage || 'prospect',
              amount: o.amount ? String(o.amount) : '',
              currency: o.currency || 'USD',
              probability: String(o.probability ?? 20),
              expectedCloseDate: o.expectedCloseDate ? o.expectedCloseDate.slice(0, 10) : '',
              notes: o.notes || '',
              lostReason: o.lostReason || '',
            })
          }
        })
        .catch(() => toast.error('加载商机数据失败'))
    }
  }, [open, editId])

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('请输入商机名称')
      return
    }
    setLoading(true)
    try {
      const url = editId ? `/api/opportunities/${editId}` : '/api/opportunities'
      const method = editId ? 'PUT' : 'POST'
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        customerId: form.customerId || null,
        stage: form.stage,
        amount: form.amount ? Number(form.amount) : 0,
        currency: form.currency,
        probability: form.probability ? Number(form.probability) : undefined,
        notes: form.notes || null,
      }
      if (form.expectedCloseDate) payload.expectedCloseDate = form.expectedCloseDate
      if (form.stage === 'lost' && form.lostReason) payload.lostReason = form.lostReason

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(isEdit ? '商机已更新' : '商机已创建')
        onClose()
        queryClient.invalidateQueries({ queryKey: ['opportunities'] })
      } else {
        toast.error(data.error || '操作失败')
      }
    } catch {
      toast.error('操作失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!editId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/opportunities/${editId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('商机已删除')
        onClose()
        queryClient.invalidateQueries({ queryKey: ['opportunities'] })
      } else {
        toast.error(data.error || '删除失败')
      }
    } catch {
      toast.error('删除失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto crm-scrollbar">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑商机' : '新建商机'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">商机名称 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例如：德国 AutoParts 年度框架合作"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">关联客户</Label>
              <Select value={form.customerId || 'none'} onValueChange={(v) => setForm({ ...form, customerId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="选择客户" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不关联</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName}{c.country ? ` · ${c.country}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">商机阶段</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OPPORTUNITY_STAGE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">金额</Label>
              <Input
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">币种</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="CNY">CNY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">赢单概率 (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={form.probability}
                onChange={(e) => setForm({ ...form, probability: e.target.value })}
                placeholder="30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">预计成交日期</Label>
              <Input
                type="date"
                value={form.expectedCloseDate}
                onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
              />
            </div>
            {form.stage === 'lost' && (
              <div className="space-y-1.5">
                <Label className="text-xs">输单原因</Label>
                <Select value={form.lostReason || 'other'} onValueChange={(v) => setForm({ ...form, lostReason: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOST_REASONS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">备注</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="商机背景、关键决策人、竞争情况..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isEdit && isManager && (
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />删除
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? '提交中...' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

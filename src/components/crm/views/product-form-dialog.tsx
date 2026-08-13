'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCRMStore } from '@/store/use-crm-store'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'

const DEFAULT_FORM = {
  productCode: '',
  name: '',
  nameEn: '',
  category: '',
  specification: '',
  unit: 'PCS',
  costPrice: 0,
  standardPrice: 0,
  minPrice: 0,
  description: '',
  keywords: '',
  imageUrl: '',
}

export function ProductFormDialog() {
  const { productFormOpen, closeProductForm } = useCRMStore()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)

  useEffect(() => {
    if (!productFormOpen) {
      setForm(DEFAULT_FORM)
    }
  }, [productFormOpen])

  const handleSubmit = async () => {
    if (!form.productCode.trim() || !form.name.trim()) {
      toast.error('请填写产品编号和名称')
      return
    }
    setLoading(true)
    try {
      const keywordsJson = form.keywords ? JSON.stringify(form.keywords.split(/[,，]/).map((k) => k.trim()).filter(Boolean)) : '[]'
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, keywords: keywordsJson }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('产品已创建')
        closeProductForm()
        queryClient.invalidateQueries({ queryKey: ['products'] })
      } else {
        toast.error(data.error || '创建失败')
      }
    } catch {
      toast.error('创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={productFormOpen} onOpenChange={(v) => !v && closeProductForm()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto crm-scrollbar">
        <DialogHeader>
          <DialogTitle>新建产品</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs">产品编号 *</Label><Input value={form.productCode} onChange={(e) => setForm({ ...form, productCode: e.target.value })} placeholder="NF-XX-001" /></div>
            <div className="space-y-1.5"><Label className="text-xs">分类</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="消费电子" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-xs">产品名称 *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="中文名称" /></div>
            <div className="space-y-1.5"><Label className="text-xs">英文名称</Label><Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} placeholder="English name" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">规格</Label><Input value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} placeholder="规格参数" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label className="text-xs">单位</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="PCS" /></div>
            <div className="space-y-1.5"><Label className="text-xs">成本价</Label><Input type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">标准价</Label><Input type="number" value={form.standardPrice} onChange={(e) => setForm({ ...form, standardPrice: parseFloat(e.target.value) || 0 })} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">最低价</Label><Input type="number" value={form.minPrice} onChange={(e) => setForm({ ...form, minPrice: parseFloat(e.target.value) || 0 })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">描述</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="产品描述..." rows={2} /></div>
          <div className="space-y-1.5"><Label className="text-xs">关键词 (逗号分隔)</Label><Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="蓝牙, 降噪" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeProductForm}>取消</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? '提交中...' : '创建产品'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

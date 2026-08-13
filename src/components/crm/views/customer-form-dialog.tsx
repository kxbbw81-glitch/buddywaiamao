'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import type { CustomerLevel } from '@/lib/types'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'

interface ContactRow {
  name: string
  email: string
  phone: string
  whatsapp: string
  position: string
  isDecisionMaker: boolean
}

const DEFAULT_FORM = {
  companyName: '',
  companyNameEn: '',
  country: '',
  city: '',
  website: '',
  industry: '',
  customerLevel: 'C' as CustomerLevel,
  source: 'manual',
  tags: '',
  notes: '',
}

export function CustomerFormDialog() {
  const { customerFormOpen, closeCustomerForm, customerEditId, currentUser } = useCRMStore()
  const queryClient = useQueryClient()
  const isEdit = !!customerEditId

  const [form, setForm] = useState(DEFAULT_FORM)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!customerFormOpen) {
      setForm(DEFAULT_FORM)
      setContacts([])
      return
    }
    if (customerEditId) {
      fetch(`/api/customers/${customerEditId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            const c = data.data
            setForm({
              companyName: c.companyName || '',
              companyNameEn: c.companyNameEn || '',
              country: c.country || '',
              city: c.city || '',
              website: c.website || '',
              industry: c.industry || '',
              customerLevel: c.customerLevel || 'C',
              source: c.source || 'manual',
              tags: Array.isArray(JSON.parse(c.tags || '[]')) ? (JSON.parse(c.tags || '[]') as string[]).join(', ') : c.tags || '',
              notes: c.notes || '',
            })
            if (c.contacts?.length > 0) {
              setContacts(c.contacts.map((ct: Record<string, unknown>) => ({
                name: ct.name as string || '',
                email: ct.email as string || '',
                phone: ct.phone as string || '',
                whatsapp: ct.whatsapp as string || '',
                position: ct.position as string || '',
                isDecisionMaker: ct.isDecisionMaker as boolean || false,
              })))
            }
          }
        })
        .catch(() => toast.error('加载客户数据失败'))
    }
  }, [customerFormOpen, customerEditId])

  const handleSubmit = async () => {
    if (!form.companyName.trim()) {
      toast.error('请输入公司名称')
      return
    }
    setLoading(true)
    try {
      const url = customerEditId ? `/api/customers/${customerEditId}` : '/api/customers'
      const method = customerEditId ? 'PUT' : 'POST'
      const tagsJson = form.tags ? JSON.stringify(form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean)) : '[]'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tags: tagsJson, contacts, ownerId: currentUser?.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(isEdit ? '客户已更新' : '客户已创建')
        closeCustomerForm()
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        if (customerEditId) {
          queryClient.invalidateQueries({ queryKey: ['customer', customerEditId] })
        }
      } else {
        toast.error(data.error || '操作失败')
      }
    } catch {
      toast.error('操作失败')
    } finally {
      setLoading(false)
    }
  }

  const addContact = () => {
    setContacts([...contacts, { name: '', email: '', phone: '', whatsapp: '', position: '', isDecisionMaker: false }])
  }

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index))
  }

  const updateContact = (index: number, field: keyof ContactRow, value: string | boolean) => {
    const updated = [...contacts]
    updated[index] = { ...updated[index], [field]: value }
    setContacts(updated)
  }

  return (
    <Dialog open={customerFormOpen} onOpenChange={(v) => !v && closeCustomerForm()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto crm-scrollbar">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑客户' : '新建客户'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">公司名称 *</Label>
              <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="中文公司名" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">公司名称(EN)</Label>
              <Input value={form.companyNameEn} onChange={(e) => setForm({ ...form, companyNameEn: e.target.value })} placeholder="English company name" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">国家</Label>
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="国家" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">城市</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="城市" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">行业</Label>
              <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="行业" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">客户级别</Label>
              <Select value={form.customerLevel} onValueChange={(v) => setForm({ ...form, customerLevel: v as CustomerLevel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A级客户</SelectItem>
                  <SelectItem value="B">B级客户</SelectItem>
                  <SelectItem value="C">C级客户</SelectItem>
                  <SelectItem value="D">D级客户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">来源</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="exhibition">展会</SelectItem>
                  <SelectItem value="b2b_alibaba">B2B平台</SelectItem>
                  <SelectItem value="email">邮件</SelectItem>
                  <SelectItem value="social_media">社交媒体</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="referral">客户介绍</SelectItem>
                  <SelectItem value="website">官网</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="manual">手动录入</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">网站</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="www.example.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">标签 (逗号分隔)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="VIP, 重点客户" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">备注</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="客户备注..." rows={2} />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">联系人</Label>
              <Button size="sm" variant="outline" onClick={addContact}><Plus className="h-3 w-3 mr-1" />添加</Button>
            </div>
            {contacts.map((c, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-end border rounded-lg p-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">姓名</Label>
                  <Input value={c.name} onChange={(e) => updateContact(i, 'name', e.target.value)} placeholder="姓名" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">职位</Label>
                  <Input value={c.position} onChange={(e) => updateContact(i, 'position', e.target.value)} placeholder="职位" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">邮箱</Label>
                  <Input value={c.email} onChange={(e) => updateContact(i, 'email', e.target.value)} placeholder="邮箱" className="h-8 text-xs" />
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeContact(i)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeCustomerForm}>取消</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? '提交中...' : '保存'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

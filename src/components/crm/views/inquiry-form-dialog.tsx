'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useCRMStore } from '@/store/use-crm-store'
import type { Priority } from '@/lib/types'
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

export function InquiryFormDialog() {
  const { inquiryFormOpen, closeInquiryForm } = useCRMStore()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    subject: '',
    content: '',
    source: 'email',
    priority: 'normal' as Priority,
    language: 'en',
  })

  const handleSubmit = async () => {
    if (!form.subject.trim()) {
      toast.error('请输入询盘主题')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('询盘已创建')
        closeInquiryForm()
        setForm({ subject: '', content: '', source: 'email', priority: 'normal', language: 'en' })
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
    <Dialog open={inquiryFormOpen} onOpenChange={(v) => !v && closeInquiryForm()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新建询盘</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">来源</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">邮件</SelectItem>
                  <SelectItem value="website">官网</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="exhibition">展会</SelectItem>
                  <SelectItem value="b2b_alibaba">B2B平台</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="social_media">社交媒体</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">优先级</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="normal">普通</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="urgent">紧急</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">主题 *</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="询盘主题" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">内容</Label>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="询盘内容..." rows={5} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeInquiryForm}>取消</Button>
            <Button onClick={handleSubmit} disabled={loading}>{loading ? '提交中...' : '创建'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

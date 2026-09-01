'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Mail, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { Customer, OutboundDraft } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const textareaClass = 'min-h-[92px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const tone = (status: string): 'blue' | 'amber' | 'gray' | 'purple' => status === 'SENT_RECORDED' ? 'purple' : status === 'APPROVED' ? 'blue' : status === 'IN_REVIEW' ? 'amber' : 'gray'
function errorText(error: unknown) { return error instanceof ApiError ? `${error.status} ${error.code}：${error.message}` : '操作失败，请检查后端服务。' }

export function P3OutboundDraftView() {
  const [drafts, setDrafts] = useState<OutboundDraft[]>([]); const [customers, setCustomers] = useState<Customer[]>([]); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ customerId: '', channel: 'EMAIL', recipient: '', subject: '', body: '', campaignCode: '' })
  const refresh = useCallback(async () => { setLoading(true); setNotice(''); try { const [draftResult, customerResult] = await Promise.all([api.outboundDrafts(), api.customers('pageSize=100')]); setDrafts(draftResult.items); setCustomers(customerResult.items); setForm((old) => old.customerId ? old : { ...old, customerId: customerResult.items[0]?.id || '' }) } catch (error) { setNotice(errorText(error)) } finally { setLoading(false) } }, [])
  useEffect(() => { void refresh() }, [refresh])
  async function createInner() { if (!form.customerId || !form.recipient || !form.subject || !form.body) return setNotice('请完整填写客户、收件方、主题和草稿正文。'); try { await api.createOutboundDraft({ ...form, campaignCode: form.campaignCode || undefined }); setForm((old) => ({ ...old, recipient: '', subject: '', body: '' })); setNotice('渠道草稿已保存，不会发送外部消息。'); await refresh() } catch (error) { setNotice(errorText(error)) } }
  async function actionInner(item: OutboundDraft, type: 'submit' | 'approve' | 'send') { try { if (type === 'submit') await api.submitOutboundDraft(item.id); if (type === 'approve') await api.approveOutboundDraft(item.id, '人工审核通过'); if (type === 'send') await api.recordOutboundDraftManualSend(item.id); setNotice(type === 'send' ? '已登记人工发送结果，系统未调用邮件或渠道服务。' : '状态已更新。'); await refresh() } catch (error) { setNotice(errorText(error)) } }
  // 修复说明：[中危-重复提交]，原因：保存草稿与状态流转无 loading 锁，连点会重复提交；统一 busy 锁。
  const [busy, setBusy] = useState(false)
  async function create() {
    if (busy || loading) return
    setBusy(true)
    try { await createInner() } finally { setBusy(false) }
  }
  async function action(item: OutboundDraft, type: 'submit' | 'approve' | 'send') {
    if (busy || loading) return
    setBusy(true)
    try { await actionInner(item, type) } finally { setBusy(false) }
  }

  return <div className="space-y-5" data-testid="p3-outbound-draft-view"><div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950"><div className="flex gap-2"><ShieldCheck className="mt-1 h-4 w-4 text-sky-700" /><div><b>P3 邮件与渠道草稿</b><div className="text-xs">复用沟通时间线保存草稿和结果留痕。真实发送始终由人工在授权渠道完成。</div></div><Button className="ml-auto" size="sm" variant="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button></div></div>{notice ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</div> : null}<div className="grid gap-5 xl:grid-cols-[1.05fr,1.35fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-sky-600" />新建草稿</CardTitle></CardHeader><CardContent className="space-y-3"><select className={inputClass} value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}><option value="">选择客户</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select><select className={inputClass} value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })}><option>EMAIL</option><option>WHATSAPP</option><option>B2B_MESSAGE</option></select><input className={inputClass} value={form.recipient} placeholder="收件方 / 人工渠道对象" onChange={(event) => setForm({ ...form, recipient: event.target.value })} /><input className={inputClass} value={form.subject} placeholder="主题" onChange={(event) => setForm({ ...form, subject: event.target.value })} /><textarea className={textareaClass} value={form.body} placeholder="草稿正文…" onChange={(event) => setForm({ ...form, body: event.target.value })} /><Button onClick={() => void create()}><Send className="h-4 w-4" />保存待审核草稿</Button></CardContent></Card><Card><CardHeader><CardTitle>审核与结果回填</CardTitle></CardHeader><CardContent className="space-y-3">{drafts.length ? drafts.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center gap-2"><b className="text-sm">{item.subject}</b><Badge tone={tone(item.status)}>{item.status}</Badge><span className="ml-auto text-xs text-muted">{item.channel}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.body}</p><div className="mt-2 flex gap-2">{item.status === 'DRAFT' ? <Button size="sm" variant="secondary" onClick={() => void action(item, 'submit')}>提交审核</Button> : null}{item.status === 'IN_REVIEW' ? <Button size="sm" onClick={() => void action(item, 'approve')}><CheckCircle2 className="h-3.5 w-3.5" />人工通过</Button> : null}{item.status === 'APPROVED' ? <Button size="sm" variant="secondary" onClick={() => void action(item, 'send')}>登记人工发送</Button> : null}</div></div>) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-muted">暂无渠道草稿。</div>}</CardContent></Card></div></div>
}

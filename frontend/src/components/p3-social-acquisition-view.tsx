'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, MessageSquareText, RefreshCw, Send, ShieldCheck, UserPlus } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { SocialInteraction, SocialPost } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const inputClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'
const textareaClass = 'min-h-[92px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-blue-100'

function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.status} ${error.code}：${error.message}`
  return '操作失败，请检查权限或后端服务。'
}

function tone(status: string): 'blue' | 'amber' | 'gray' | 'purple' {
  if (status === 'PUBLISHED' || status === 'CONVERTED') return 'purple'
  if (status === 'APPROVED' || status === 'LEAD_SUGGESTED') return 'blue'
  if (status === 'IN_REVIEW') return 'amber'
  return 'gray'
}

export function P3SocialAcquisitionView() {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [interactions, setInteractions] = useState<SocialInteraction[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ platform: 'LINKEDIN', title: '', body: '', campaignCode: '' })
  const [interaction, setInteraction] = useState({ platform: 'LINKEDIN', content: '', intent: 'INQUIRY', authorAlias: '' })

  const refresh = useCallback(async () => {
    setLoading(true); setNotice('')
    try {
      const [postResult, interactionResult] = await Promise.all([api.socialPosts(), api.socialInteractions()])
      setPosts(postResult.items); setInteractions(interactionResult.items)
    } catch (error) { setNotice(errorText(error)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function createPostInner() {
    if (!form.body.trim()) return setNotice('请先填写内容草稿。')
    try { await api.createSocialPost({ ...form, campaignCode: form.campaignCode || undefined }); setForm((old) => ({ ...old, title: '', body: '' })); setNotice('草稿已保存，尚未向任何平台发送。'); await refresh() } catch (error) { setNotice(errorText(error)) }
  }
  async function postActionInner(post: SocialPost, action: 'submit' | 'approve' | 'published') {
    try {
      if (action === 'submit') await api.submitSocialPost(post.id)
      if (action === 'approve') await api.approveSocialPost(post.id, '已人工审核')
      if (action === 'published') await api.recordSocialPostPublished(post.id)
      setNotice(action === 'published' ? '已登记人工发布结果；系统未调用外部平台。' : '状态已更新。'); await refresh()
    } catch (error) { setNotice(errorText(error)) }
  }
  async function createInteractionInner() {
    if (!interaction.content.trim()) return setNotice('请填写互动内容。')
    try { await api.createSocialInteraction(interaction); setInteraction((old) => ({ ...old, content: '', authorAlias: '' })); setNotice('互动已登记，可人工转为 CRM 线索。'); await refresh() } catch (error) { setNotice(errorText(error)) }
  }
  async function convertInteractionInner(item: SocialInteraction) {
    const companyName = window.prompt('输入线索公司名称：')
    if (!companyName?.trim()) return
    try { await api.convertSocialInteractionToLead(item.id, { companyName, contactName: item.authorAlias || undefined }); setNotice('已复用 CRM 线索能力完成转化。'); await refresh() } catch (error) { setNotice(errorText(error)) }
  }

  // 修复说明：[中危-重复提交]，原因：写操作无 loading 锁，连点会重复建草稿/重复状态流转；统一 busy 锁。
  const [busy, setBusy] = useState(false)
  async function createPost() {
    if (busy || loading) return
    setBusy(true)
    try { await createPostInner() } finally { setBusy(false) }
  }
  async function postAction(post: SocialPost, action: 'submit' | 'approve' | 'published') {
    if (busy || loading) return
    setBusy(true)
    try { await postActionInner(post, action) } finally { setBusy(false) }
  }
  async function createInteraction() {
    if (busy || loading) return
    setBusy(true)
    try { await createInteractionInner() } finally { setBusy(false) }
  }
  async function convertInteraction(item: SocialInteraction) {
    if (busy || loading) return
    setBusy(true)
    try { await convertInteractionInner(item) } finally { setBusy(false) }
  }

  return <div className="space-y-5" data-testid="p3-social-acquisition-view">
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950"><div className="flex gap-2"><ShieldCheck className="mt-1 h-4 w-4 text-violet-700" /><div><b>P3 社媒获客助手</b><div className="text-xs">仅管理草稿、人工审核、互动意图和 CRM 转化建议。不会抓取未授权数据、自动发帖、群发私信或回复评论。</div></div><Button className="ml-auto" size="sm" variant="secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />刷新</Button></div></div>
    {notice ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</div> : null}
    <div className="grid gap-5 xl:grid-cols-[1.05fr,1.35fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-violet-600" />内容草稿</CardTitle></CardHeader><CardContent className="space-y-3"><select className={inputClass} value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })}><option>LINKEDIN</option><option>X</option><option>FACEBOOK</option><option>INSTAGRAM</option><option>YOUTUBE</option><option>WEBSITE</option></select><input className={inputClass} value={form.title} placeholder="内容标题（可选）" onChange={(event) => setForm({ ...form, title: event.target.value })} /><textarea className={textareaClass} value={form.body} placeholder="填写内容草稿…" onChange={(event) => setForm({ ...form, body: event.target.value })} /><input className={inputClass} value={form.campaignCode} placeholder="活动编码 / UTM 归因（可选）" onChange={(event) => setForm({ ...form, campaignCode: event.target.value })} /><Button onClick={() => void createPost()}><Send className="h-4 w-4" />保存草稿</Button></CardContent></Card>
      <Card><CardHeader><CardTitle>内容审核队列</CardTitle></CardHeader><CardContent className="space-y-3">{posts.length ? posts.map((post) => <div key={post.id} className="rounded-lg border border-slate-200 p-3"><div className="mb-1 flex items-center gap-2"><b className="text-sm">{post.title || '未命名草稿'}</b><Badge tone={tone(post.status)}>{post.status}</Badge><span className="ml-auto text-xs text-muted">{post.platform}</span></div><p className="line-clamp-2 text-xs leading-5 text-slate-600">{post.body}</p><div className="mt-2 flex flex-wrap gap-2">{post.status === 'DRAFT' ? <Button size="sm" variant="secondary" onClick={() => void postAction(post, 'submit')}>提交审核</Button> : null}{post.status === 'IN_REVIEW' ? <Button size="sm" onClick={() => void postAction(post, 'approve')}><CheckCircle2 className="h-3.5 w-3.5" />人工通过</Button> : null}{post.status === 'APPROVED' ? <Button size="sm" variant="secondary" onClick={() => void postAction(post, 'published')}>登记人工发布</Button> : null}</div></div>) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-muted">暂无内容草稿。</div>}</CardContent></Card>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.05fr,1.35fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-blue-600" />互动录入与意图</CardTitle></CardHeader><CardContent className="space-y-3"><input className={inputClass} value={interaction.authorAlias} placeholder="互动方称呼（可选）" onChange={(event) => setInteraction({ ...interaction, authorAlias: event.target.value })} /><select className={inputClass} value={interaction.intent} onChange={(event) => setInteraction({ ...interaction, intent: event.target.value })}><option>INQUIRY</option><option>PRODUCT_QUESTION</option><option>PARTNERSHIP</option><option>COMPLAINT</option><option>AFTER_SALES</option><option>CASUAL</option><option>SPAM</option></select><textarea className={textareaClass} value={interaction.content} placeholder="人工录入评论或私信内容…" onChange={(event) => setInteraction({ ...interaction, content: event.target.value })} /><Button onClick={() => void createInteraction()}><MessageSquareText className="h-4 w-4" />登记互动</Button></CardContent></Card><Card><CardHeader><CardTitle>互动转化建议</CardTitle></CardHeader><CardContent className="space-y-3">{interactions.length ? interactions.map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="mb-1 flex items-center gap-2"><b className="text-sm">{item.intent}</b><Badge tone={tone(item.status)}>{item.status}</Badge></div><p className="line-clamp-2 text-xs leading-5 text-slate-600">{item.content}</p>{item.status === 'LEAD_SUGGESTED' ? <Button className="mt-2" size="sm" variant="secondary" onClick={() => void convertInteraction(item)}><UserPlus className="h-3.5 w-3.5" />人工转 CRM 线索</Button> : null}</div>) : <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-muted">暂无互动记录。</div>}</CardContent></Card></div>
  </div>
}

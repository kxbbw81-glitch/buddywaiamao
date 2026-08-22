'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bot, MessageSquarePlus, Send, Trash2, User, Zap, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ConversationItem {
  id: string
  title: string
  updatedAt: string
  messageCount: number
  lastPreview: string
}

const SUGGESTIONS = ['唤醒沉默客户', '起草跟进邮件', '生成本周商机复盘', '分析丢单原因']

/** Agent 对话面板：左侧会话列表 + 右侧消息流 */
export function AgentChatPanel() {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/conversations')
      const json = await res.json()
      if (json.success) setConversations(json.data)
    } catch { /* 网络错误静默 */ }
  }, [])

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-config')
      const json = await res.json()
      if (json.success) setAiConfigured(json.data.configured)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadConversations()
    loadConfig()
  }, [loadConversations, loadConfig])

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id)
    setMessages([])
    try {
      const res = await fetch(`/api/agent/conversations/${id}`)
      const json = await res.json()
      if (json.success) {
        setMessages(
          json.data.messages.map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
        )
      }
    } catch {
      toast.error('加载对话失败')
    }
  }, [])

  const newConversation = useCallback(() => {
    setActiveId(null)
    setMessages([])
    setDraft('')
  }, [])

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/agent/conversations/${id}`, { method: 'DELETE' })
        const json = await res.json()
        if (json.success) {
          if (activeId === id) newConversation()
          loadConversations()
          toast.success('对话已删除')
        }
      } catch {
        toast.error('删除失败')
      }
    },
    [activeId, loadConversations, newConversation]
  )

  const send = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content || sending) return
      setDraft('')
      setSending(true)
      // 乐观插入用户消息 + 加载占位
      setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: 'user', content }])
      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: activeId || undefined, message: content }),
        })
        const json = await res.json()
        if (!json.success) {
          toast.error(json.error || '发送失败')
          setMessages((prev) => prev.slice(0, -1)) // 回滚乐观消息
          return
        }
        const d = json.data
        setActiveId(d.conversationId)
        setMessages((prev) => [
          ...prev.filter((m) => !m.id.startsWith('tmp-')),
          { id: d.userMessage.id, role: 'user', content: d.userMessage.content },
          { id: d.assistantMessage.id, role: 'assistant', content: d.assistantMessage.content },
        ])
        if (d.mode === 'local' && aiConfigured) setAiConfigured(false)
        loadConversations()
      } catch {
        toast.error('网络错误，请重试')
        setMessages((prev) => prev.slice(0, -1))
      } finally {
        setSending(false)
      }
    },
    [activeId, aiConfigured, loadConversations, sending]
  )

  // 新消息自动滚底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
      {/* 会话列表 */}
      <div className="order-2 space-y-2 lg:order-1">
        <Button variant="outline" size="sm" className="w-full" onClick={newConversation}>
          <MessageSquarePlus className="mr-1 h-4 w-4" /> 新对话
        </Button>
        <div className="max-h-[420px] space-y-1 overflow-y-auto rounded-lg border bg-card p-1.5">
          {conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">暂无历史对话</p>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                'group flex cursor-pointer items-center gap-1 rounded-md px-2 py-2 text-sm hover:bg-muted',
                activeId === c.id && 'bg-muted font-medium'
              )}
              onClick={() => openConversation(c.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">{c.title}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {c.messageCount} 条 · {c.lastPreview || '…'}
                </div>
              </div>
              <Button
                variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                title="删除对话"
                onClick={(e) => { e.stopPropagation(); deleteConversation(c.id) }}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* 消息区 */}
      <div className="order-1 flex min-h-[480px] flex-col rounded-xl border bg-card lg:order-2">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bot className="h-4 w-4 text-emerald-600" /> Agent 对话
          </div>
          {aiConfigured === false && (
            <Badge variant="outline" className="h-5 text-[10px] text-amber-600">
              离线降级模式（未配置 AI）
            </Badge>
          )}
          {aiConfigured === true && (
            <Badge variant="outline" className="h-5 text-[10px] text-emerald-600">
              已接入 AI
            </Badge>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '60vh' }}>
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <Bot className="h-6 w-6" />
              </div>
              <p className="max-w-sm text-sm text-muted-foreground">
                给我一个目标（如「把沉默超过 30 天的欧洲客户唤醒」），我会结合你的客户、商机数据拆解执行；
                所有外部动作需你批准后才会执行。
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {m.role === 'assistant' && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}
              >
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-2">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Agent 正在分析你的数据…
              </div>
            </div>
          )}
        </div>

        {/* 建议指令 */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 border-t px-4 py-2.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                onClick={() => send(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* 输入区 */}
        <div className="flex gap-2 border-t p-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="描述一个目标，例如：帮我把沉默超过 30 天的欧洲客户唤醒"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(draft)
            }}
            disabled={sending}
          />
          <Button disabled={!draft.trim() || sending} onClick={() => send(draft)}>
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Zap className="mr-1 h-4 w-4" />}
            执行
          </Button>
        </div>
      </div>
    </div>
  )
}

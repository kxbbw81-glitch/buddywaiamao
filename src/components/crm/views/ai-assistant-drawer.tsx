'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Send, Bot, User, Sparkles, Trash2, Building2, FileText, Package, ClipboardList, X, ArrowUpRight, Square } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useCRMStore } from '@/store/use-crm-store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { INQUIRY_STATUS_LABELS, CUSTOMER_LEVEL_LABELS } from '@/lib/types'
import { toast } from 'sonner'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  contextHint?: string
}

const QUICK_ACTIONS = [
  { label: '分析客户', prompt: '帮我分析当前查看的客户的采购潜力和合作价值', icon: Building2, needContext: 'customer' },
  { label: '生成回复', prompt: '帮我生成一封专业的英文回复邮件给客户的询盘', icon: FileText, needContext: 'inquiry' },
  { label: '翻译文本', prompt: '请帮我将以下内容翻译为英文，保持商务邮件的正式语气', icon: Package },
  { label: '价格建议', prompt: '基于当前市场行情，请给出合理的定价建议和谈判策略', icon: ClipboardList },
  { label: '市场研究', prompt: '请分析当前目标市场的行业趋势和竞争态势', icon: ArrowUpRight },
]

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function AIAssistantDrawer() {
  const { aiDrawerOpen, setAiDrawerOpen, selectedCustomerId, selectedInquiryId, selectedQuotationId, selectedOrderId, currentUser, currentModule } = useCRMStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Fetch context data based on what's selected
  const { data: customerData } = useQuery({
    queryKey: ['ai-context-customer', selectedCustomerId],
    queryFn: () => fetch(`/api/customers/${selectedCustomerId}`).then(r => r.json()).then(d => d.data),
    enabled: !!selectedCustomerId,
  })

  const { data: inquiryData } = useQuery({
    queryKey: ['ai-context-inquiry', selectedInquiryId],
    queryFn: () => fetch(`/api/inquiries/${selectedInquiryId}`).then(r => r.json()).then(d => d.data),
    enabled: !!selectedInquiryId,
  })

  // Build context string
  const contextString = useMemo(() => {
    const parts: string[] = []
    if (customerData) {
      parts.push(`当前查看的客户: ${customerData.companyName} (${customerData.country})`)
      parts.push(`客户级别: ${CUSTOMER_LEVEL_LABELS[customerData.customerLevel as keyof typeof CUSTOMER_LEVEL_LABELS] || customerData.customerLevel}`)
      if (customerData.inquiries?.length) parts.push(`历史询盘数: ${customerData.inquiries.length}`)
      if (customerData._count) parts.push(`总询盘: ${customerData._count.inquiries}条, 总订单: ${customerData._count.orders}条`)
      if (customerData.owner) parts.push(`负责人: ${customerData.owner.name}`)
      if (customerData.website) parts.push(`官网: ${customerData.website}`)
    }
    if (inquiryData) {
      parts.push(`当前查看的询盘: ${inquiryData.inquiryNo} - ${inquiryData.subject}`)
      parts.push(`询盘状态: ${INQUIRY_STATUS_LABELS[inquiryData.status as keyof typeof INQUIRY_STATUS_LABELS] || inquiryData.status}`)
      if (inquiryData.customer) parts.push(`客户: ${inquiryData.customer.companyName}`)
      if (inquiryData.content) parts.push(`询盘内容: ${inquiryData.content.substring(0, 500)}`)
    }
    return parts.length > 0 ? parts.join('\n') : ''
  }, [customerData, inquiryData])

  // Context hint for UI
  const contextHint = useMemo(() => {
    if (customerData) return `${customerData.companyName}`
    if (inquiryData) return `${inquiryData.inquiryNo}`
    return ''
  }, [customerData, inquiryData])

  // Filtered quick actions based on context
  const availableActions = useMemo(() => {
    return QUICK_ACTIONS.map(action => ({
      ...action,
      disabled: action.needContext === 'customer' && !customerData,
      contextAware: action.needContext === 'customer' && !!customerData || action.needContext === 'inquiry' && !!inquiryData,
    }))
  }, [customerData, inquiryData])

  // 发送消息时只保留最近 20 条作为上下文（避免 token 过长）
  const getRecentMessages = useCallback((allMsgs: Message[]) => {
    return allMsgs.slice(-20)
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Auto-focus when opening
  useEffect(() => {
    if (aiDrawerOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [aiDrawerOpen])

  // 清理中断请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  /**
   * 解析 SSE 流，正确处理跨 chunk 的不完整行
   */
  async function readSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onChunk: (content: string) => void,
    onError: (msg: string) => void,
  ): Promise<void> {
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // 最后一个元素可能是不完整的行，保留在 buffer 中
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const payload = trimmed.slice(6) // 去掉 "data: "
        if (payload === '[DONE]') continue

        try {
          const parsed = JSON.parse(payload)
          if (parsed.error) {
            onError(parsed.error)
            return
          }
          if (typeof parsed.content === 'string') {
            onChunk(parsed.content)
          }
        } catch {
          // 跳过格式异常的数据
        }
      }
    }

    // 处理 buffer 中剩余的内容
    if (buffer.trim().startsWith('data: ')) {
      const payload = buffer.trim().slice(6)
      if (payload !== '[DONE]') {
        try {
          const parsed = JSON.parse(payload)
          if (parsed.error) {
            onError(parsed.error)
          } else if (typeof parsed.content === 'string') {
            onChunk(parsed.content)
          }
        } catch {
          // skip
        }
      }
    }
  }

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    inputRef.current?.focus()
  }, [])

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      contextHint: contextHint || undefined,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    // 创建流式回复占位消息
    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      },
    ])

    // 构建多轮对话 messages 数组
    const historyMessages = getRecentMessages([...messages, userMessage])
    const apiMessages = historyMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }))

    const abortController = new AbortController()
    abortRef.current = abortController

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          context: contextString || undefined,
        }),
        signal: abortController.signal,
      })

      // 检查是否返回了 JSON 错误（非 SSE）
      const contentType = res.headers.get('content-type') ?? ''
      if (!res.ok || !res.body) {
        if (contentType.includes('application/json')) {
          const errData = await res.json().catch(() => null)
          const errMsg = errData?.error || '请求失败'
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: errMsg } : m
            )
          )
          toast.error(errMsg)
        } else {
          throw new Error('请求失败')
        }
        return
      }

      const reader = res.body.getReader()
      let accumulated = ''

      await readSSEStream(
        reader,
        // onChunk
        (chunkContent: string) => {
          accumulated += chunkContent
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated } : m
            )
          )
        },
        // onError
        (errMsg: string) => {
          if (!accumulated) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: errMsg } : m
              )
            )
          }
          toast.error(errMsg)
        },
      )

      // 如果流结束但内容为空
      if (!accumulated) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: '抱歉，未能获得回复。请重试。' }
              : m
          )
        )
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 用户主动中断，不报错
        return
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: '网络错误，请稍后重试。' }
            : m
        )
      )
      toast.error('网络错误，请稍后重试')
    } finally {
      abortRef.current = null
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearMessages = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    setMessages([])
  }

  // 判断最后一条消息是否是正在流式输出的 assistant 消息
  const isStreamingLastAssistant = loading && messages.length > 0 && messages[messages.length - 1].role === 'assistant'
  const lastAssistantHasContent = isStreamingLastAssistant && messages[messages.length - 1].content.length > 0

  return (
    <Sheet open={aiDrawerOpen} onOpenChange={(open) => {
      if (!open) {
        abortRef.current?.abort()
        abortRef.current = null
        setLoading(false)
      }
      setAiDrawerOpen(open)
    }}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header with context indicator */}
        <SheetHeader className="p-4 border-b space-y-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <div className="relative">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              NexFab AI 助手
            </SheetTitle>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearMessages} title="清空对话">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
          {contextHint && (
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="outline" className="text-[10px] h-5 px-2 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50">
                <Building2 className="h-3 w-3 mr-1" />
                上下文: {contextHint}
              </Badge>
            </div>
          )}
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 crm-scrollbar">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="relative mb-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/60 dark:to-teal-900/60">
                  <Bot className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              </div>
              <h3 className="font-semibold text-sm mb-1">你好，我是 NexFab AI 助手</h3>
              <p className="text-xs text-muted-foreground mb-6 max-w-xs">
                我可以帮你分析客户、生成回复、翻译文本、提供价格建议和市场研究
              </p>
              <div className="w-full space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">快捷操作</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {availableActions.map((action) => {
                    const Icon = action.icon
                    return (
                      <Button
                        key={action.label}
                        variant={action.contextAware ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'text-xs gap-1.5 transition-all',
                          action.contextAware && 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20',
                          action.disabled && 'opacity-50'
                        )}
                        onClick={() => sendMessage(action.prompt)}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {action.label}
                        {action.contextAware && (
                          <span className="text-[9px] opacity-70">&#x2022;</span>
                        )}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
                msg.role === 'user' && 'flex-row-reverse'
              )}
            >
              <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                <AvatarFallback className={cn(
                  msg.role === 'user'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                )}>
                  {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="max-w-[80%] space-y-1">
                {msg.contextHint && msg.role === 'user' && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {msg.contextHint}
                  </p>
                )}
                <div className={cn(
                  'rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted rounded-tl-sm'
                )}>
                  {msg.content}
                  {/* 流式输出时，末尾闪烁光标 */}
                  {loading && msg.role === 'assistant' && msg === messages[messages.length - 1] && msg.content && (
                    <span className="inline-block w-1.5 h-4 bg-emerald-600 dark:bg-emerald-400 ml-0.5 animate-pulse rounded-sm align-middle" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground px-1">
                  {formatRelativeTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* 思考中动画：仅当最后一条 assistant 消息内容为空时显示 */}
          {isStreamingLastAssistant && !lastAssistantHasContent && (
            <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-muted-foreground">AI 正在思考...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-background">
          {contextString && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <Badge variant="secondary" className="text-[10px] h-5 gap-1 font-normal">
                <Building2 className="h-3 w-3 text-emerald-600" />
                已关联上下文
                <button onClick={() => {}} className="ml-0.5 hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                placeholder={contextHint ? `关于 ${contextHint} 的任何问题...` : '输入消息...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="flex-1 pr-10 rounded-xl border-emerald-200 dark:border-emerald-800 focus-visible:ring-emerald-500/20"
              />
            </div>
            {loading ? (
              <Button
                size="icon"
                onClick={stopStreaming}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 shadow-sm shadow-rose-600/20"
                title="停止生成"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 px-1">
            按 Enter 发送 · AI 可能产生不准确的信息
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

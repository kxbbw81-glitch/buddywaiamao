'use client'

import { useRef, useState } from 'react'
import { BookOpenCheck, FileText, Quote, SendHorizonal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface RagAnswer {
  a: string
  cites: string[]
}

interface RagNone {
  none: string
}

type RagItem = RagAnswer | RagNone

/**
 * 预置示例问答（对照原型 ragQA 演示数据）。
 * 真实 RAG 检索（/api/rag/query，带文档引用与有效性门禁）属交接文档 Phase 3，
 * 当前预置问答演示引用格式与「资料不足明确拒答」的安全红线。
 */
const RAG_QA: Record<string, RagItem> = {
  'PLA-301 的耐温范围是多少？TDS 在哪？': {
    a: 'PLA-301（白色耗材 1.75mm）长期使用温度 ≤ 55°C，热变形温度约 60°C（0.45 MPa）；打印推荐温度 190–220°C，热床 0–60°C。存储要求：密封避光，环境湿度 < 50%。TDS 文档为 v2.1（2026-07 更新），可在产品库 PLA-301 详情页的文档区直接下载。',
    cites: ['TDS v2.1 · §3 热性能', 'TDS v2.1 · §5 打印参数'],
  },
  '发德国的 PLA 耗材需要哪些认证？': {
    a: '根据已审核资料，发德国（欧盟）的 PLA 耗材需要：① REACH 附录 XVII 合规声明；② EN 71-3（若涉及玩具用途）；③ CE 标识（仅当耗材作为 3D 打印机整机配件出口时随整机）。PLA-301 / 305 均已有 REACH 文档；注意 PETG-310 的 TDS v1.0 已过期，其出口资料包暂不完整，报价前建议先补档。',
    cites: ['REACH 合规声明（PLA-301）', 'EU 出口要求 FAQ v3 · Q12', '产品库 · PETG-310 资料状态'],
  },
  'TPU-405 可以做食品接触应用吗？': {
    none: '知识库中没有足够资料回答这个问题：TPU-405 目前仅挂载 SDS v1.0，无食品接触（FDA / EU 10/2011）相关测试报告。我不会猜测或引用无关文档——建议联系供应商获取迁移测试报告，上传后我可以基于新资料重新回答。',
  },
}

type FreeState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; content: string }

export function RagQaView() {
  const [question, setQuestion] = useState<string | null>(null)
  const [freeInput, setFreeInput] = useState('')
  const [free, setFree] = useState<FreeState>({ status: 'idle' })
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  const item = question ? RAG_QA[question] : undefined

  const askFree = async () => {
    const q = freeInput.trim()
    if (!q || free.status === 'loading') return
    setQuestion(null)
    setFree({ status: 'loading' })
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: q }],
          context:
            '你是产品知识库问答助手。只依据资料库中已审核、未过期的产品文档（TDS/SDS/证书/FAQ）回答；资料不足时明确说不知道，绝不编造。答案需标注具体文档来源。',
        }),
      })
      if (!res.ok || !res.body) throw new Error('请求失败')
      const reader = res.body.getReader()
      readerRef.current = reader
      let accumulated = ''
      const decoder = new TextDecoder()
      let buffer = ''
      setFree({ status: 'done', content: '' })
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') continue
          try {
            const json = JSON.parse(payload)
            if (json.content) {
              accumulated += json.content
              setFree({ status: 'done', content: accumulated })
            }
            if (json.error) throw new Error(json.error)
          } catch {
            // 忽略无法解析的帧
          }
        }
      }
    } catch (e) {
      setFree({ status: 'done', content: (e as Error).message || 'AI 请求失败，请稍后重试' })
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenCheck className="h-5 w-5 text-amber-700" /> RAG 知识库问答
          </CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            用自然语言问产品问题，答案只引用已审核、未过期的产品文档（TDS / SDS / 证书 / FAQ），并标注具体来源；资料不足时明确说不知道——绝不编造。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {Object.keys(RAG_QA).map((q) => (
              <button
                key={q}
                onClick={() => {
                  setQuestion(q === question ? null : q)
                  setFree({ status: 'idle' })
                }}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  q === question
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-border bg-background text-foreground hover:border-blue-400 hover:text-blue-700'
                )}
              >
                {q}
              </button>
            ))}
          </div>

          {item && 'a' in item && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-2 text-sm font-medium">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{question}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{item.a}</p>
              <div className="mt-3 rounded-md bg-background p-3 text-xs text-muted-foreground">
                来源引用（点击查看原文片段）：
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {item.cites.map((c) => (
                    <span
                      key={c}
                      className="inline-flex cursor-pointer items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-700"
                    >
                      <FileText className="h-3 w-3" />
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {item && 'none' in item && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-2 text-sm font-medium text-red-800">
                <Quote className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{question}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-red-700">🚫 {item.none}</p>
            </div>
          )}

          {!item && free.status === 'idle' && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              点上方任一示例问题体验（也可以在下方直接输入产品问题）
            </p>
          )}

          {free.status === 'loading' && (
            <p className="py-2 text-center text-xs text-muted-foreground">正在检索知识库并生成回答……</p>
          )}

          {free.status === 'done' && free.content && (
            <div className="rounded-lg border p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{free.content}</p>
              <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                说明：自由提问走 AI 助手通道，暂未挂载文档级引用（RAG 检索接口属 Phase 3 接入项）；预置示例问答展示最终引用格式。
              </p>
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            引用范围 = 产品库中挂载在产品上的文档 · 文档过期 / 未审核即从可引用范围剔除 · 全局知识由 AI Agent·系统知识 引用
          </p>

          <div className="flex gap-2 border-t pt-3">
            <Input
              value={freeInput}
              onChange={(e) => setFreeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && askFree()}
              placeholder="输入产品问题，如：PETG-310 的 TDS 过期了吗？"
              disabled={free.status === 'loading'}
            />
            <Button size="sm" onClick={askFree} disabled={free.status === 'loading' || !freeInput.trim()}>
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Bot, Plus, Settings2, Trash2, Pencil, BookOpen, Brain, Timer, BarChart3,
  ShieldCheck, Zap, Package, Star,
} from 'lucide-react'
import { useCRMStore } from '@/store/use-crm-store'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ============ 数据类型 ============

type SkillSource = 'builtin' | 'custom'

interface AgentSkill {
  id: string
  name: string
  icon: string
  src: SkillSource
  on: boolean
  desc: string
  params: string // JSON 字符串
}

interface SkillCategory {
  key: string
  name: string
  icon: string
  builtin: boolean
  desc: string
  items: AgentSkill[]
}

let skillSeq = 100
const nextSkillId = () => `skill-${++skillSeq}`

// V3.12 原型 skillCats 数据：4 个预置分类（各 3 内置 + 1 自定义示例）
const DEFAULT_SKILL_CATS: SkillCategory[] = [
  {
    key: 'playbook', name: '销售打法', icon: '📖', builtin: true,
    desc: '团队沉淀的销售方法论（Playbook）——Agent 对话时按老销售的打法执行。按需手动添加新打法 skill，新人 Agent 自动继承团队经验。预置分类之一，不满意可自定义新分类。',
    items: [
      { id: 'pb-1', name: '首因建立信任打法', icon: '🤝', src: 'builtin', on: true, params: '{"首次接触":"先价值后产品","信任锚点":"同行业案例","禁忌":"首封邮件不谈价格"}', desc: '首封开发信先亮同行案例建立信任，第二轮才引入产品价值点。' },
      { id: 'pb-2', name: '价值锚定报价打法', icon: '⚓', src: 'builtin', on: true, params: '{"报价前置":"先锚定价值量","参考":"历史成交价区间","让步":"每次让步换取承诺"}', desc: '报价前先锚定价值（节省工时/良率提升），让步必须换取客户承诺。' },
      { id: 'pb-3', name: '催单窗口打法', icon: '⏰', src: 'builtin', on: true, params: '{"触发":"客户国假期≤14天","动作":"补货高峰提醒","话术":"假期前后产能收紧"}', desc: '客户国家节假日窗口期主动催单，与工作台假日告警联动。' },
      { id: 'pb-4', name: '沉默客户唤醒打法', icon: '🔔', src: 'custom', on: false, params: '{"触发":"沉默>30天","首触":"行业资讯切入","频次":"3次/月"}', desc: '对 30 天以上沉默客户用行业资讯重新切入，避免硬推销。' },
    ],
  },
  {
    key: 'memory', name: '业务记忆', icon: '🧠', builtin: true,
    desc: 'Agent 执行时自动引用的业务记忆——客户偏好、历史决策、价格底线。手动添加记忆 skill 让 Agent 记得更多业务上下文，可查看、可关闭。预置分类之一。',
    items: [
      { id: 'mm-1', name: '客户偏好记忆', icon: '🎯', src: 'builtin', on: true, params: '{"记录":"沟通渠道偏好","决策":"价格敏感度","禁忌":"不记录隐私信息"}', desc: '记录客户沟通渠道偏好、价格敏感度、决策链，Agent 跟进时自动引用。' },
      { id: 'mm-2', name: '价格底线记忆', icon: '💎', src: 'builtin', on: true, params: '{"来源":"审批通过的底价","保护":"低于底价需审批","版本":"按产品+客户"}', desc: '沉淀审批通过的底价与数量梯度，Agent 报价时自动对标且不越界。' },
      { id: 'mm-3', name: '汇率决策记忆', icon: '💱', src: 'builtin', on: true, params: '{"来源":"财务汇率版本台账","规则":"报价/收款/提成同版本","更新":"生效日切换"}', desc: '引用财务汇率版本台账，报价折算与提成核算保持同一版本可追溯。' },
      { id: 'mm-4', name: '售后承诺记忆', icon: '🛠️', src: 'custom', on: false, params: '{"记录":"客诉处理结论","跟进":"承诺到期提醒","权限":"仅管理员写"}', desc: '记录售后客诉处理结论与承诺事项，Agent 复购沟通时引用避免重复承诺。' },
    ],
  },
  {
    key: 'trigger', name: '自动触发', icon: '⏱️', builtin: true,
    desc: '规则化触发 Agent 任务——符合条件即自动生成任务在后台执行（如沉默客户自动唤醒）。手动添加触发规则 skill 即可扩展自动化场景。预置分类之一。',
    items: [
      { id: 'tg-1', name: '沉默客户自动唤醒', icon: '📴', src: 'builtin', on: true, params: '{"条件":"沉默>30天","动作":"生成唤醒方案","频率":"每周一8:00"}', desc: '沉默超 30 天客户自动生成唤醒方案，Agent 后台执行并推送给对应销售。' },
      { id: 'tg-2', name: '样品签收跟进', icon: '📦', src: 'builtin', on: true, params: '{"条件":"签收7天无反馈","动作":"发送反馈询问","升级":"14天转主管"}', desc: '样品签收 7 天无反馈自动发送询问邮件，14 天未回自动升级主管。' },
      { id: 'tg-3', name: '复购窗口提醒', icon: '🔄', src: 'builtin', on: true, params: '{"条件":"消耗周期-30天","动作":"生成复购商机","渠道":"邮件+WhatsApp"}', desc: '按消耗周期预测复购窗口，临近时自动生成复购商机进入管道。' },
      { id: 'tg-4', name: '询盘夜间响应', icon: '🌙', src: 'custom', on: false, params: '{"条件":"时区差异>8小时","动作":"首轮AI回复","升级":"人工8:00跟进"}', desc: '客户时区差异大时，夜间询盘由 Agent 首轮回复，次日人工跟进。' },
    ],
  },
  {
    key: 'quality', name: '运行质量', icon: '📊', builtin: true,
    desc: 'Agent 执行治理——任务成功率、外部动作批准率、纠错记录。治理 skill 决定采集哪些质量指标，看板实时可视化。预置分类之一。',
    items: [
      { id: 'ql-1', name: '任务成功率监控', icon: '✅', src: 'builtin', on: true, params: '{"指标":"任务成功率","目标":"≥90%","维度":"按任务类型"}', desc: '按任务类型统计成功率，低于目标自动标记异常并通知管理员。' },
      { id: 'ql-2', name: '外部动作批准率', icon: '🛂', src: 'builtin', on: true, params: '{"指标":"人工批准率","目标":"≤30%需优化","记录":"批准/拒绝原因"}', desc: '统计外部动作人工批准率与拒绝原因，识别 Agent 越权风险。' },
      { id: 'ql-3', name: '纠错记录追溯', icon: '🔍', src: 'builtin', on: true, params: '{"记录":"用户纠错内容","回灌":"纠错进记忆库","审计":"保留90天"}', desc: '记录用户每次纠错，纠错内容回灌记忆库并保留审计轨迹。' },
      { id: 'ql-4', name: '成本效率看板', icon: '💹', src: 'custom', on: false, params: '{"指标":"每次任务token成本","预警":"超均值2x","报告":"每周一"}', desc: '监控 Agent 任务 token 成本与耗时，异常波动自动周报。' },
    ],
  },
]

const STORAGE_KEY = 'nexfab-agent-skills-v1'

// 侧栏二级 key → 分类 key
const SUB_TO_CAT: Record<string, string> = {
  'agent-playbook': 'playbook',
  'agent-memory': 'memory',
  'agent-trigger': 'trigger',
  'agent-quality': 'quality',
}

const CATEGORY_ICONS = [BookOpen, Brain, Timer, BarChart3, Star, Package]

// ============ 主视图 ============

export function AgentHubView() {
  const { currentSubView, setCurrentNavigation } = useCRMStore()
  const [cats, setCats] = useState<SkillCategory[]>(DEFAULT_SKILL_CATS)
  const [hydrated, setHydrated] = useState(false)

  // localStorage 持久化（Phase 3 接后端 API 后替换）
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setCats(JSON.parse(raw))
    } catch { /* 忽略损坏数据 */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cats))
    } catch { /* 存储失败静默 */ }
  }, [cats, hydrated])

  const activeCatKey = SUB_TO_CAT[currentSubView] || ''

  if (!activeCatKey) {
    return <AgentChatEntry cats={cats} onJump={(catKey) => {
      const sub = Object.keys(SUB_TO_CAT).find((k) => SUB_TO_CAT[k] === catKey)
      if (sub) setCurrentNavigation('aihub', sub)
    }} />
  }

  return (
    <SkillsContainer
      cats={cats}
      activeCatKey={activeCatKey}
      onChangeCats={setCats}
      onSwitchCat={(catKey) => {
        const sub = Object.keys(SUB_TO_CAT).find((k) => SUB_TO_CAT[k] === catKey)
        if (sub) setCurrentNavigation('aihub', sub)
      }}
    />
  )
}

// ============ Agent 对话入口 ============

function AgentChatEntry({ cats, onJump }: { cats: SkillCategory[]; onJump: (catKey: string) => void }) {
  const [draft, setDraft] = useState('')
  const totalOn = cats.reduce((n, c) => n + c.items.filter((s) => s.on).length, 0)
  const total = cats.reduce((n, c) => n + c.items.length, 0)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <Bot className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Agent 对话</h2>
            <p className="text-sm text-muted-foreground">
              目标驱动的执行型助手——给它一个目标（如「把沉默客户唤醒」），它会调用已启用的 skills
              拆解执行；所有外部动作（发邮件/改数据）100% 需人工批准。
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold text-emerald-600">{totalOn} / {total}</div>
            <div className="text-xs text-muted-foreground">skills 已启用</div>
          </div>
        </div>

        {/* 对话输入壳：Phase 3 接入 AI 后端后启用 */}
        <div className="mt-4 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="描述一个目标，例如：帮我把沉默超过 30 天的欧洲客户唤醒"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                toast.info('Agent 对话将在 AI 后端接入后开放（Phase 3），当前先配置 skills')
                setDraft('')
              }
            }}
          />
          <Button
            disabled={!draft.trim()}
            onClick={() => {
              toast.info('Agent 对话将在 AI 后端接入后开放（Phase 3），当前先配置 skills')
              setDraft('')
            }}
          >
            <Zap className="mr-1 h-4 w-4" /> 执行
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {['唤醒沉默客户', '起草跟进邮件', '生成本周商机复盘', '分析丢单原因'].map((s) => (
            <span key={s} className="rounded-full border bg-muted/50 px-3 py-1 text-muted-foreground">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* 能力面板：全部分类动态遍历 */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Agent 能力（skills 分类 · 不设限）</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((cat, i) => {
            const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length]
            const on = cat.items.filter((s) => s.on).length
            return (
              <Card
                key={cat.key}
                className="crm-card-hover cursor-pointer"
                onClick={() => onJump(cat.key)}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-lg dark:bg-emerald-950">
                    {cat.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{cat.name}</span>
                      {!cat.builtin && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">自定义</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {on} / {cat.items.length} 启用 · 点击配置
                    </div>
                  </div>
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          安全红线：Agent 的所有外部动作（发送邮件、修改客户/订单数据、对外报价）必须人工批准后执行；
          个人数据（待办/备忘）任何角色仅本人可见，Agent 不越权读取。
        </span>
      </div>
    </div>
  )
}

// ============ Skills 容器 ============

function SkillsContainer({
  cats, activeCatKey, onChangeCats, onSwitchCat,
}: {
  cats: SkillCategory[]
  activeCatKey: string
  onChangeCats: (cats: SkillCategory[]) => void
  onSwitchCat: (catKey: string) => void
}) {
  const activeCat = cats.find((c) => c.key === activeCatKey) || cats[0]
  const [addOpen, setAddOpen] = useState(false)
  const [catMgrOpen, setCatMgrOpen] = useState(false)

  const toggleSkill = (skillId: string) => {
    onChangeCats(cats.map((c) => ({
      ...c,
      items: c.items.map((s) => (s.id === skillId ? { ...s, on: !s.on } : s)),
    })))
  }

  const removeSkill = (skillId: string) => {
    onChangeCats(cats.map((c) => ({
      ...c,
      items: c.items.filter((s) => s.id !== skillId),
    })))
    toast.success('已删除自定义 skill')
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* 分类 Tab 栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={activeCat.key} onValueChange={onSwitchCat}>
          <TabsList>
            {cats.map((c) => (
              <TabsTrigger key={c.key} value={c.key} className="gap-1.5">
                <span>{c.icon}</span>
                {c.name}
                <span className="text-xs text-muted-foreground">
                  {c.items.filter((s) => s.on).length}/{c.items.length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={() => setCatMgrOpen(true)}>
          <Settings2 className="mr-1 h-4 w-4" /> 管理分类
        </Button>
      </div>

      {/* 当前分类说明 + 添加入口 */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{activeCat.icon}</span>
              <h2 className="text-base font-semibold">{activeCat.name}</h2>
              {activeCat.builtin
                ? <Badge variant="secondary" className="h-5 text-[10px]">预置分类</Badge>
                : <Badge variant="outline" className="h-5 text-[10px]">自定义分类</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{activeCat.desc}</p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> 添加 skill
          </Button>
        </div>
      </div>

      {/* skill 卡片网格 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {activeCat.items.map((skill) => (
          <Card key={skill.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xl">{skill.icon}</span>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-semibold">{skill.name}</CardTitle>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge
                        variant={skill.src === 'builtin' ? 'secondary' : 'outline'}
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {skill.src === 'builtin' ? '内置' : '自定义'}
                      </Badge>
                      <span className={cn('text-xs', skill.on ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {skill.on ? '已启用' : '已停用'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={skill.on} onCheckedChange={() => toggleSkill(skill.id)} />
                  {skill.src === 'custom' && (
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSkill(skill.id)}
                      title="删除自定义 skill"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-2">
              <p className="text-sm text-muted-foreground">{skill.desc}</p>
              <pre className="mt-auto overflow-x-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed text-muted-foreground">
                {skill.params}
              </pre>
            </CardContent>
          </Card>
        ))}
        {activeCat.items.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              该分类下暂无 skill，点击右上角「添加 skill」开始配置。
            </CardContent>
          </Card>
        )}
      </div>

      <AddSkillDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        cats={cats}
        defaultCatKey={activeCat.key}
        onSubmit={(skill, catKey) => {
          onChangeCats(cats.map((c) => (c.key === catKey ? { ...c, items: [...c.items, skill] } : c)))
          toast.success(`已添加 skill「${skill.name}」到「${cats.find((c) => c.key === catKey)?.name}」`)
        }}
      />

      <CategoryManagerDialog
        open={catMgrOpen}
        onOpenChange={setCatMgrOpen}
        cats={cats}
        onChangeCats={onChangeCats}
      />
    </div>
  )
}

// ============ 添加 skill 弹窗 ============

function AddSkillDialog({
  open, onOpenChange, cats, defaultCatKey, onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  cats: SkillCategory[]
  defaultCatKey: string
  onSubmit: (skill: AgentSkill, catKey: string) => void
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('⚡')
  const [desc, setDesc] = useState('')
  const [params, setParams] = useState('{}')
  const [catKey, setCatKey] = useState(defaultCatKey)

  useEffect(() => {
    if (open) {
      setName('')
      setIcon('⚡')
      setDesc('')
      setParams('{}')
      setCatKey(defaultCatKey)
    }
  }, [open, defaultCatKey])

  const valid = name.trim() && desc.trim()

  const submit = () => {
    let finalParams = params.trim() || '{}'
    try {
      JSON.parse(finalParams)
    } catch {
      toast.error('参数必须是合法 JSON，例如 {"触发":"沉默>30天"}')
      return
    }
    onSubmit({
      id: nextSkillId(),
      name: name.trim(),
      icon: icon.trim() || '⚡',
      src: 'custom',
      on: true,
      desc: desc.trim(),
      params: finalParams,
    }, catKey)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加 skill</DialogTitle>
          <DialogDescription>
            自定义 skill 归入任意分类；内置 skill 由系统随版本维护，不可删除。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <Label htmlFor="skill-name">名称</Label>
            <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：展会线索快速建档" />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <Label htmlFor="skill-icon">图标</Label>
            <Input id="skill-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="emoji，如 🎪" className="w-24" />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <Label htmlFor="skill-desc">说明</Label>
            <Input id="skill-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="这个 skill 做什么、何时触发" />
          </div>
          <div className="grid grid-cols-[80px_1fr] items-center gap-3">
            <Label>所属分类</Label>
            <Select value={catKey} onValueChange={setCatKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.icon} {c.name}{!c.builtin ? '（自定义）' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[80px_1fr] items-start gap-3">
            <Label htmlFor="skill-params" className="pt-2">参数</Label>
            <Textarea
              id="skill-params" value={params} onChange={(e) => setParams(e.target.value)}
              placeholder='JSON 格式，如 {"触发":"沉默>30天","频次":"3次/月"}' rows={3}
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!valid} onClick={submit}>添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ 分类管理弹窗 ============

function CategoryManagerDialog({
  open, onOpenChange, cats, onChangeCats,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  cats: SkillCategory[]
  onChangeCats: (cats: SkillCategory[]) => void
}) {
  const [newName, setNewName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const createCat = () => {
    const name = newName.trim()
    if (!name) return
    if (cats.some((c) => c.name === name)) {
      toast.error('已存在同名分类')
      return
    }
    const key = `cat-${Date.now()}`
    onChangeCats([...cats, { key, name, icon: '🗂️', builtin: false, desc: '自定义分类：按团队实际业务场景归集 skills。', items: [] }])
    setNewName('')
    toast.success(`已创建分类「${name}」`)
  }

  const renameCat = (key: string) => {
    const name = renameValue.trim()
    if (!name) return
    if (cats.some((c) => c.name === name && c.key !== key)) {
      toast.error('已存在同名分类')
      return
    }
    onChangeCats(cats.map((c) => (c.key === key ? { ...c, name } : c)))
    setRenaming(null)
    toast.success('分类已重命名')
  }

  const deleteCat = (key: string) => {
    const cat = cats.find((c) => c.key === key)
    if (!cat || cat.builtin) return
    onChangeCats(cats.filter((c) => c.key !== key))
    toast.success(`已删除分类「${cat.name}」及其 ${cat.items.length} 个 skill`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>管理 skills 分类</DialogTitle>
          <DialogDescription>
            分类不设限：预置分类之外可自由创建业务分类（如客户服务、产品知识、售后支持）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 py-1">
          <Input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="新分类名称，如：客户服务"
            onKeyDown={(e) => e.key === 'Enter' && createCat()}
          />
          <Button size="sm" onClick={createCat} disabled={!newName.trim()}>
            <Plus className="mr-1 h-4 w-4" /> 新建
          </Button>
        </div>

        <div className="max-h-72 space-y-1.5 overflow-y-auto py-1">
          {cats.map((c) => (
            <div key={c.key} className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <span>{c.icon}</span>
              {renaming === c.key ? (
                <>
                  <Input
                    value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                    className="h-8 flex-1" autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && renameCat(c.key)}
                  />
                  <Button size="sm" className="h-7" onClick={() => renameCat(c.key)}>保存</Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setRenaming(null)}>取消</Button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm">
                    {c.name}
                    <span className="ml-2 text-xs text-muted-foreground">{c.items.length} 个 skill</span>
                  </span>
                  {c.builtin ? (
                    <Badge variant="secondary" className="h-5 text-[10px]">预置</Badge>
                  ) : (
                    <>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7" title="重命名"
                        onClick={() => { setRenaming(c.key); setRenameValue(c.name) }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="删除分类（含其下 skill）"
                        onClick={() => deleteCat(c.key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

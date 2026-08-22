'use client'

import { useMemo, useState } from 'react'
import { Search, BookMarked } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// 外贸常用 HS 编码章节速查（参考数据）
// 退税率为中国出口退税常见档（13%），实际以海关最新公告为准
interface HsEntry {
  code: string
  chapter: string
  desc: string
  rebateRate: number
  keywords: string
}

const HS_DATA: HsEntry[] = [
  { code: '39', chapter: '塑料及其制品', desc: '塑料片/管/板、包装材料、日用塑料制品', rebateRate: 13, keywords: '塑料 包装 片材 日用' },
  { code: '48', chapter: '纸及纸板制品', desc: '纸箱、纸盒、信封、卫生纸制品', rebateRate: 13, keywords: '纸 纸箱 纸盒 包装' },
  { code: '61', chapter: '针织或钩编服装', desc: 'T恤、毛衣、针织衫、运动服', rebateRate: 13, keywords: '针织 服装 T恤 毛衣 运动' },
  { code: '62', chapter: '非针织（梭织）服装', desc: '衬衫、外套、长裤、连衣裙', rebateRate: 13, keywords: '梭织 衬衫 外套 长裤 裙' },
  { code: '63', chapter: '其他纺织制品', desc: '家用纺织品、窗帘、床上用品、毛巾', rebateRate: 13, keywords: '家纺 窗帘 床上 毛巾 地毯' },
  { code: '64', chapter: '鞋靴护腿', desc: '皮鞋、运动鞋、拖鞋、劳保鞋', rebateRate: 13, keywords: '鞋 靴 拖鞋 运动' },
  { code: '70', chapter: '玻璃及其制品', desc: '玻璃器皿、玻璃瓶、镜片、玻璃工艺品', rebateRate: 13, keywords: '玻璃 器皿 瓶 镜' },
  { code: '71', chapter: '珠宝贵金属', desc: '首饰、银饰、金饰、珍珠宝石', rebateRate: 13, keywords: '珠宝 首饰 金 银 珍珠' },
  { code: '73', chapter: '钢铁制品', desc: '五金件、紧固件、钢丝、钢制家具配件', rebateRate: 13, keywords: '钢铁 五金 紧固件 螺丝' },
  { code: '82', chapter: '工具器具利口器', desc: '手工工具、刀具、剪刀、厨具', rebateRate: 13, keywords: '工具 刀 剪 厨具' },
  { code: '83', chapter: '杂项贱金属制品', desc: '徽章、拉链、扣件、小金属件', rebateRate: 13, keywords: '徽章 拉链 扣 金属件' },
  { code: '84', chapter: '机械器具', desc: '发动机、泵、阀门、工程机械、农业机械', rebateRate: 13, keywords: '机械 发动机 泵 阀门 工程 农业' },
  { code: '85', chapter: '电机电气设备', desc: '电池、灯具、家电、电子元器件、线缆', rebateRate: 13, keywords: '电机 电气 电池 灯具 家电 电子 线缆' },
  { code: '87', chapter: '车辆及零附件', desc: '汽车零配件、自行车、电动车及配件', rebateRate: 13, keywords: '车辆 汽车 配件 自行车 电动' },
  { code: '90', chapter: '光学医疗仪器', desc: '眼镜、镜片、医疗器械、测量仪器', rebateRate: 13, keywords: '光学 眼镜 镜片 医疗 测量 仪器' },
  { code: '91', chapter: '钟表', desc: '手表、座钟、怀表及零件', rebateRate: 13, keywords: '钟表 手表 怀表' },
  { code: '94', chapter: '家具寝具灯具', desc: '家具、床垫、台灯、装饰灯具', rebateRate: 13, keywords: '家具 床垫 台灯 灯具' },
  { code: '95', chapter: '玩具运动用品', desc: '玩具、游戏机、运动器材、渔具', rebateRate: 13, keywords: '玩具 游戏 运动 器材 渔具' },
  { code: '96', chapter: '杂项制品', desc: '梳子、工艺品、装饰品、打火机', rebateRate: 13, keywords: '杂项 梳子 工艺 装饰 打火机' },
  { code: '42', chapter: '皮革制品箱包', desc: '箱包、皮具、钱包、公文包', rebateRate: 13, keywords: '皮革 箱包 钱包 公文包' },
]

export function HsLookupView() {
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return HS_DATA
    return HS_DATA.filter((e) =>
      e.code.includes(kw) ||
      e.chapter.toLowerCase().includes(kw) ||
      e.desc.toLowerCase().includes(kw) ||
      e.keywords.toLowerCase().includes(kw)
    )
  }, [q])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookMarked className="h-5 w-5 text-emerald-600" /> HS 编码速查
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            外贸常用 HS 编码章节速查，含典型商品与出口退税率参考。输入关键词（如「服装」「电子」「五金」或章节号）筛选。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="搜索章节号或商品关键词，如 85、服装、五金"
              className="pl-9"
            />
          </div>

          <div className="text-xs text-muted-foreground">共 {results.length} 条</div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {results.map((e) => (
              <div key={e.code} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-6 font-mono">{e.code}</Badge>
                    <span className="font-medium">{e.chapter}</span>
                  </div>
                  <Badge variant="outline" className="h-5 text-[10px] text-emerald-600">退税 {e.rebateRate}%</Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{e.desc}</p>
              </div>
            ))}
            {results.length === 0 && (
              <div className="sm:col-span-2 py-8 text-center text-sm text-muted-foreground">
                未找到匹配的 HS 编码章节
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
        说明：以上为外贸高频章节速查参考，退税率以 13%（中国出口常见档）为示意，实际退税率随商品编码与政策调整，请以海关总署与税务总局最新公告为准；具体报关需查询 8-10 位完整 HS 编码。
      </div>
    </div>
  )
}

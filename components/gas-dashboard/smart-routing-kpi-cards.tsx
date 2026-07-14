"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Zap, Layers, CircleDollarSign, Mic } from "lucide-react"
import { MONTHLY_BUDGET_JPY } from "@/lib/smartRouting"

export type SmartRoutingStats = {
  modelUsage: {
    flashLite: number
    flash: number
    flashLiteRate: number
  }
  cacheStats: {
    hitCount: number
    hitRate: number
    savedTokens: number
  }
  costStats: {
    totalCostJpy: number
    avgCostPerChat: number
    estimatedMonthly: number
    flashLiteCostJpy: number
    flashCostJpy: number
  }
  inputMethodStats: {
    voice: number
    text: number
    voiceRate: number
  }
}


export function SmartRoutingKpiCards({ stats }: { stats: SmartRoutingStats }) {
  const { modelUsage, cacheStats, costStats, inputMethodStats } = stats

  // 月間コストのアラート色（70%→黄、90%→赤。上限超過でもリクエストは止めない・監視のみ）
  const budgetRatio = costStats.estimatedMonthly / MONTHLY_BUDGET_JPY
  const costColor =
    budgetRatio >= 0.9 ? "text-red-600" :
    budgetRatio >= 0.7 ? "text-amber-600" :
    "text-foreground"
  const costBg =
    budgetRatio >= 0.9 ? "bg-red-500/5" :
    budgetRatio >= 0.7 ? "bg-amber-500/5" :
    ""

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* カード①：モデル使用比率 */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground tracking-wide">モデル使用比率</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {modelUsage.flashLiteRate.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-muted-foreground">% Flash-Lite</span>
              </div>
            </div>
            <div className="rounded-lg p-2.5 bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
          </div>
          {/* プログレスバー */}
          <div className="mt-3">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${modelUsage.flashLiteRate}%` }}
              />
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${100 - modelUsage.flashLiteRate}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span className="text-emerald-600 font-medium">Flash-Lite {modelUsage.flashLite}件</span>
              <span className="text-blue-600 font-medium">Flash {modelUsage.flash}件</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">スマートルーティングにより Flash 使用を最小化</p>
        </CardContent>
      </Card>

      {/* カード②：キャッシュヒット率 */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground tracking-wide">キャッシュヒット率</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {cacheStats.hitRate.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-muted-foreground">%</span>
              </div>
            </div>
            <div className="rounded-lg p-2.5 bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-emerald-600">
              今月の削減トークン数：{cacheStats.savedTokens.toLocaleString("ja-JP")} トークン
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">キャッシュヒット {cacheStats.hitCount} 回</p>
        </CardContent>
      </Card>

      {/* カード③：モデル別原価内訳（月間推定APIコスト） */}
      <Card className={`border-border/60 ${costBg}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground tracking-wide">モデル別原価内訳（今月）</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold tracking-tight ${costColor}`}>
                  ¥{costStats.totalCostJpy.toLocaleString("ja-JP")}
                </span>
              </div>
            </div>
            <div className={`rounded-lg p-2.5 ${budgetRatio >= 0.9 ? "bg-red-500/10" : budgetRatio >= 0.7 ? "bg-amber-500/10" : "bg-primary/10"}`}>
              <CircleDollarSign className={`h-5 w-5 ${budgetRatio >= 0.9 ? "text-red-600" : budgetRatio >= 0.7 ? "text-amber-600" : "text-primary"}`} />
            </div>
          </div>
          <div className="mt-3 flex justify-between text-xs">
            <span className="text-emerald-600 font-medium">Flash-Lite ¥{costStats.flashLiteCostJpy.toLocaleString("ja-JP")}</span>
            <span className="text-blue-600 font-medium">Flash ¥{costStats.flashCostJpy.toLocaleString("ja-JP")}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`text-xs font-semibold ${costColor}`}>
              月末推定：¥{costStats.estimatedMonthly.toLocaleString("ja-JP")}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            1会話あたり平均 ¥{costStats.avgCostPerChat.toFixed(3)} / 上限 ¥{MONTHLY_BUDGET_JPY.toLocaleString("ja-JP")}（超過してもリクエストは継続・監視のみ）
          </p>
        </CardContent>
      </Card>

      {/* カード④：音声入力比率 */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground tracking-wide">音声入力比率</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {inputMethodStats.voiceRate.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-muted-foreground">%</span>
              </div>
            </div>
            <div className="rounded-lg p-2.5 bg-primary/10">
              <Mic className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-violet-500 transition-all"
                style={{ width: `${inputMethodStats.voiceRate}%` }}
              />
              <div
                className="bg-slate-400 transition-all"
                style={{ width: `${100 - inputMethodStats.voiceRate}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span className="text-violet-600 font-medium">音声 {inputMethodStats.voice}件</span>
              <span className="font-medium">テキスト {inputMethodStats.text}件</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

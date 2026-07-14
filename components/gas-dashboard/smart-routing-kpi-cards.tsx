"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Layers, Mic } from "lucide-react"

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
  const { cacheStats, inputMethodStats } = stats

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* カード①：キャッシュヒット率 */}
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

      {/* カード②：音声入力比率 */}
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

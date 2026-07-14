"use client"

import { Card, CardContent } from "@/components/ui/card"
import { MONTHLY_BUDGET_JPY } from "@/lib/smartRouting"

export type ModelCostBreakdownStats = {
  modelUsage: {
    flashLite: number
    flash: number
  }
  costStats: {
    totalCostJpy: number
    flashLiteCostJpy: number
    flashCostJpy: number
  }
}

const ROWS_BASE = [
  { key: "flashLite" as const, label: "Gemini 2.5 Lite", bar: "bg-emerald-500" },
  { key: "flash" as const, label: "Gemini Flash", bar: "bg-blue-500" },
]

// クウェスト社内アカウント向け：Gemini 2.5 Flash-Lite/Flashのモデル別原価内訳
export function ModelCostBreakdownCard({ stats }: { stats: ModelCostBreakdownStats }) {
  const { modelUsage, costStats } = stats
  const budgetRatio = costStats.totalCostJpy / MONTHLY_BUDGET_JPY
  const totalColor =
    budgetRatio >= 0.9 ? "text-red-600" :
    budgetRatio >= 0.7 ? "text-amber-600" :
    "text-foreground"
  const totalBar =
    budgetRatio >= 0.9 ? "bg-red-500" :
    budgetRatio >= 0.7 ? "bg-amber-500" :
    "bg-primary"

  const rows = [
    { ...ROWS_BASE[0], cost: costStats.flashLiteCostJpy, count: modelUsage.flashLite },
    { ...ROWS_BASE[1], cost: costStats.flashCostJpy, count: modelUsage.flash },
  ]

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <span className="text-xs font-medium text-muted-foreground tracking-wide">今月のAPI原価（上限：¥{MONTHLY_BUDGET_JPY.toLocaleString("ja-JP")}）</span>

        <div className="mt-3 flex flex-col gap-2.5">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-3 text-xs">
              <span className="w-28 shrink-0 font-medium text-foreground">{row.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${row.bar} transition-all`}
                  style={{ width: `${Math.min((row.cost / MONTHLY_BUDGET_JPY) * 100, 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-semibold text-foreground">¥{row.cost.toLocaleString("ja-JP")}</span>
              <span className="w-16 shrink-0 text-right text-muted-foreground">{row.count.toLocaleString("ja-JP")}件</span>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="w-28 shrink-0 font-semibold text-foreground">合計</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${totalBar} transition-all`}
                style={{ width: `${Math.min(budgetRatio * 100, 100)}%` }}
              />
            </div>
            <span className={`w-16 shrink-0 text-right font-bold ${totalColor}`}>¥{costStats.totalCostJpy.toLocaleString("ja-JP")}</span>
            <span className={`w-16 shrink-0 text-right font-medium ${totalColor}`}>{Math.round(budgetRatio * 1000) / 10}%</span>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">※ 上限超過でもリクエストは止まりません</p>
      </CardContent>
    </Card>
  )
}

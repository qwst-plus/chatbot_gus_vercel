"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Gauge } from "lucide-react"

export type RequestQuota = {
  used: number
  total: number
  remaining: number
  resetDate: string
}

// 旭川ガス向け：金額・モデル名は一切見せず、月間リクエスト残量のみ表示するカード
export function RequestQuotaCard({ quota }: { quota: RequestQuota }) {
  const rate = quota.total > 0 ? (quota.used / quota.total) * 100 : 0
  const color =
    rate >= 90 ? "text-red-600" :
    rate >= 70 ? "text-amber-600" :
    "text-foreground"
  const bg =
    rate >= 90 ? "bg-red-500/5" :
    rate >= 70 ? "bg-amber-500/5" :
    ""
  const iconBg =
    rate >= 90 ? "bg-red-500/10" :
    rate >= 70 ? "bg-amber-500/10" :
    "bg-primary/10"
  const iconColor =
    rate >= 90 ? "text-red-600" :
    rate >= 70 ? "text-amber-600" :
    "text-primary"
  const barColor =
    rate >= 90 ? "bg-red-500" :
    rate >= 70 ? "bg-amber-500" :
    "bg-primary"
  const resetDateLabel = quota.resetDate.replace(/^\d{4}-(\d{2})-(\d{2})$/, (_, m, d) => `${Number(m)}月${Number(d)}日`)

  return (
    <Card className={`border-border/60 ${bg}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground tracking-wide">今月のリクエスト残量</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-3xl font-bold tracking-tight ${color}`}>
                {quota.remaining.toLocaleString("ja-JP")}
              </span>
              <span className="text-base font-medium text-muted-foreground">
                / {quota.total.toLocaleString("ja-JP")} 回
              </span>
            </div>
          </div>
          <div className={`rounded-lg p-3 ${iconBg}`}>
            <Gauge className={`h-6 w-6 ${iconColor}`} />
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${Math.min(rate, 100)}%` }}
            />
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{resetDateLabel}に残量がリセットされます</p>
      </CardContent>
    </Card>
  )
}

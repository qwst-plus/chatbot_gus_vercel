"use client"

import { Card, CardContent } from "@/components/ui/card"

export type RequestQuota = {
  used: number
  total: number
  remaining: number
  resetDate: string
}

// 旭川ガス向け：金額・モデル名は一切見せず、月間リクエスト残量のみ表示するカード
export function RequestQuotaCard({ quota }: { quota: RequestQuota }) {
  const rate = quota.total > 0 ? (quota.used / quota.total) * 100 : 0
  const rateRounded = Math.round(rate)
  const color =
    rate >= 90 ? "text-red-600" :
    rate >= 70 ? "text-amber-600" :
    "text-foreground"
  const bg =
    rate >= 90 ? "bg-red-500/5" :
    rate >= 70 ? "bg-amber-500/5" :
    ""
  const barColor =
    rate >= 90 ? "bg-red-500" :
    rate >= 70 ? "bg-amber-500" :
    "bg-primary"
  const resetDateLabel = quota.resetDate.replace(/^\d{4}-(\d{2})-(\d{2})$/, (_, m, d) => `${Number(m)}月${Number(d)}日`)

  return (
    <Card className={`border-border/60 ${bg}`}>
      <CardContent className="p-6">
        <span className="text-sm font-medium text-muted-foreground tracking-wide">今月のご利用状況</span>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${Math.min(rate, 100)}%` }}
            />
          </div>
          <span className={`text-lg font-bold tracking-tight ${color}`}>{rateRounded}%</span>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {quota.used.toLocaleString("ja-JP")} / {quota.total.toLocaleString("ja-JP")} リクエスト
        </p>

        <div className="mt-4 flex flex-col gap-1 border-t border-border/60 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">残り</span>
            <span className={`font-semibold ${color}`}>{quota.remaining.toLocaleString("ja-JP")}リクエスト</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">リセット日</span>
            <span className="font-medium text-foreground">{resetDateLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

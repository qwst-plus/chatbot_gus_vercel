"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PhoneOff, Clock, Banknote, Calculator } from "lucide-react"

interface SavingsWidgetProps {
  resolvedCount: number
  avgCallDurationMinutes?: number
  costPerMinute?: number
}

export function SavingsWidget({ resolvedCount, avgCallDurationMinutes = 5, costPerMinute = 100 }: SavingsWidgetProps) {
  const totalMinutesSaved = resolvedCount * avgCallDurationMinutes
  const totalHoursFloat = totalMinutesSaved / 60
  const costSavings = totalMinutesSaved * costPerMinute

  // 時間表示：60分未満は分で表示、それ以上は小数1桁の時間で表示
  const timeDisplay = totalMinutesSaved < 60
    ? { value: totalMinutesSaved.toLocaleString('ja-JP'), unit: "分" }
    : { value: totalHoursFloat.toFixed(1), unit: "時間" }

  // コスト表示：1万円未満は円で表示、それ以上は万円で表示
  const costDisplay = costSavings < 10000
    ? { value: costSavings.toLocaleString('ja-JP'), unit: "円" }
    : { value: (costSavings / 10000).toFixed(1), unit: "万円" }

  return (
    <Card className="border-border/60 bg-accent/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <PhoneOff className="h-4 w-4 text-accent" />
          <CardTitle className="text-sm font-semibold text-foreground tracking-wide">電話削減効果試算</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">AIによる自動応答で削減された電話対応コストの試算</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-lg bg-card p-4 border border-border/40">
            <div className="rounded-md bg-accent/10 p-2"><Clock className="h-4 w-4 text-accent" /></div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">削減時間</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">{timeDisplay.value}</span>
                <span className="text-xs text-muted-foreground">{timeDisplay.unit}</span>
              </div>
              {totalMinutesSaved >= 60 && (
                <span className="text-[10px] text-muted-foreground">({totalMinutesSaved.toLocaleString('ja-JP')}分)</span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-card p-4 border border-border/40">
            <div className="rounded-md bg-accent/10 p-2"><Banknote className="h-4 w-4 text-accent" /></div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">削減コスト</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">{costDisplay.value}</span>
                <span className="text-xs text-muted-foreground">{costDisplay.unit}</span>
              </div>
              {costSavings >= 10000 && (
                <span className="text-[10px] text-muted-foreground">({costSavings.toLocaleString('ja-JP')}円)</span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-card p-4 border border-border/40">
            <div className="rounded-md bg-muted p-2"><Calculator className="h-4 w-4 text-muted-foreground" /></div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">算出根拠</span>
              <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                <span>AI解決件数: {resolvedCount.toLocaleString('ja-JP')}件</span>
                <span>平均通話時間: {avgCallDurationMinutes}分/件</span>
                <span>人件費単価: {costPerMinute}円/分</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-md bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground font-mono">
            {resolvedCount.toLocaleString('ja-JP')}件 x {avgCallDurationMinutes}分 = {totalMinutesSaved.toLocaleString('ja-JP')}分 → {totalMinutesSaved.toLocaleString('ja-JP')}分 x {costPerMinute}円 = {costSavings.toLocaleString('ja-JP')}円
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Clock } from "lucide-react"
import type { ModeHistory } from "@/lib/gas-mock-data"
import { calculateModeDuration, formatDateTime } from "@/lib/gas-mock-data"

interface ModeHistoryListProps {
  history: ModeHistory[]
}

export function ModeHistoryList({ history }: ModeHistoryListProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <CardTitle className="text-sm font-semibold text-foreground tracking-wide">モード履歴</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">緊急モードの切り替え履歴</p>
      </CardHeader>
      <CardContent className="pt-0">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">今月のモード切り替えはありません</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((item, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg border border-border/40 bg-card p-3">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className={`text-xs ${item.mode === "緊急" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : ""}`}>
                    {item.mode}モード
                  </Badge>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">開始:</span>
                      <span className="font-medium text-foreground">{formatDateTime(item.startedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">終了:</span>
                      <span className="font-medium text-foreground">{item.endedAt ? formatDateTime(item.endedAt) : "継続中"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{calculateModeDuration(item)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

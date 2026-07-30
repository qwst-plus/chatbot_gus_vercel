"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ShieldCheck } from "lucide-react"

type EarthquakeStatus = {
  is_active: boolean
  intensity: string | null
  area: string | null
  detected_at: string | null
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })
}

export function EmergencyModeControl() {
  const [status, setStatus] = useState<EarthquakeStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/earthquake-status")
      if (!res.ok) return
      setStatus(await res.json() as EarthquakeStatus)
    } catch {
      // ネットワークエラーは無視（次回ポーリングに委ねる）
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30 * 1000)
    return () => clearInterval(timer)
  }, [load])

  const runAction = useCallback(async (action: "clear" | "extend", confirmMessage: string) => {
    if (!window.confirm(confirmMessage)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/earthquake-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error ?? `HTTP ${res.status}`)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [load])

  if (!status) return null

  return (
    <Card className={`border-border/60 ${status.is_active ? "bg-red-500/5" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {status.is_active ? (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          )}
          <CardTitle className="text-sm font-semibold text-foreground tracking-wide">緊急モード（地震）手動操作</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">誤検知時や現地確認後の手動解除・延長</p>
      </CardHeader>
      <CardContent className="pt-0 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="secondary"
            className={status.is_active ? "bg-red-500/10 text-red-600 border-red-500/20" : ""}
          >
            {status.is_active ? "緊急モード発動中" : "通常モード"}
          </Badge>
          {status.is_active && (
            <span className="text-xs text-muted-foreground">
              震度{status.intensity}（{status.area}）・検知: {formatDateTime(status.detected_at)}
            </span>
          )}
        </div>

        {status.is_active && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => runAction("clear", "緊急モードを今すぐ手動解除します。よろしいですか？")}
            >
              今すぐ解除
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => runAction("extend", "緊急モードを現在時刻から2時間延長します。よろしいですか？")}
            >
              2時間延長
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-red-600">エラー: {error}</p>}
      </CardContent>
    </Card>
  )
}

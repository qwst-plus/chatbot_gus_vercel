"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Download } from "lucide-react"
import type { GasDashboardProps } from "@/lib/gas-mock-data"
import { GasKpiCards } from "@/components/gas-dashboard/gas-kpi-cards"
import { PhoneEscalationCard } from "@/components/gas-dashboard/phone-escalation-card"
import { ConversationTrendChart } from "@/components/gas-dashboard/conversation-trend-chart"
import { HeatmapChart } from "@/components/gas-dashboard/heatmap-chart"
import { EmergencyKeywords } from "@/components/gas-dashboard/emergency-keywords"
import { TopicDistributionChart } from "@/components/gas-dashboard/distribution-charts"
import { TopQuestionsList, TopDocsList, UnusedDocsList } from "@/components/gas-dashboard/docs-lists"
import { SavingsWidget } from "@/components/gas-dashboard/savings-widget"
import { ModeHistoryList } from "@/components/gas-dashboard/mode-history"
import { SmartRoutingKpiCards, type SmartRoutingStats } from "@/components/gas-dashboard/smart-routing-kpi-cards"
import { RequestQuotaCard, type RequestQuota } from "@/components/gas-dashboard/request-quota-card"

const YEARS = [2024, 2025, 2026]
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? "asahikawa-gas"

// /api/dashboard/stats のレスポンス型
type StatsResponse = {
  summary: {
    total_count: number
    escalated_count: number
    resolved_count: number
    escalation_rate: number
    resolution_rate: number
  }
  monthly_trend: { month: string; count: number }[]
  heatmap: { day_of_week: number; hour: number; count: number }[]
  top_questions: { content: string; count: number }[]
  top_docs: { title: string; source_url: string; reference_count: number; last_referenced_at: string }[]
  unused_docs: { id: string; title: string; url: string | null; source_url: string | null; updated_at: string | null; last_crawled_at: string | null }[]
  keyword_stats: { keyword: string; count: number }[]
  category_distribution: { category: string; count: number; percentage: number }[]
  mode_history: { mode: string; started_at: string; ended_at: string | null }[]
  daily_emergency_trend: { date: string; count: number }[]
  model_usage?: { flashLite: number; flash: number; flashLiteRate: number }
  cache_stats?: { hitCount: number; hitRate: number; savedTokens: number }
  cost_stats?: { totalCostJpy: number; avgCostPerChat: number; estimatedMonthly: number }
  input_method_stats?: { voice: number; text: number; voiceRate: number }
  request_quota?: RequestQuota
}

function mapToProps(res: StatsResponse, year: number, month: number): GasDashboardProps {
  const pad = String(month).padStart(2, "0")
  const emergencyKeywordCount = res.keyword_stats.reduce((s, k) => s + k.count, 0)

  return {
    clientId: CLIENT_ID,
    reportYear: year,
    reportMonth: String(month),
    monthlyStats: {
      totalConversations: res.summary.total_count,
      escalationRate: res.summary.escalation_rate,
      resolvedCount: res.summary.resolved_count,
      emergencyKeywordCount,
    },
    // YYYY-MM → YYYY/MM に変換（グラフ軸ラベル用）
    conversationTrend: res.monthly_trend.map((t) => ({
      month: t.month.replace("-", "/"),
      count: t.count,
    })),
    heatmapData: res.heatmap.map((h) => ({
      dayOfWeek: h.day_of_week,
      hour: h.hour,
      count: h.count,
    })),
    topQuestions: res.top_questions,
    topDocs: res.top_docs.map((d) => ({
      title: d.title ?? "(無題)",
      source: d.source_url ?? "",
      url: d.source_url ?? "#",
      referenceCount: d.reference_count,
      lastReferencedAt: d.last_referenced_at,
    })),
    unusedDocs: res.unused_docs.map((d) => ({
      title: d.title ?? "(無題)",
      source: d.url ?? d.source_url ?? "",
      url: d.url ?? d.source_url ?? "#",
      lastReferencedAt: d.updated_at ?? d.last_crawled_at,
    })),
    // keyword_stats（集計済み）を EmergencyKeywords コンポーネントの期待する形式に変換
    emergencyKeywords: res.keyword_stats.map((k) => ({
      keyword: k.keyword,
      count: k.count,
      date: `${year}-${pad}-01`,
    })),
    modeHistory: res.mode_history.map((m) => ({
      mode: m.mode === "emergency" ? "緊急" : m.mode === "notice" ? "注意報" : m.mode,
      startedAt: m.started_at,
      endedAt: m.ended_at,
    })),
    topicDistribution: res.category_distribution.map((c) => ({
      label: c.category,
      value: Math.round(c.percentage * 10) / 10,
    })),
    dailyEmergencyTrend: res.daily_emergency_trend,
  }
}

export default function DashboardPage() {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<GasDashboardProps | null>(null)
  const [rawStats, setRawStats] = useState<StatsResponse | null>(null)
  const [smartStats, setSmartStats] = useState<SmartRoutingStats | null>(null)
  const [requestQuota, setRequestQuota] = useState<RequestQuota | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientLabel, setClientLabel] = useState("旭川ガス")

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (me?.role === "quest") setClientLabel("クウェスト")
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/dashboard/stats?year=${selectedYear}&month=${selectedMonth}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as StatsResponse
        setData(mapToProps(json, selectedYear, selectedMonth))
        setRawStats(json)
        if (json.model_usage && json.cache_stats && json.cost_stats && json.input_method_stats) {
          setSmartStats({
            modelUsage: json.model_usage,
            cacheStats: json.cache_stats,
            costStats: json.cost_stats,
            inputMethodStats: json.input_method_stats,
          })
        } else {
          setSmartStats(null)
        }
        setRequestQuota(json.request_quota ?? null)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [selectedYear, selectedMonth])

  const csvEscape = (v: string | number): string => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const handleCsvDownload = () => {
    if (!data || !rawStats) return
    const s = rawStats
    const DOW = ["日", "月", "火", "水", "木", "金", "土"]

    // ダッシュボード上の表示順（上から下）に合わせて並べる
    const csvRows: (string | number)[][] = [
      ["項目", "値"],
      ["対象年月", `${selectedYear}年${selectedMonth}月`],
      [],
      ["■ サマリー"],
      ["総会話数", s.summary.total_count],
      ["電話誘導件数", s.summary.escalated_count],
      ["AI解決件数", s.summary.resolved_count],
      ["解決率(%)", s.summary.resolution_rate],
      ["電話誘導率(%)", s.summary.escalation_rate],
      ["緊急ワード検知件数", data.monthlyStats.emergencyKeywordCount],
    ]

    if (s.model_usage) {
      csvRows.push(
        [],
        ["■ モデル使用比率"],
        ["Flash-Lite件数", s.model_usage.flashLite],
        ["Flash件数", s.model_usage.flash],
        ["Flash-Lite比率(%)", s.model_usage.flashLiteRate],
      )
    }
    if (s.cache_stats) {
      csvRows.push(
        [],
        ["■ キャッシュ統計"],
        ["ヒット回数", s.cache_stats.hitCount],
        ["ヒット率(%)", s.cache_stats.hitRate],
        ["削減トークン数", s.cache_stats.savedTokens],
      )
    }
    if (s.cost_stats) {
      csvRows.push(
        [],
        ["■ APIコスト統計"],
        ["当月コスト(円)", s.cost_stats.totalCostJpy],
        ["1会話あたり平均コスト(円)", s.cost_stats.avgCostPerChat],
        ["月末推定コスト(円)", s.cost_stats.estimatedMonthly],
      )
    }
    if (s.request_quota !== undefined) {
      csvRows.push(
        [],
        ["■ 今月のリクエスト残量"],
        ["利用件数", s.request_quota.used],
        ["上限件数", s.request_quota.total],
        ["残量", s.request_quota.remaining],
        ["リセット日", s.request_quota.resetDate],
      )
    }
    if (s.input_method_stats) {
      csvRows.push(
        [],
        ["■ 音声 vs テキスト入力比率"],
        ["音声入力件数", s.input_method_stats.voice],
        ["テキスト入力件数", s.input_method_stats.text],
        ["音声入力比率(%)", s.input_method_stats.voiceRate],
      )
    }

    csvRows.push(
      [],
      ["■ 月別対話件数推移"],
      ["年月", "件数"],
      ...s.monthly_trend.map((t) => [t.month, t.count]),
      [],
      ["■ 時間帯・曜日別ヒートマップ"],
      ["曜日", "時間帯", "件数"],
      ...s.heatmap
        .slice()
        .sort((a, b) => a.day_of_week - b.day_of_week || a.hour - b.hour)
        .map((h) => [DOW[h.day_of_week] ?? String(h.day_of_week), `${h.hour}時`, h.count]),
      [],
      ["■ 緊急ワード検知件数（キーワード別）"],
      ["キーワード", "件数"],
      ...s.keyword_stats.map((k) => [k.keyword, k.count]),
      [],
      ["■ 緊急ワード検知件数（日別推移）"],
      ["日付", "件数"],
      ...s.daily_emergency_trend.map((d) => [d.date, d.count]),
      [],
      ["■ カテゴリ別問い合わせ分布"],
      ["カテゴリ", "件数", "割合(%)"],
      ...s.category_distribution.map((c) => [c.category, c.count, c.percentage]),
      [],
      ["■ よく聞かれた質問ランキング（上位20件）"],
      ["順位", "質問内容", "件数"],
      ...s.top_questions.map((q, i) => [i + 1, q.content, q.count]),
      [],
      ["■ 参照ドキュメントランキング"],
      ["順位", "タイトル", "URL", "参照回数", "最終参照日時"],
      ...s.top_docs.map((d, i) => [i + 1, d.title ?? "(無題)", d.source_url ?? "", d.reference_count, d.last_referenced_at]),
      [],
      ["■ 未参照ドキュメント一覧"],
      ["タイトル", "URL", "最終更新日時"],
      ...s.unused_docs.map((d) => [d.title ?? "(無題)", d.url ?? d.source_url ?? "", d.updated_at ?? d.last_crawled_at ?? ""]),
      [],
      ["■ モード履歴（注意報・緊急モード）"],
      ["モード", "開始日時", "終了日時"],
      ...s.mode_history.map((m) => [m.mode, m.started_at, m.ended_at ?? "継続中"]),
    )

    const csvContent = csvRows.map((row) => row.map(csvEscape).join(",")).join("\n")
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `AIチャットボット_${selectedYear}年${selectedMonth}月度.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">AIチャットボット運用ダッシュボード</h1>
            <p className="mt-1 text-sm text-muted-foreground">ガス会社向け月次レポート</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Building2 className="h-3 w-3" />
              {clientLabel}
            </Badge>
            <div className="flex items-center gap-1">
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="h-7 w-[80px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y.toString()}>{y}年</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="h-7 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m.toString()}>{m}月</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleCsvDownload}
              disabled={!data || !rawStats || loading}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="mt-6 flex items-center justify-center py-20 text-sm text-muted-foreground">
            読み込み中…
          </div>
        )}

        {/* エラー */}
        {!loading && error && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            データ取得に失敗しました: {error}
          </div>
        )}

        {/* Main Content */}
        {!loading && data && (
          <div className="mt-6 flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <GasKpiCards data={data} />
              <PhoneEscalationCard data={data} />
              {requestQuota !== null && <RequestQuotaCard quota={requestQuota} />}
            </div>

            {smartStats && (
              <SmartRoutingKpiCards stats={smartStats} />
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ConversationTrendChart data={data.conversationTrend} />
              <HeatmapChart data={data.heatmapData} />
            </div>

            <EmergencyKeywords data={data} />

            <TopicDistributionChart data={data.topicDistribution} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <TopQuestionsList questions={data.topQuestions} />
              <TopDocsList docs={data.topDocs} />
            </div>

            <UnusedDocsList docs={data.unusedDocs} />

            <SavingsWidget resolvedCount={data.monthlyStats.resolvedCount} />

            <ModeHistoryList history={data.modeHistory} />
          </div>
        )}

        <footer className="mt-8 border-t border-border/40 pt-4 pb-6">
          <p className="text-center text-xs text-muted-foreground">
            {`${selectedYear}年${selectedMonth}月度 月次運用レポート | ${clientLabel} AIチャットボット | CONFIDENTIAL`}
          </p>
      </footer>
    </div>
  )
}

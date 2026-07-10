"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { AlertTriangle } from "lucide-react"
import type { GasDashboardProps } from "@/lib/gas-mock-data"
import { aggregateEmergencyByKeyword } from "@/lib/gas-mock-data"

interface EmergencyKeywordsProps {
  data: GasDashboardProps
}

export function EmergencyKeywords({ data }: EmergencyKeywordsProps) {
  const aggregated = aggregateEmergencyByKeyword(data.emergencyKeywords)
  const totalCount = data.monthlyStats.emergencyKeywordCount

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border/60 bg-blue-500/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground tracking-wide">今月の緊急ワード検知件数</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-blue-600 tracking-tight">{totalCount.toLocaleString('ja-JP')}</span>
                <span className="text-sm font-medium text-muted-foreground">件</span>
              </div>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-2.5">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground tracking-wide">ワード別内訳</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {aggregated.map((item) => (
              <Badge key={item.keyword} variant="secondary" className="gap-1.5 px-3 py-1.5">
                <span className="text-xs">{item.keyword}</span>
                <span className="font-bold text-blue-600">{item.total}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground tracking-wide">日別推移</CardTitle>
          <p className="text-xs text-muted-foreground">{data.reportYear}年{data.reportMonth}月の緊急ワード検知件数</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={data.dailyEmergencyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} interval={Math.max(0, Math.floor(data.dailyEmergencyTrend.length / 8) - 1)} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "12px", color: "var(--color-foreground)" }}
                  formatter={(value) => [`${Number(value)}件`, "検知件数"]}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

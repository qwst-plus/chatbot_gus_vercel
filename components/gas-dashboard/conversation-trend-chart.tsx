"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { ConversationTrend } from "@/lib/gas-mock-data"

interface ConversationTrendChartProps {
  data: ConversationTrend[]
}

export function ConversationTrendChart({ data }: ConversationTrendChartProps) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground tracking-wide">月別対話件数の推移</CardTitle>
        <p className="text-xs text-muted-foreground">過去6ヶ月の対話件数トレンド</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="fillConversation" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "12px", color: "var(--color-foreground)" }}
                formatter={(value) => [`${Number(value).toLocaleString('ja-JP')}件`, "対話数"]}
              />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#fillConversation)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

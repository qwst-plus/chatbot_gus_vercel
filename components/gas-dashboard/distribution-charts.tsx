"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import type { TopicDistribution } from "@/lib/gas-mock-data"

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-muted-foreground)",
]

interface TopicDistributionChartProps {
  data: TopicDistribution[]
}

export function TopicDistributionChart({ data }: TopicDistributionChartProps) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value }))

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground tracking-wide">問い合わせトピック分布</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "12px", color: "var(--color-foreground)" }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, ""]}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px" }}
                formatter={(value) => {
                  const item = chartData.find((d) => d.name === value)
                  return <span className="text-foreground">{value} ({item?.value}%)</span>
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

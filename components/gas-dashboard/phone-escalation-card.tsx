"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Phone, PhoneForwarded } from "lucide-react"
import type { GasDashboardProps } from "@/lib/gas-mock-data"
import { calculateEscalationCount } from "@/lib/gas-mock-data"

interface PhoneEscalationCardProps {
  data: GasDashboardProps
}

export function PhoneEscalationCard({ data }: PhoneEscalationCardProps) {
  const escalationCount = calculateEscalationCount(data.monthlyStats)

  return (
    <Card className="border-border/60">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-muted-foreground tracking-wide">電話誘導率</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-foreground tracking-tight">{data.monthlyStats.escalationRate}</span>
              <span className="text-base font-medium text-muted-foreground">%</span>
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-3">
            <PhoneForwarded className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            今月の誘導件数：<span className="font-semibold text-foreground">{escalationCount.toLocaleString('ja-JP')}件</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Clock, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import type { TopDoc, UnusedDoc, TopQuestion } from "@/lib/gas-mock-data"

interface TopQuestionsListProps {
  questions: TopQuestion[]
}

export function TopQuestionsList({ questions }: TopQuestionsListProps) {
  const [open, setOpen] = useState(false)
  const items = questions.slice(0, 8)

  return (
    <Card className="border-border/60">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold text-foreground tracking-wide">よくある質問 TOP8</CardTitle>
              {items.length > 0 && (
                <Badge variant="secondary" className="text-xs">{items.length}件</Badge>
              )}
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">クリックで展開</p>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="pt-0">
          <div className="flex flex-col gap-2">
            {items.map((q, index) => (
              <div key={index} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{index + 1}.</span>
                  <span className="text-sm text-foreground truncate">{q.content}</span>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0 ml-2">{q.count.toLocaleString('ja-JP')}件</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

interface TopDocsListProps {
  docs: TopDoc[]
}

export function TopDocsList({ docs }: TopDocsListProps) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="border-border/60">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold text-foreground tracking-wide">よく参照されるドキュメント</CardTitle>
              {docs.length > 0 && (
                <Badge variant="secondary" className="text-xs">{docs.length}件</Badge>
              )}
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">クリックで展開</p>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="pt-0">
          <div className="flex flex-col gap-2">
            {docs.map((doc, index) => (
              <a key={index} href={doc.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border/40 bg-card px-3 py-2 transition-colors hover:bg-muted/50 min-w-0">
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{doc.title}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">{doc.source}</span>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{doc.referenceCount.toLocaleString('ja-JP')}回参照</Badge>
              </a>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

interface UnusedDocsListProps {
  docs: UnusedDoc[]
}

export function UnusedDocsList({ docs }: UnusedDocsListProps) {
  const [open, setOpen] = useState(false)

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "参照なし"
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <Card className="border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold text-foreground tracking-wide">未使用ドキュメント</CardTitle>
              {docs.length > 0 && (
                <Badge variant="secondary" className="text-xs">{docs.length}件</Badge>
              )}
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">長期間参照されていないドキュメント（クリックで展開）</p>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="pt-0">
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">未使用ドキュメントはありません</p>
          ) : (
            <div className="flex flex-col gap-2">
              {docs.map((doc, index) => (
                <a key={index} href={doc.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/50 min-w-0">
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm text-foreground flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{doc.title}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">{doc.source}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">最終参照: {formatDate(doc.lastReferencedAt)}</span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

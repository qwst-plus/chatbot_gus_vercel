// app/admin/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = {
  id: string;
  content: string | null;
  created_at: string | null;
};

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function load() {
    setLoading(true);
    setErrorMsg("");

    try {
      const supabase = getSupabaseClient();

      // 既存仕様：rag_chunks から 50件
      const base = supabase
        .from("rag_chunks")
        .select("id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      const { data, error } = q
        ? await base.ilike("content", `%${q}%`)
        : await base;

      if (error) {
        console.error(error);
        setRows([]);
        setErrorMsg(error.message ?? "読み込みに失敗しました。");
        return;
      }

      setRows(data || []);
    } catch (e: unknown) {
      console.error(e);
      setRows([]);
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const init = async () => {
      await load();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Admin</div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">管理（RAGデータ）</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
            rows: {rows.length}
          </span>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
            table: rag_chunks
          </span>
        </div>
      </div>

        {/* Search card */}
        <section className="mb-6 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-foreground">検索</div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                placeholder="テキスト検索（content）"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") load();
                }}
              />
              <div className="mt-2 text-xs text-muted-foreground">
                Enterで検索 / 50件まで表示
              </div>
            </div>

            <Button onClick={load} disabled={loading}>
              {loading ? "読み込み中…" : "検索 / 更新"}
            </Button>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
              {errorMsg}
            </div>
          )}
        </section>

        {/* List card */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">最新データ</div>
            <div className="text-xs text-muted-foreground">
              {loading ? "更新中…" : "最新順"}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            {rows.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                データがありません。
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rows.map((r) => (
                  <div key={r.id} className="p-4 hover:bg-accent/50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-mono">{r.id}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.created_at ?? "—"}
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-foreground">
                      {r.content ?? "（content が空です）"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
    </div>
  );
}

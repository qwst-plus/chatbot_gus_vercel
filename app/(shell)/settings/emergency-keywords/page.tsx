"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

export const dynamic = "force-dynamic";

export default function EmergencyKeywordsSettingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [keywords, setKeywords] = useState<string[]>([]);
  const [defaultKeywords, setDefaultKeywords] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const me = await res.json();
        if (me.role !== "quest") {
          router.push("/dashboard");
          return;
        }
        setAllowed(true);
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/settings/emergency-keywords");
        if (res.ok) {
          const data = await res.json();
          setKeywords(data.keywords);
          setDefaultKeywords(data.defaultKeywords);
          setIsDefault(data.isDefault);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [allowed]);

  function addKeyword() {
    const kw = newKeyword.trim();
    if (!kw || keywords.includes(kw)) return;
    setKeywords((k) => [...k, kw]);
    setNewKeyword("");
  }

  function removeKeyword(kw: string) {
    setKeywords((k) => k.filter((x) => x !== kw));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/emergency-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "保存に失敗しました" });
        return;
      }
      setIsDefault(false);
      setMessage({ type: "ok", text: "保存しました" });
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleResetToDefault() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/emergency-keywords", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "リセットに失敗しました" });
        return;
      }
      setKeywords(defaultKeywords);
      setIsDefault(true);
      setMessage({ type: "ok", text: "デフォルトに戻しました" });
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return <div className="mx-auto w-full max-w-lg px-4 py-8 text-sm text-muted-foreground">確認中…</div>;
  }
  if (!allowed) return null;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">緊急ワード設定</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        質問文にこのキーワードが含まれると緊急対応として扱われ、運用ダッシュボードの
        「緊急ワード検知件数」に集計されます。
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <>
          {!isDefault && (
            <p className="mb-2 text-xs font-medium text-amber-600">カスタム設定が適用されています（デフォルトから変更済み）</p>
          )}

          <div className="mb-4 flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground"
              >
                {kw}
                <button type="button" onClick={() => removeKeyword(kw)} aria-label={`${kw}を削除`}>
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              placeholder="新しいキーワードを入力してEnter"
            />
            <Button type="button" variant="outline" onClick={addKeyword} disabled={!newKeyword.trim()}>
              追加
            </Button>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={saving || keywords.length === 0}>
              {saving ? "保存中…" : "保存"}
            </Button>
            <Button variant="outline" onClick={handleResetToDefault} disabled={saving}>
              デフォルトに戻す
            </Button>
          </div>

          {message && (
            <p className={`mt-3 text-sm ${message.type === "ok" ? "text-emerald-600" : "text-destructive"}`}>
              {message.text}
            </p>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            ※ 保存すると次回以降のチャット応答から即座に反映されます。
          </p>
        </>
      )}
    </div>
  );
}

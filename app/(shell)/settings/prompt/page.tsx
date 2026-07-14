"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function PromptSettingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [template, setTemplate] = useState("");
  const [defaultTemplate, setDefaultTemplate] = useState("");
  const [isDefault, setIsDefault] = useState(true);
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
        const res = await fetch("/api/settings/prompt");
        if (res.ok) {
          const data = await res.json();
          setTemplate(data.template);
          setDefaultTemplate(data.defaultTemplate);
          setIsDefault(data.isDefault);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [allowed]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
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
      const res = await fetch("/api/settings/prompt", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "リセットに失敗しました" });
        return;
      }
      setTemplate(defaultTemplate);
      setIsDefault(true);
      setMessage({ type: "ok", text: "デフォルトに戻しました" });
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return <div className="mx-auto w-full max-w-2xl px-4 py-8 text-sm text-muted-foreground">確認中…</div>;
  }
  if (!allowed) return null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">プロンプト設定</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        チャット回答生成の基本システムプロンプトを編集できます。
        <span className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{"{{clientId}}"}</span>
        <span className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{"{{phone}}"}</span>
        <span className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{"{{businessHours}}"}</span>
        は送信時に実際のクライアント設定値に置き換わります。
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <>
          {!isDefault && (
            <p className="mb-2 text-xs font-medium text-amber-600">カスタム設定が適用されています（デフォルトから変更済み）</p>
          )}
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={16}
            className="w-full rounded-xl border border-border bg-card p-4 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={saving || !template.trim()}>
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

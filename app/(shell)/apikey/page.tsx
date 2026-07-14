// frontend/app/(shell)/apikey/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

type KeyStatus = {
  hasKey: boolean;
  maskedKey?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export default function ApiKeyPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [apiKey, setApiKey] = useState("");
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
      setLoadingStatus(true);
      try {
        const res = await fetch("/api/settings/gemini-key");
        if (res.ok) setStatus(await res.json());
      } finally {
        setLoadingStatus(false);
      }
    })();
  }, [allowed]);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/gemini-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "保存に失敗しました" });
        return;
      }
      setMessage({ type: "ok", text: "保存しました" });
      setApiKey("");
      setStatus({ hasKey: true, maskedKey: data.maskedKey, updatedAt: new Date().toISOString() });
    } catch (e: unknown) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : String(e) });
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
      <h1 className="mb-2 text-2xl font-bold text-foreground">API設定</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        チャット回答生成に使用するGemini API Keyを保存します。
      </p>

      <div className="mb-6 rounded-xl border border-border bg-card p-4 text-sm">
        {loadingStatus ? (
          <span className="text-muted-foreground">読み込み中…</span>
        ) : status?.hasKey ? (
          <>
            <div className="font-medium text-foreground">設定済み：{status.maskedKey}</div>
            {status.updatedAt && (
              <div className="mt-1 text-xs text-muted-foreground">
                最終更新：{new Date(status.updatedAt).toLocaleString("ja-JP")}
                {status.updatedBy ? `（${status.updatedBy}）` : ""}
              </div>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">未設定です</span>
        )}
      </div>

      <label className="mb-2 block text-sm text-foreground">Gemini API Key</label>
      <Input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="AIza..."
      />

      <Button className="mt-4" onClick={handleSave} disabled={saving || !apiKey.trim()}>
        {saving ? "保存中…" : "保存"}
      </Button>

      {message && (
        <p className={`mt-3 text-sm ${message.type === "ok" ? "text-emerald-600" : "text-destructive"}`}>
          {message.text}
        </p>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        ※ ここで保存した値はSupabaseに暗号化保存されるのみです。実際のチャット応答には反映されません
        （引き続きRender/Vercelの環境変数 GEMINI_API_KEY が使われます）。
        実際にキーを切り替える場合は、環境変数側も別途更新してください。
      </p>
    </div>
  );
}

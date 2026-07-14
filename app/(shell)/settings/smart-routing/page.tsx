"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function SmartRoutingSettingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [threshold, setThreshold] = useState(0.5);
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
        const res = await fetch("/api/settings/smart-routing");
        if (res.ok) {
          const data = await res.json();
          setThreshold(data.threshold);
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
      const res = await fetch("/api/settings/smart-routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "保存に失敗しました" });
        return;
      }
      setMessage({ type: "ok", text: "保存しました" });
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
      <h1 className="mb-2 text-2xl font-bold text-foreground">スマートルーティング設定</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        質問の複雑度スコアがこのしきい値を超えるとGemini Flash、以下ではFlash-Liteで回答します。
        しきい値を下げるほどFlashの使用が増え、回答品質重視・コスト増の方向に振れます。
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm font-medium text-foreground">しきい値</span>
              <span className="text-2xl font-bold tracking-tight text-foreground">{threshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>0.0（常にFlash寄り）</span>
              <span>1.0（常にFlash-Lite寄り）</span>
            </div>
          </div>

          <Button className="mt-4" onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>

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

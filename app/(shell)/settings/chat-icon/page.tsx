"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

export default function ChatIconSettingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [iconUrl, setIconUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        const res = await fetch("/api/settings/chat-icon");
        if (res.ok) {
          const data = await res.json();
          setIconUrl(data.iconUrl);
          setTitle(data.title);
          setIsDefault(data.isDefault);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [allowed]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPreviewFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const form = new FormData();
      if (previewFile) form.append("icon", previewFile);
      form.append("title", title);
      const res = await fetch("/api/settings/chat-icon", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "保存に失敗しました" });
        return;
      }
      setIconUrl(data.iconUrl);
      setTitle(data.title);
      setIsDefault(data.isDefault);
      setPreviewFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      const res = await fetch("/api/settings/chat-icon", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error ?? "リセットに失敗しました" });
        return;
      }
      const refreshed = await fetch("/api/settings/chat-icon").then((r) => r.json());
      setIconUrl(refreshed.iconUrl);
      setTitle(refreshed.title);
      setIsDefault(refreshed.isDefault);
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
      <h1 className="mb-2 text-2xl font-bold text-foreground">チャットアイコン設定</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        旭川ガス公式サイトに埋め込まれるチャットウィジェットのアイコン画像・タイトルを変更できます。
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <>
          {!isDefault && (
            <p className="mb-2 text-xs font-medium text-amber-600">カスタム設定が適用されています（デフォルトから変更済み）</p>
          )}

          <div className="mb-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- プレビュー画像は外部URL/ローカルファイルどちらもあり得るため */}
            <img
              src={previewUrl ?? iconUrl}
              alt="アイコンプレビュー"
              width={56}
              height={56}
              className="rounded-full border border-border object-cover"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="text-sm text-muted-foreground"
            />
          </div>

          <label className="mb-2 block text-sm text-foreground">タイトル</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="旭川ガス　お客さまサポート" />

          <div className="mt-4 flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
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
            ※ 保存すると本番の埋め込みウィジェットに即座に反映されます（画像はPNG/JPEG/WebP、2MBまで）。
          </p>
        </>
      )}
    </div>
  );
}

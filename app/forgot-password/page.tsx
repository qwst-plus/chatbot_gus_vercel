"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "送信に失敗しました");
        return;
      }
      setMessage(data.message ?? "パスワード再設定のご案内を送信しました。");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="パスワードを忘れた場合"
      description="登録済みのメールアドレスを入力してください。再設定用のリンクをお送りします。"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
        />

        {message && <div className="text-sm text-emerald-600">{message}</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}

        <Button type="submit" disabled={loading || !email} className="w-full">
          {loading ? "送信中…" : "再設定リンクを送信"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
          ログイン画面に戻る
        </Link>
      </div>
    </AuthCard>
  );
}

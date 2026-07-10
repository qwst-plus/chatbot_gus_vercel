"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "ログインに失敗しました");
        return;
      }
      const from = searchParams.get("from");
      router.push(from && from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="ログイン" description="メールアドレスとパスワードを入力してください。">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
        />

        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
        />

        {error && <div className="text-sm text-destructive">{error}</div>}

        <Button type="submit" disabled={loading || !password || !email} className="w-full">
          {loading ? "確認中…" : "ログイン"}
        </Button>
      </form>

      <div className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
          パスワードをお忘れですか？
        </Link>
      </div>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

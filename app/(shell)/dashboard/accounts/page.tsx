"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Account = { id: string; email: string; name: string | null };

const MAX_ACCOUNTS = 3;

export default function AccountsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const me = await res.json();
        if (me.role !== "asahikawa-gas" || !me.isAdmin) {
          router.push("/dashboard");
          return;
        }
        setAllowed(true);
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  async function loadAccounts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "読み込みに失敗しました");
        return;
      }
      setAccounts(data.accounts ?? []);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (allowed) loadAccounts();
  }, [allowed]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "作成に失敗しました");
        return;
      }
      setEmail("");
      setName("");
      setPassword("");
      await loadAccounts();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(account: Account) {
    setEditingId(account.id);
    setEditName(account.name ?? "");
    setEditEmail(account.email);
    setEditPassword("");
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, string> = { name: editName, email: editEmail };
      if (editPassword) payload.password = editPassword;

      const res = await fetch(`/api/admin/accounts/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "更新に失敗しました");
        return;
      }
      setEditingId(null);
      await loadAccounts();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このアカウントを削除しますか？")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "削除に失敗しました");
        return;
      }
      await loadAccounts();
    } catch {
      setError("通信エラーが発生しました");
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground">確認中…</div>
      </div>
    );
  }
  if (!allowed) return null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6">
        <div className="text-xs text-muted-foreground">Admin</div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">アカウント管理</h1>
      </div>

        <p className="mb-4 text-sm text-muted-foreground">
          アカウント数：{accounts.length + 1} / {MAX_ACCOUNTS}名（管理者自身を含む）
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form
          onSubmit={handleCreate}
          className="mb-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="text-sm font-medium text-foreground">新規アカウント作成</div>
          <Input placeholder="名前" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="パスワード（8文字以上）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            disabled={submitting || !email || !name || !password || accounts.length + 1 >= MAX_ACCOUNTS}
          >
            {submitting ? "作成中…" : "作成"}
          </Button>
          {accounts.length + 1 >= MAX_ACCOUNTS && (
            <div className="text-xs text-amber-600">
              アカウント数の上限（{MAX_ACCOUNTS}名）に達しています
            </div>
          )}
        </form>

        <div className="mb-3 text-sm font-medium text-foreground">登録済みアカウント</div>
        {loading ? (
          <div className="text-sm text-muted-foreground">読み込み中…</div>
        ) : accounts.length === 0 ? (
          <div className="text-sm text-muted-foreground">まだアカウントがありません</div>
        ) : (
          <div className="flex flex-col gap-3">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                {editingId === account.id ? (
                  <form onSubmit={handleUpdate} className="flex flex-col gap-3">
                    <Input
                      placeholder="名前"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <Input
                      type="email"
                      placeholder="メールアドレス"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                    <Input
                      type="password"
                      placeholder="新しいパスワード（変更する場合のみ）"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button type="submit" disabled={submitting} size="sm">
                        保存
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {account.name || "(名前未設定)"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{account.email}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(account)}>
                        編集
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(account.id)}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

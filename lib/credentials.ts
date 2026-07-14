// lib/credentials.ts
// パスワードハッシュの検証・更新、パスワードリセットトークン、
// asahikawa-gas ロールの管理者によるアカウント管理（作成/編集/削除）。
// bcryptjs / node:crypto / Supabase の service role キーを使うため Node.js ランタイム専用。
// Edge Runtime で動く middleware.ts からは絶対に import しないこと（lib/auth.ts を参照）。
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import type { Role } from "@/lib/auth";

export type AuthUser = {
  id: string;
  role: Role;
  email: string;
  name: string | null;
  is_admin: boolean;
  password_hash: string;
  reset_token_hash: string | null;
  reset_token_expires_at: string | null;
};

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30分

// asahikawa-gas ロールで管理できるアカウント総数の上限（管理者自身を含む）
export const ASAHIKAWA_GAS_MAX_ACCOUNTS = 3;

const SELECT_COLUMNS =
  "id, role, email, name, is_admin, password_hash, reset_token_hash, reset_token_expires_at";

export function generateSessionToken(): string {
  return randomBytes(16).toString("hex");
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const { data } = await supabaseAdmin
    .from("auth_users")
    .select(SELECT_COLUMNS)
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return (data as AuthUser | null) ?? null;
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const { data } = await supabaseAdmin
    .from("auth_users")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as AuthUser | null) ?? null;
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** セッションのuserIdが asahikawa-gas の管理者か確認する（毎回DBの最新状態を見る） */
export async function requireAsahikawaGasAdmin(userId: string): Promise<AuthUser | null> {
  const user = await getUserById(userId);
  if (!user || user.role !== "asahikawa-gas" || !user.is_admin) return null;
  return user;
}

/** セッションのuserIdが quest（クウェスト社内アカウント）か確認する（毎回DBの最新状態を見る） */
export async function requireQuest(userId: string): Promise<AuthUser | null> {
  const user = await getUserById(userId);
  if (!user || user.role !== "quest") return null;
  return user;
}

/** 管理者が管理する asahikawa-gas の一般アカウント一覧（管理者自身は含まない） */
export async function listManagedAccounts(): Promise<
  Pick<AuthUser, "id" | "email" | "name">[]
> {
  const { data } = await supabaseAdmin
    .from("auth_users")
    .select("id, email, name")
    .eq("role", "asahikawa-gas")
    .eq("is_admin", false)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export type MutationResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string };

/** asahikawa-gas に新しいアカウントを作成する（管理者を含め合計 ASAHIKAWA_GAS_MAX_ACCOUNTS 名まで） */
export async function createManagedAccount(
  email: string,
  name: string,
  password: string
): Promise<MutationResult<{ id: string }>> {
  const { count } = await supabaseAdmin
    .from("auth_users")
    .select("id", { count: "exact", head: true })
    .eq("role", "asahikawa-gas");

  if ((count ?? 0) >= ASAHIKAWA_GAS_MAX_ACCOUNTS) {
    return {
      ok: false,
      error: `アカウント数の上限（${ASAHIKAWA_GAS_MAX_ACCOUNTS}名）に達しています`,
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await getUserByEmail(normalizedEmail)) {
    return { ok: false, error: "このメールアドレスは既に使用されています" };
  }

  const passwordHash = await hashPassword(password);
  const { data, error } = await supabaseAdmin
    .from("auth_users")
    .insert({
      role: "asahikawa-gas",
      email: normalizedEmail,
      name,
      is_admin: false,
      password_hash: passwordHash,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "作成に失敗しました" };
  }
  return { ok: true, id: data.id };
}

/** 管理者以外の asahikawa-gas アカウントを更新する */
export async function updateManagedAccount(
  id: string,
  updates: { email?: string; name?: string; password?: string }
): Promise<MutationResult> {
  const target = await getUserById(id);
  if (!target || target.role !== "asahikawa-gas" || target.is_admin) {
    return { ok: false, error: "対象のアカウントが見つかりません" };
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.email) patch.email = updates.email.trim().toLowerCase();
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.password) patch.password_hash = await hashPassword(updates.password);

  const { error } = await supabaseAdmin.from("auth_users").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 管理者以外の asahikawa-gas アカウントを削除する */
export async function deleteManagedAccount(id: string): Promise<MutationResult> {
  const target = await getUserById(id);
  if (!target || target.role !== "asahikawa-gas" || target.is_admin) {
    return { ok: false, error: "対象のアカウントが見つかりません" };
  }
  const { error } = await supabaseAdmin.from("auth_users").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 生のリセットトークンを発行し、そのハッシュと有効期限をDBに保存する */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

  await supabaseAdmin
    .from("auth_users")
    .update({ reset_token_hash: tokenHash, reset_token_expires_at: expiresAt })
    .eq("id", userId);

  return rawToken;
}

/** リセットトークンを検証し、有効なら対象のアカウントを返す */
export async function verifyPasswordResetToken(rawToken: string): Promise<AuthUser | null> {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { data } = await supabaseAdmin
    .from("auth_users")
    .select(SELECT_COLUMNS)
    .eq("reset_token_hash", tokenHash)
    .maybeSingle();

  const user = data as AuthUser | null;
  if (!user || !user.reset_token_expires_at) return null;
  if (new Date(user.reset_token_expires_at).getTime() < Date.now()) return null;
  return user;
}

/** パスワードを更新し、リセットトークンを無効化する */
export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await supabaseAdmin
    .from("auth_users")
    .update({
      password_hash: passwordHash,
      reset_token_hash: null,
      reset_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

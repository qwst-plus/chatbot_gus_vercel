// lib/auth.ts
// 簡易パスワードログイン用のセッション署名・検証ユーティリティ
// Web Crypto API（crypto.subtle）のみを使用し、Edge/Node どちらのランタイムでも動作する。
// middleware.ts（常にEdge Runtimeで動く）から読み込まれるため、Node専用モジュール
// （node:crypto, bcryptjs, Supabaseクライアント等）は絶対に import しないこと。
// パスワードハッシュ・リセットトークン・同時ログイン排他制御は lib/credentials.ts に分離している。

export type Role = "quest" | "asahikawa-gas";

export type Session = {
  role: Role;
  userId: string;
  sessionToken: string;
};

const encoder = new TextEncoder();

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is missing");
  return secret;
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bufToHex(sig);
}

/** ログイン成功時に発行するCookie値（role.userId.sessionToken.signature）を生成 */
export async function createSessionValue(session: Session): Promise<string> {
  const payload = `${session.role}.${session.userId}.${session.sessionToken}`;
  const sig = await hmac(payload, getSecret());
  return `${payload}.${sig}`;
}

/** Cookie値を検証し、有効ならセッション情報を返す。無効・改ざんされていればnull */
export async function verifySessionValue(
  value: string | undefined | null
): Promise<Session | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [role, userId, sessionToken, sig] = parts;
  if (role !== "quest" && role !== "asahikawa-gas") return null;
  if (!userId || !sessionToken || !sig) return null;

  const payload = `${role}.${userId}.${sessionToken}`;
  const expected = await hmac(payload, getSecret());
  return sig === expected ? { role, userId, sessionToken } : null;
}

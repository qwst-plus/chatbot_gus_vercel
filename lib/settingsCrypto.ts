// lib/settingsCrypto.ts
// app_settings テーブルに保存する秘密値（APIキー等）のAES-256-GCM暗号化・復号。
// SETTINGS_ENCRYPTION_KEY（32byte鍵をbase64化した文字列）が必要。Node.js専用。
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
  const b64 = (process.env.SETTINGS_ENCRYPTION_KEY ?? "").trim();
  if (!b64) throw new Error("SETTINGS_ENCRYPTION_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64)");
  }
  return key;
}

// 保存形式: base64(iv[12] + authTag[16] + ciphertext)
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(stored: string): string {
  const raw = Buffer.from(stored, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// 表示用マスク（例: AIzaSyABCD1234 → AIza...1234）
export function maskSecret(plain: string): string {
  if (plain.length <= 8) return "****";
  return `${plain.slice(0, 4)}...${plain.slice(-4)}`;
}

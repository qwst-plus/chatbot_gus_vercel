// lib/appSettings.ts
// app_settings汎用キーバリュー設定の読み書き（平文。秘密値はlib/settingsCrypto.tsで暗号化して使うこと）
import { supabaseAdmin } from "@/lib/supabase";

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string, updatedBy: string): Promise<void> {
  await supabaseAdmin.from("app_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  });
}

// lib/emergencyKeywords.ts
// 緊急ワード（クライアント設定ファイルのemergencyKeywordsの初期値を上書き可能にする）
// クウェスト社内アカウントが設定画面から編集する。未設定時はクライアント設定ファイルの値を使う。

const SETTING_KEY = "emergency_keywords";

// lib/appSettings.ts はSupabaseクライアントをモジュール読み込み時に初期化するため、
// 動的importで遅延読み込みにする（他ファイルからの単体テスト時の副作用を避けるため）
export async function getEmergencyKeywords(defaultKeywords: string[]): Promise<string[]> {
  const { getSetting } = await import("@/lib/appSettings");
  const raw = await getSetting(SETTING_KEY);
  if (!raw) return defaultKeywords;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string") && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // 壊れたJSONの場合はデフォルトにフォールバック
  }
  return defaultKeywords;
}

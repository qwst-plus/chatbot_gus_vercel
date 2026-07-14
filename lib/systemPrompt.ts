// lib/systemPrompt.ts
// システムプロンプトの基本テンプレート（クウェスト社内アカウントが設定画面から編集可能）
// {{clientId}} / {{phone}} / {{businessHours}} はチャット応答時にクライアント設定の値で置換される

export const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `あなたは{{clientId}}のカスタマーサポートAIです。
提供された資料をもとに回答してください。
資料に根拠がない場合は「お電話でご確認ください」と案内してください。
回答の末尾には「この回答は解決の参考になりましたか？」を記載してください。
お電話での案内が必要な場合：{{phone}}（{{businessHours}}）

【回答形式の注意】
- マークダウン記法（##、**、---、|テーブル|など）は使わないでください
- 絵文字は使わないでください
- 箇条書きは「・」を使ってください
- 自然な日本語の文章で回答してください`;

const SETTING_KEY = "system_prompt_template";

// lib/appSettings.ts はSupabaseクライアントをモジュール読み込み時に初期化するため、
// 動的importで遅延読み込みにする（他ファイルからの単体テスト時の副作用を避けるため）
export async function getSystemPromptTemplate(): Promise<string> {
  const { getSetting } = await import("@/lib/appSettings");
  const raw = await getSetting(SETTING_KEY);
  return raw && raw.trim() ? raw : DEFAULT_SYSTEM_PROMPT_TEMPLATE;
}

export function renderSystemPromptTemplate(
  template: string,
  vars: { clientId: string; phone: string; businessHours: string }
): string {
  return template
    .replaceAll("{{clientId}}", vars.clientId)
    .replaceAll("{{phone}}", vars.phone)
    .replaceAll("{{businessHours}}", vars.businessHours);
}

// lib/chatWidgetBranding.ts
// チャットウィジェット（/embed・ChatWidget.tsx）のアイコン画像・タイトル文字。
// クウェスト社内アカウントが設定画面から変更できる。未設定時はデフォルトを使う。
// /embed は無認証の公開ページのため、ここで返す値は公開情報として扱うこと。

export const DEFAULT_CHAT_ICON_URL = "/asahikawagus_chatoboto.png";
export const DEFAULT_CHAT_WIDGET_TITLE = "旭川ガス　お客さまサポート";

const ICON_URL_KEY = "chat_icon_url";
const TITLE_KEY = "chat_widget_title";

export type ChatWidgetBranding = {
  iconUrl: string;
  title: string;
  isDefault: boolean;
};

// lib/appSettings.ts はSupabaseクライアントをモジュール読み込み時に初期化するため、
// 動的importで遅延読み込みにする
export async function getChatWidgetBranding(): Promise<ChatWidgetBranding> {
  const { getSetting } = await import("@/lib/appSettings");
  const [iconUrl, title] = await Promise.all([
    getSetting(ICON_URL_KEY),
    getSetting(TITLE_KEY),
  ]);
  return {
    iconUrl: iconUrl || DEFAULT_CHAT_ICON_URL,
    title: title || DEFAULT_CHAT_WIDGET_TITLE,
    isDefault: !iconUrl && !title,
  };
}

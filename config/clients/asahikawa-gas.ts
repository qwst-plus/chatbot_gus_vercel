import type { ClientConfig } from "@/types/log";

// 旭川ガス（asahikawa-gas.co.jp）向け設定
export const clientConfig: ClientConfig = {
  clientId: "asahikawa-gas",
  categoryPrompt: `
以下のテキストは「normal」「emergency」「both」のどれですか？
1単語のみで答えてください。

emergency = 地震・ガス漏れ・異臭・避難・緊急停止・一酸化炭素中毒・爆発に関する内容
normal    = それ以外の通常案内（料金・手続き・ガス機器・開閉栓など）
  `,
  emergencyKeywords: ["ガス漏れ", "異臭", "一酸化炭素", "爆発", "火災", "緊急停止"],
  topicKeywords: [
    { label: "料金・請求",    keywords: ["料金", "請求", "ガス代", "単価", "費用", "値段", "単位料金", "料金表", "原料費"] },
    { label: "支払い",        keywords: ["支払い", "振込", "口座", "クレジット", "引き落とし", "納付", "払い"] },
    { label: "手続き・契約",  keywords: ["開栓", "閉栓", "手続き", "申込", "契約", "引越", "転居", "解約", "変更", "登録"] },
    { label: "ガス機器",      keywords: ["給湯器", "コンロ", "暖房", "ストーブ", "機器", "点検", "修理", "交換", "ガス器具"] },
    { label: "供給・工事",    keywords: ["工事", "配管", "供給", "設備", "メーター", "導管"] },
    { label: "省エネ・節約",  keywords: ["省エネ", "節約", "節ガス", "エコ", "削減"] },
  ],
  phoneNumbers: {
    normal: "0166-23-4151（旭川市）/ 011-382-4211（江別地区）",
    emergency: "0166-45-2800（旭川市）/ 011-385-7913（江別市）",
  },
  businessHours: "平日 9:00〜17:00",
  formUrls: [
    { label: "開栓・閉栓のお申込み（旭川地区）", url: "https://asahikawa-gas.co.jp/?page_id=590" },
    { label: "開栓・閉栓のお申込み（江別地区）", url: "https://asahikawa-gas.co.jp/?page_id=665" },
    { label: "お問い合わせフォーム",              url: "https://asahikawa-gas.co.jp/?page_id=210" },
  ],
};

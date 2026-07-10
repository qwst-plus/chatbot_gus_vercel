// lib/scenarios.ts
// シナリオエンジン: 型定義 + シナリオデータ

export type ScenarioNodeType = "choice" | "message" | "end";

export type ScenarioChoice = {
  label: string;
  nextNodeId: string;
};

export type FormUrl = {
  label: string;
  url: string;
};

export type ScenarioNode = {
  id: string;
  type: ScenarioNodeType;
  content: string;
  /** RAG呼び出し時に渡す文脈テキスト */
  context: string;
  /** type="choice" のとき表示する選択肢 */
  choices?: ScenarioChoice[];
  /** type="message" のとき「次へ」で進むノードID */
  nextNodeId?: string;
  /** ノードに関連するフォームURL（📋ボタンとして表示） */
  formUrls?: FormUrl[];
};

export type Scenario = {
  id: string;
  name: string;
  entryNodeId: string;
  nodes: Record<string, ScenarioNode>;
};

// ──────────────────────────────────────────────
// カテゴリID → シナリオIDリスト のマッピング
// ──────────────────────────────────────────────
export const CATEGORY_SCENARIOS: Record<string, string[]> = {
  "手続き・契約": ["kaisen", "hissen", "meigi"],
};

// ──────────────────────────────────────────────
// シナリオデータ
// ──────────────────────────────────────────────
export const SCENARIOS: Record<string, Scenario> = {

  // ── 開栓（ガス使用開始）────────────────────
  kaisen: {
    id: "kaisen",
    name: "開栓（ガスの使用開始）",
    entryNodeId: "area",
    nodes: {
      area: {
        id: "area",
        type: "choice",
        content: "開栓（ガスの使用開始）のご案内です。\nお引越し先の地域をお選びください。",
        context: "開栓手続き（ガス使用開始の申し込み）",
        choices: [
          { label: "旭川市内", nextNodeId: "asahikawa" },
          { label: "江別地区", nextNodeId: "ebetsu" },
        ],
      },
      asahikawa: {
        id: "asahikawa",
        type: "message",
        content:
          "旭川市内の開栓手続きについてご案内します。\n\n・ご希望の工事日の1週間前までにお申し込みください\n・工事当日は立ち合いが必要です（約30分）",
        context: "開栓手続き - 旭川市内エリア（工事日程・立ち合い案内）",
        nextNodeId: "asahikawa_docs",
      },
      asahikawa_docs: {
        id: "asahikawa_docs",
        type: "end",
        content:
          "【ご準備いただくもの】\n・本人確認書類（運転免許証・健康保険証など）\n・お客様番号（旭川ガスからのご案内書類に記載）\n\n書類が揃いましたら、以下のフォームからお申し込みいただけます。",
        context: "開栓手続き - 旭川市内 - 必要書類の確認",
        formUrls: [
          { label: "開栓お申し込みフォーム（旭川地区）", url: "https://asahikawa-gas.co.jp/?page_id=590" },
        ],
      },
      ebetsu: {
        id: "ebetsu",
        type: "end",
        content:
          "江別地区の開栓は、以下のフォームからお申し込みいただけます。\n\n・ご希望の工事日の1週間前までにお申し込みください\n・工事当日は立ち合いが必要です（約30分）",
        context: "開栓手続き - 江別地区エリア（工事日程・立ち合い案内）",
        formUrls: [
          { label: "開栓お申し込みフォーム（江別地区）", url: "https://asahikawa-gas.co.jp/?page_id=665" },
        ],
      },
    },
  },

  // ── 閉栓（ガス使用停止）────────────────────
  hissen: {
    id: "hissen",
    name: "閉栓（ガスの使用停止）",
    entryNodeId: "reason",
    nodes: {
      reason: {
        id: "reason",
        type: "choice",
        content: "閉栓（ガスの使用停止）のご案内です。\nご用件をお選びください。",
        context: "閉栓手続き（ガス使用停止の申し込み）",
        choices: [
          { label: "引越しによる閉栓", nextNodeId: "moving_area" },
          { label: "その他の理由による閉栓", nextNodeId: "other_area" },
        ],
      },
      moving_area: {
        id: "moving_area",
        type: "choice",
        content: "引越しのため閉栓されるのですね。\n現在のご住所の地域をお選びください。",
        context: "閉栓手続き - 引越しによるガス使用停止",
        choices: [
          { label: "旭川市内", nextNodeId: "moving_asahikawa" },
          { label: "江別地区", nextNodeId: "moving_ebetsu" },
        ],
      },
      moving_asahikawa: {
        id: "moving_asahikawa",
        type: "end",
        content:
          "旭川市内の閉栓は、以下のフォームからお申し込みいただけます。\n\n・ご使用停止希望日の3日前までにお申し込みください\n・メーターの閉栓作業は立ち合い不要です",
        context: "閉栓手続き - 引越し - 旭川市内（申込期限）",
        formUrls: [
          { label: "閉栓お申し込みフォーム（旭川地区）", url: "https://asahikawa-gas.co.jp/?page_id=589" },
        ],
      },
      moving_ebetsu: {
        id: "moving_ebetsu",
        type: "end",
        content:
          "江別地区の閉栓は、以下のフォームからお申し込みいただけます。\n\n・ご使用停止希望日の3日前までにお申し込みください\n・メーターの閉栓作業は立ち合い不要です",
        context: "閉栓手続き - 引越し - 江別地区（申込期限）",
        formUrls: [
          { label: "閉栓お申し込みフォーム（江別地区）", url: "https://asahikawa-gas.co.jp/?page_id=679" },
        ],
      },
      other_area: {
        id: "other_area",
        type: "choice",
        content: "現在のご住所の地域をお選びください。",
        context: "閉栓手続き - その他の理由",
        choices: [
          { label: "旭川市内", nextNodeId: "other_asahikawa" },
          { label: "江別地区", nextNodeId: "other_ebetsu" },
        ],
      },
      other_asahikawa: {
        id: "other_asahikawa",
        type: "end",
        content:
          "旭川市内の閉栓は、以下のフォームからお申し込みいただけます。\n\n・ご使用停止希望日の3日前までにお申し込みください",
        context: "閉栓手続き - その他の理由 - 旭川市内（申込期限）",
        formUrls: [
          { label: "閉栓お申し込みフォーム（旭川地区）", url: "https://asahikawa-gas.co.jp/?page_id=589" },
        ],
      },
      other_ebetsu: {
        id: "other_ebetsu",
        type: "end",
        content:
          "江別地区の閉栓は、以下のフォームからお申し込みいただけます。\n\n・ご使用停止希望日の3日前までにお申し込みください",
        context: "閉栓手続き - その他の理由 - 江別地区（申込期限）",
        formUrls: [
          { label: "閉栓お申し込みフォーム（江別地区）", url: "https://asahikawa-gas.co.jp/?page_id=679" },
        ],
      },
    },
  },

  // ── 名義変更 ────────────────────────────────
  meigi: {
    id: "meigi",
    name: "名義変更",
    entryNodeId: "intro",
    nodes: {
      intro: {
        id: "intro",
        type: "message",
        content:
          "名義変更のご案内です。\n\n旧名義人・新名義人の両方の情報が必要になります。",
        context: "名義変更手続き（ガス契約の名義変更）",
        nextNodeId: "docs",
      },
      docs: {
        id: "docs",
        type: "message",
        content:
          "【ご準備いただくもの】\n・旧名義人の本人確認書類\n・新名義人の本人確認書類\n・印鑑（双方）",
        context: "名義変更手続き - 必要書類の確認",
        nextNodeId: "contact",
      },
      contact: {
        id: "contact",
        type: "end",
        content:
          "書類が揃いましたら、以下のフォームからお申し込みいただけます。",
        context: "名義変更手続き - お申し込み方法",
        formUrls: [
          { label: "名義変更お申し込みフォーム", url: "https://asahikawa-gas.co.jp/?page_id=210" },
        ],
      },
    },
  },
};

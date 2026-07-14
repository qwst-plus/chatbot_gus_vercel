// lib/smartRouting.ts
// スマートルーティング＋コスト推計ユーティリティ

export type RagChunk = {
  content?: string;
  similarity: number;
  category?: string | string[];
};

const EXCHANGE_RATE = 155;

// 月間APIコストの上限（円）。クウェスト向け原価内訳ウィジェットの70%/90%アラートに使用。
// 上限を超えてもリクエストは止めない（監視のみ）
export const MONTHLY_BUDGET_JPY = 6_000;

// 旭川ガス向けの月間リクエスト上限（1リクエスト=1ユーザーメッセージ）。毎月1日にリセット
export const MONTHLY_REQUEST_QUOTA = 5_000;

// スマートルーティングの複雑度しきい値のデフォルト（この値を超えるとFlash、以下はFlash-Lite）
export const DEFAULT_SMART_ROUTING_THRESHOLD = 0.5;
const SMART_ROUTING_THRESHOLD_KEY = "smart_routing_threshold";

// 設定画面で保存されたしきい値を取得（未設定・不正値の場合はデフォルトにフォールバック）
// lib/appSettings.ts はSupabaseクライアントをモジュール読み込み時に初期化するため、
// このファイルの純粋なユニットテスト（calcComplexityScore等）を壊さないよう動的importにする
export async function getSmartRoutingThreshold(): Promise<number> {
  const { getSetting } = await import("@/lib/appSettings");
  const raw = await getSetting(SMART_ROUTING_THRESHOLD_KEY);
  const n = raw !== null ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : DEFAULT_SMART_ROUTING_THRESHOLD;
}

const MODEL_PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  // Google
  "gemini-2.0-flash-001":       { input: 0.10,  output: 0.40,  cacheRead: 0.025,  cacheWrite: 0.0  },
  "gemini-2.5-flash-lite":      { input: 0.10,  output: 0.40,  cacheRead: 0.025,  cacheWrite: 0.0  },
  "gemini-2.5-flash":           { input: 0.15,  output: 0.60,  cacheRead: 0.0375, cacheWrite: 0.0  },
  "gemini-2.5-pro":             { input: 1.25,  output: 10.00, cacheRead: 0.31,   cacheWrite: 0.0  },
};

export function calcComplexityScore(
  userInput: string,
  ragChunks: RagChunk[],
  sessionTurns: number
): number {
  let score = 0;

  if (userInput.length >= 100) score += 0.2;
  if (ragChunks.length >= 3) score += 0.2;

  // 異なるカテゴリのチャンクが混在
  const cats = new Set(
    ragChunks.flatMap((c) =>
      Array.isArray(c.category) ? c.category : c.category ? [c.category] : []
    )
  );
  if (cats.size > 1) score += 0.2;

  if (/違い|比較|なぜ|どちら/.test(userInput)) score += 0.2;
  if (sessionTurns >= 3) score += 0.1;
  if (ragChunks.some((c) => c.similarity < 0.75)) score += 0.1;

  return Math.min(score, 1.0);
}

// complexity_score > 0.5 → Flash、それ以外 → Flash-Lite
export function selectModel(complexityScore: number): string {
  return complexityScore > 0.5 ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
}

// 推定コスト計算（円）。cacheWriteTokens は省略可（省略時 0）
export function estimateCostJpy(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens = 0
): number {
  const p = MODEL_PRICES[model] ?? MODEL_PRICES["gemini-2.5-flash"];
  const usd =
    (inputTokens      / 1_000_000) * p.input +
    (outputTokens     / 1_000_000) * p.output +
    (cacheReadTokens  / 1_000_000) * p.cacheRead +
    (cacheWriteTokens / 1_000_000) * p.cacheWrite;
  return Math.round(usd * EXCHANGE_RATE * 1000) / 1000;
}

// lib/autocut.ts
// オートカット: 類似度スコアの「大きなジャンプ」を検出し、そこで検索結果を打ち切る。
// Weaviate Advanced RAG Techniques ebookのautocut手法の最小実装。
// 前提: rows は similarity 降順ソート済み（match_documents の ORDER BY により保証される）。

export type AutocutRow = { similarity: number };

export type AutocutOptions = {
  minKeep?: number;
  zScoreThreshold?: number;
  minAbsoluteGap?: number;
};

export const DEFAULT_AUTOCUT_MIN_KEEP = 3;
export const DEFAULT_AUTOCUT_Z_SCORE_THRESHOLD = 1.5;
// eval:retrieval のベースライン実行で実測した値をもとに設定。
// このコーパスは類似度の絶対値が全体的に低く（0.2〜0.5台）、ノイズ由来の
// ギャップ（0.02前後）とクラスタ境界起因のギャップ（0.027以上）が接近しているため、
// 0.02では誤ってクラスタ境界でない箇所を切ってしまうリージョンが観測された。
export const DEFAULT_AUTOCUT_MIN_ABSOLUTE_GAP = 0.025;

export function applyAutocut<T extends AutocutRow>(
  rows: T[],
  opts: AutocutOptions = {}
): T[] {
  const minKeep = opts.minKeep ?? DEFAULT_AUTOCUT_MIN_KEEP;
  const zScoreThreshold = opts.zScoreThreshold ?? DEFAULT_AUTOCUT_Z_SCORE_THRESHOLD;
  const minAbsoluteGap = opts.minAbsoluteGap ?? DEFAULT_AUTOCUT_MIN_ABSOLUTE_GAP;

  if (rows.length <= minKeep) return rows;

  const gaps: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    gaps.push(rows[i].similarity - rows[i + 1].similarity);
  }

  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length;
  const stdev = Math.sqrt(variance);

  if (stdev < 1e-9) return rows; // 全体が均質 → カットしない

  // minKeep件は必ず残す。先頭から見て最初に「統計的にも絶対値としても」有意なギャップで打ち切る
  for (let i = minKeep - 1; i < gaps.length; i++) {
    const z = (gaps[i] - mean) / stdev;
    if (z >= zScoreThreshold && gaps[i] >= minAbsoluteGap) {
      return rows.slice(0, i + 1);
    }
  }

  return rows;
}

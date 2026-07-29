// lib/hybridSearch.ts
// ハイブリッド検索: ベクター類似度とtrigramキーワード類似度を候補集合内でmin-max正規化し、
// alpha加重で線形結合する。正規化なしでは両者のスケールが大きく異なり
// （vector: 概ね0.3〜0.95, trigram: 概ね0〜0.15）、alphaがほぼ意味をなさなくなるため。

export type FusableRow = { id: string; similarity: number };

export type HybridOptions = {
  alpha?: number; // ベクター側の重み（0〜1）。1でベクターのみ、0でキーワードのみと一致
  minKeywordSimilarity?: number; // これ未満のtrigram類似度はノイズとして0点扱い（正規化対象から除外）
};

// eval:retrievalで実測のうえ調整。alpha=0.6だと、キーワード側のノイズが
// 既に正解だったベクター上位1位を追い越してしまう回帰が発生した。
// その後インデックス最適化（重複・stale chunkの削除）でコーパスが変わり
// 再調整が必要になった。alpha=0.8で回帰0件・top1 91%→95%・MRR 0.932→0.958。
export const DEFAULT_HYBRID_ALPHA = 0.8;
// このコーパス（日本語・pg_trgm）では、有効なキーワード一致でも生の類似度は
// 概ね0.01〜0.05程度にしかならない（実測: 電話番号のピンポイント一致ですら0.043）。
// 0.05を閾値にすると正しい一致までノイズ扱いされ、キーワード側が実質機能しなくなる
// ことが評価スクリプトで判明したため、大幅に下げてある。
export const DEFAULT_MIN_KEYWORD_SIMILARITY = 0.01;

function minMaxNormalize(values: number[]): (v: number) => number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-9) return () => (max > 0 ? 1 : 0);
  return (v: number) => (v - min) / (max - min);
}

export function fuseHybridResults<T extends FusableRow>(
  vectorResults: T[],
  keywordResults: T[],
  opts: HybridOptions = {}
): T[] {
  const alpha = opts.alpha ?? DEFAULT_HYBRID_ALPHA;
  const minKw = opts.minKeywordSimilarity ?? DEFAULT_MIN_KEYWORD_SIMILARITY;

  const kwFiltered = keywordResults.filter((r) => r.similarity >= minKw);

  const normV = vectorResults.length ? minMaxNormalize(vectorResults.map((r) => r.similarity)) : () => 0;
  const normK = kwFiltered.length ? minMaxNormalize(kwFiltered.map((r) => r.similarity)) : () => 0;

  const vNormById = new Map(vectorResults.map((r) => [r.id, normV(r.similarity)]));
  const kNormById = new Map(kwFiltered.map((r) => [r.id, normK(r.similarity)]));

  const byId = new Map<string, T>();
  for (const r of vectorResults) byId.set(r.id, r);
  for (const r of keywordResults) if (!byId.has(r.id)) byId.set(r.id, r);

  return Array.from(byId.entries())
    .map(([id, row]) => ({
      ...row,
      similarity: alpha * (vNormById.get(id) ?? 0) + (1 - alpha) * (kNormById.get(id) ?? 0),
    }))
    .sort((a, b) => b.similarity - a.similarity);
}

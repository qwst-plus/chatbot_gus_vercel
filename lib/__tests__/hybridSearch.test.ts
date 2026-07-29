import { describe, it, expect } from "vitest";
import { fuseHybridResults } from "../hybridSearch";

describe("fuseHybridResults", () => {
  it("ベクターのみ・キーワードのみ・両方ヒットが和集合としてマージされる", () => {
    const vector = [
      { id: "a", similarity: 0.9 },
      { id: "b", similarity: 0.5 },
    ];
    const keyword = [
      { id: "b", similarity: 0.1 },
      { id: "c", similarity: 0.08 },
    ];
    const result = fuseHybridResults(vector, keyword);
    const ids = result.map((r) => r.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("キーワード類似度がminKeywordSimilarity未満はノイズとして0点扱いになる", () => {
    const vector = [
      { id: "x", similarity: 0.7 },
      { id: "y", similarity: 0.3 },
    ];
    const keyword = [{ id: "x", similarity: 0.005 }]; // デフォルト閾値0.01未満
    const result = fuseHybridResults(vector, keyword);
    const x = result.find((r) => r.id === "x")!;
    // キーワード加点なしの場合と同じスコアになる（alpha * 1 + (1-alpha) * 0 = alpha）
    expect(x.similarity).toBeCloseTo(0.8, 5);
  });

  it("alpha=1 でベクターのみのランキングと一致する", () => {
    const vector = [
      { id: "a", similarity: 0.9 },
      { id: "b", similarity: 0.4 },
    ];
    const keyword = [{ id: "c", similarity: 0.5 }];
    const result = fuseHybridResults(vector, keyword, { alpha: 1 });
    expect(result[0].id).toBe("a");
    expect(result.find((r) => r.id === "c")!.similarity).toBe(0);
  });

  it("alpha=0 でキーワードのみのランキングと一致する", () => {
    const vector = [{ id: "a", similarity: 0.9 }];
    const keyword = [
      { id: "b", similarity: 0.3 },
      { id: "c", similarity: 0.1 },
    ];
    const result = fuseHybridResults(vector, keyword, { alpha: 0 });
    expect(result[0].id).toBe("b");
    expect(result.find((r) => r.id === "a")!.similarity).toBe(0);
  });

  it("スケールの違うベクター/キーワード値でも正規化により両方が結果に反映される", () => {
    // ベクターは僅差(0.30〜0.31)、キーワードは絶対値としては小さい(0.15)が
    // 正規化後はalpha次第でキーワード側の一致がベクター側の弱い一致を上回る
    const vector = [
      { id: "a", similarity: 0.31 },
      { id: "b", similarity: 0.3 },
    ];
    const keyword = [{ id: "c", similarity: 0.15 }];
    const result = fuseHybridResults(vector, keyword, { alpha: 0.3 });
    const a = result.find((r) => r.id === "a")!;
    const c = result.find((r) => r.id === "c")!;
    expect(c.similarity).toBeGreaterThan(a.similarity);
  });

  it("結果はsimilarity降順でソートされている（autocutの前提を満たす）", () => {
    const vector = [
      { id: "a", similarity: 0.5 },
      { id: "b", similarity: 0.9 },
      { id: "c", similarity: 0.2 },
    ];
    const result = fuseHybridResults(vector, []);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].similarity).toBeGreaterThanOrEqual(result[i + 1].similarity);
    }
  });
});

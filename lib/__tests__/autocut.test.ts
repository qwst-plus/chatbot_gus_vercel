import { describe, it, expect } from "vitest";
import { applyAutocut } from "../autocut";

describe("applyAutocut", () => {
  it("件数が minKeep 以下 → そのまま返す", () => {
    const rows = [{ similarity: 0.9 }, { similarity: 0.8 }, { similarity: 0.7 }];
    expect(applyAutocut(rows)).toEqual(rows);
  });

  it("明確な1箇所のジャンプ → そこで打ち切られる", () => {
    const rows = [
      { similarity: 0.95 },
      { similarity: 0.93 },
      { similarity: 0.91 },
      { similarity: 0.55 },
      { similarity: 0.53 },
      { similarity: 0.51 },
      { similarity: 0.49 },
    ];
    const result = applyAutocut(rows);
    expect(result.length).toBe(3);
    expect(result.map((r) => r.similarity)).toEqual([0.95, 0.93, 0.91]);
  });

  it("なだらかな減衰（有意なジャンプなし） → 全件保持", () => {
    const rows = [
      { similarity: 0.9 },
      { similarity: 0.86 },
      { similarity: 0.81 },
      { similarity: 0.77 },
      { similarity: 0.72 },
      { similarity: 0.68 },
      { similarity: 0.63 },
    ];
    expect(applyAutocut(rows).length).toBe(rows.length);
  });

  it("全件同一類似度 → 全件保持（stdevガード）", () => {
    const rows = Array.from({ length: 5 }, () => ({ similarity: 0.8 }));
    expect(applyAutocut(rows).length).toBe(5);
  });

  it("統計的に有意でも絶対値が小さいジャンプ → 全件保持（minAbsoluteGapガード）", () => {
    const rows = [
      { similarity: 0.821 },
      { similarity: 0.82 },
      { similarity: 0.819 },
      { similarity: 0.81 },
      { similarity: 0.809 },
      { similarity: 0.808 },
    ];
    expect(applyAutocut(rows).length).toBe(rows.length);
  });

  it("minKeep到達前の大きなジャンプは無視し、後続の有意なジャンプで打ち切る", () => {
    const rows = [
      { similarity: 0.99 },
      { similarity: 0.85 },
      { similarity: 0.83 },
      { similarity: 0.81 },
      { similarity: 0.4 },
      { similarity: 0.38 },
      { similarity: 0.36 },
    ];
    const result = applyAutocut(rows);
    expect(result.length).toBe(4);
    expect(result.map((r) => r.similarity)).toEqual([0.99, 0.85, 0.83, 0.81]);
  });

  it("minKeepオプションを指定すると最低保持件数が変わる", () => {
    const rows = [
      { similarity: 0.95 },
      { similarity: 0.93 },
      { similarity: 0.91 },
      { similarity: 0.55 },
      { similarity: 0.53 },
    ];
    expect(applyAutocut(rows, { minKeep: 5 }).length).toBe(5);
  });
});

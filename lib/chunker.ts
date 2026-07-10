// lib/chunker.ts
// 業種非依存の汎用チャンク化パイプライン。
// 業種固有キーワードは一切使わず、テキストの構造のみで判定する。

import type { ChunkStrategy } from "@/types/log";

// ── 構造検出ヘルパー（業種非依存）────────────────────────────

// Q&Aパターン検出：「Q:」「質問：」「よくある質問」「FAQ」などの構造で判定
const hasQAPattern = (text: string): boolean =>
  /Q[:：]|質問[:：]|よくある質問|FAQ/i.test(text);

// 見出しパターン検出：「第X条」「## 」「1. 」「1）」などの構造で判定
const hasHeadingPattern = (text: string): boolean =>
  /第\d+条|^#{1,3}\s|^\d+[.．）]\s/m.test(text);

// テーブルパターン検出：キーワードではなく整列構造（タブ・連続スペース・パイプ）で判定
const hasTablePattern = (text: string): boolean => {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;
  const alignedLines = lines.filter(
    (l) => l.includes("\t") || /\s{3,}/.test(l) || l.includes("|")
  );
  // 全体の30%以上が整列行ならテーブルとみなす
  return alignedLines.length / lines.length > 0.3;
};

// ── チャンク戦略の自動選択（業種非依存）──────────────────────

export function selectStrategy(content: string): ChunkStrategy {
  if (hasQAPattern(content))      return "qa_pair";
  if (hasHeadingPattern(content)) return "semantic";
  if (hasTablePattern(content))   return "table";
  return "fixed_size";
}

// ── 戦略1：Q&Aペアチャンク ───────────────────────────────────
// 推奨サイズ：200〜400文字　対象：FAQページ・問い合わせページ
export function chunkByQAPair(text: string): string[] {
  const chunks: string[] = [];
  // Q:〜A:〜のペアを1チャンクに。複数形式に対応。
  const qPattern = /(?:Q[:：]|質問[:：]|【質問】)/;
  const aPattern = /(?:A[:：]|回答[:：]|【回答】)/;

  const lines = text.split("\n");
  let current = "";

  for (const line of lines) {
    if (qPattern.test(line)) {
      // 前のチャンクを確定
      if (current.trim().length > 0) chunks.push(current.trim());
      current = line + "\n";
    } else if (aPattern.test(line) && current.length > 0) {
      current += line + "\n";
    } else if (current.length > 0) {
      current += line + "\n";
      // A:が来た後の次のQ:で区切るため、一定文字数超えたら強制分割
      if (current.length > 800) {
        chunks.push(current.trim());
        current = "";
      }
    }
  }

  if (current.trim().length > 0) chunks.push(current.trim());

  // Q&A構造が見つからなかった場合は固定サイズにフォールバック
  return chunks.length > 0 ? chunks : chunkByFixedSize(text);
}

// ── 戦略2：セマンティックチャンク ────────────────────────────
// 推奨サイズ：400〜600文字　対象：約款・規程・マニュアルPDF
export function chunkBySemantic(text: string): string[] {
  const chunks: string[] = [];
  // 見出し行（第X条・##・数字.）を区切りとして分割
  const sections = text.split(/\n(?=(?:第\d+条|#{1,3}\s|\d+[.．）]\s))/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length === 0) continue;

    // セクションが大きすぎる場合は固定サイズでさらに分割
    if (trimmed.length > 800) {
      const subChunks = chunkByFixedSize(trimmed, 600, 100);
      chunks.push(...subChunks);
    } else {
      chunks.push(trimmed);
    }
  }

  return chunks.length > 0 ? chunks : chunkByFixedSize(text);
}

// ── 戦略3：テーブル単位チャンク ──────────────────────────────
// テーブル構造を1チャンクとして保持　対象：料金表・一覧表・比較表
export function chunkByTable(text: string): string[] {
  const chunks: string[] = [];
  const lines = text.split("\n");
  let tableBlock: string[] = [];
  let textBlock: string[] = [];

  const isTableLine = (line: string): boolean =>
    line.includes("\t") || /\s{3,}/.test(line) || line.includes("|");

  for (const line of lines) {
    if (isTableLine(line)) {
      // テキストブロックをフラッシュ
      if (textBlock.length > 0) {
        const txt = textBlock.join("\n").trim();
        if (txt.length > 0) chunks.push(txt);
        textBlock = [];
      }
      tableBlock.push(line);
    } else {
      // テーブルブロックをフラッシュ
      if (tableBlock.length > 0) {
        const tbl = tableBlock.join("\n").trim();
        if (tbl.length > 0) chunks.push(tbl);
        tableBlock = [];
      }
      textBlock.push(line);
    }
  }

  // 残りをフラッシュ
  if (tableBlock.length > 0) chunks.push(tableBlock.join("\n").trim());
  if (textBlock.length > 0) {
    const txt = textBlock.join("\n").trim();
    if (txt.length > 0) chunks.push(txt);
  }

  return chunks.filter((c) => c.length > 0).length > 0
    ? chunks.filter((c) => c.length > 0)
    : chunkByFixedSize(text);
}

// ── 戦略4：固定サイズチャンク ────────────────────────────────
// chunkSize文字ごとに分割、overlap文字オーバーラップ
// 対象：汎用Webページ・構造不明なドキュメント
export function chunkByFixedSize(
  text: string,
  chunkSize = 500,
  overlap = 100
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    start += chunkSize - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

// ── チャンク化メイン関数 ──────────────────────────────────────
export function chunkDocument(
  text: string
): { chunks: string[]; strategy: ChunkStrategy } {
  const strategy = selectStrategy(text);

  const chunks = {
    qa_pair:    () => chunkByQAPair(text),
    semantic:   () => chunkBySemantic(text),
    table:      () => chunkByTable(text),
    fixed_size: () => chunkByFixedSize(text),
  }[strategy]();

  return { chunks, strategy };
}

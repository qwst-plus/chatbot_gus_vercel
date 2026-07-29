// scripts/eval-retrieval.mjs
// RAG検索の精度を確認する簡易評価スクリプト。
// 使い方: npm run eval:retrieval          （オートカットなし・ありの両方を表示）
// 実際のOpenAI埋め込み・Supabase match_documents RPCを叩く（読み取りのみ、DB更新なし）。
// 環境変数は `node --env-file=.env.local` で読み込む前提（package.jsonのeval:retrievalスクリプト参照）。

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { applyAutocut } from "../lib/autocut.ts";
import { fuseHybridResults } from "../lib/hybridSearch.ts";

function env(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

const openai = new OpenAI({ apiKey: env("OPENAI_API_KEY") });

const SUPABASE_URL = env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL") ?? "";
const SUPABASE_KEY =
  env("SUPABASE_SERVER_KEY") ??
  env("SUPABASE_SERVICE_ROLE_KEY") ??
  env("SUPABASE_ANON_KEY") ??
  env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
  "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVER_KEY が読み込めていません。--env-file=.env.local を指定して実行してください。");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const TOP_K = 20; // 本番のデフォルト top_k と揃える

// ── テストクエリ（documentsテーブルの実タイトル/URLから抽出）─────────────
const TEST_SET = [
  { query: "ガスくさい気がするんですが", expected: "page_id=301" },
  { query: "地震が起きたときはどうすればいい？", expected: "page_id=306" },
  { query: "ガスが出ないんですが", expected: "page_id=308" },
  { query: "ガスメーターの復帰方法を教えて", expected: "page_id=310" },
  { query: "故障かなと思ったときはどうすればいい", expected: "page_id=313" },
  { query: "料金の支払い方法について知りたい", expected: "page_id=10179" },
  { query: "都市ガスの料金の仕組みを教えて", expected: "page_id=72" },
  { query: "LPガスの料金の仕組みは？", expected: "page_id=39651" },
  { query: "引っ越しでガスの使用を始めたい（旭川）", expected: "page_id=590" },
  { query: "検針票の数値が間違っていた気がする", expected: "page_id=194" },
  { query: "定期点検を申し込みたい（旭川）", expected: "page_id=40255" },
  { query: "インボイス（適格請求書）を発行してほしい", expected: "page_id=97784" },
  { query: "警報器の取り付けを勧められたけど必要？", expected: "page_id=105" },
  { query: "開放型のガスストーブを使うときの注意点は", expected: "page_id=101" },
  { query: "屋内設置の湯沸器を使うときの注意点は", expected: "page_id=99" },
  { query: "ガス風呂釜を使うときの注意点は", expected: "page_id=96" },
  { query: "古くなったガス管を交換したい", expected: "page_id=107" },
  { query: "灯油の価格や配送について知りたい", expected: "page_id=725" },
  { query: "エコジョーズについて教えて", expected: "page_id=54" },
  { query: "採用情報を見たい", expected: "page_id=440" },
  { query: "問い合わせ先の一覧が見たい", expected: "page_id=381" },
  { query: "商品の配達エリアを確認したい", expected: "page_id=19687" },
];

async function embedQuery(text) {
  const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
  return res.data[0].embedding;
}

// route.ts の searchSupabase と同じロジック（source_url補完込み）を最小限で複製
async function searchSupabase(query, topK) {
  const qEmb = await embedQuery(query);
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: qEmb,
    match_count: topK,
  });
  if (error) throw new Error(`supabase.rpc(match_documents) failed: ${error.message}`);

  const rows = data ?? [];
  const ids = rows.map((r) => String(r.id ?? "")).filter(Boolean);
  let sourceUrlMap = {};
  if (ids.length > 0) {
    const { data: docData } = await supabase.from("documents").select("id, url, source_url").in("id", ids);
    sourceUrlMap = Object.fromEntries((docData ?? []).map((d) => [String(d.id), String(d.url || d.source_url || "")]));
  }

  return rows
    .map((row) => {
      const rowId = String(row.id ?? "");
      const source =
        String(row.source || row.url || row.source_url || row.path || "").trim() || sourceUrlMap[rowId] || "";
      return {
        id: rowId,
        title: String(row.title ?? source).trim(),
        source,
        similarity: Number(row.similarity ?? 0),
      };
    })
    .filter((r) => r.source.length > 0);
}

// route.ts の searchSupabase のキーワード側と同じロジックを最小限で複製
async function searchKeyword(query, topK) {
  const { data, error } = await supabase.rpc("match_documents_keyword", {
    query_text: query,
    match_count: topK,
  });
  if (error) {
    console.warn(`[hybrid] match_documents_keyword failed（マイグレーション未適用の可能性）: ${error.message}`);
    return [];
  }

  const rows = data ?? [];
  const ids = rows.map((r) => String(r.id ?? "")).filter(Boolean);
  let sourceUrlMap = {};
  if (ids.length > 0) {
    const { data: docData } = await supabase.from("documents").select("id, url, source_url").in("id", ids);
    sourceUrlMap = Object.fromEntries((docData ?? []).map((d) => [String(d.id), String(d.url || d.source_url || "")]));
  }

  return rows
    .map((row) => {
      const rowId = String(row.id ?? "");
      const source =
        String(row.source || row.url || row.source_url || row.path || "").trim() || sourceUrlMap[rowId] || "";
      return {
        id: rowId,
        title: String(row.title ?? source).trim(),
        source,
        similarity: Number(row.keyword_similarity ?? 0),
      };
    })
    .filter((r) => r.source.length > 0);
}

function evaluate(results, expected) {
  const idx = results.findIndex((r) => r.source.includes(expected));
  const rank = idx === -1 ? null : idx + 1;
  return {
    rank,
    top1: rank === 1,
    top3: rank !== null && rank <= 3,
    top5: rank !== null && rank <= 5,
    reciprocalRank: rank ? 1 / rank : 0,
  };
}

function summarize(evals) {
  const n = evals.length;
  const top1 = evals.filter((e) => e.top1).length;
  const top3 = evals.filter((e) => e.top3).length;
  const top5 = evals.filter((e) => e.top5).length;
  const mrr = evals.reduce((a, e) => a + e.reciprocalRank, 0) / n;
  return {
    n,
    top1Rate: top1 / n,
    top3Rate: top3 / n,
    top5Rate: top5 / n,
    mrr,
  };
}

async function main() {
  console.log(`評価クエリ数: ${TEST_SET.length}, top_k=${TOP_K}\n`);

  const perQuery = [];
  for (const { query, expected } of TEST_SET) {
    const raw = await searchSupabase(query, TOP_K);
    const cut = applyAutocut(raw);
    const keyword = await searchKeyword(query, TOP_K);
    const hybrid = fuseHybridResults(raw, keyword).slice(0, TOP_K);
    const hybridCut = applyAutocut(hybrid);

    const rawEval = evaluate(raw, expected);
    const cutEval = evaluate(cut, expected);
    const hybridEval = evaluate(hybrid, expected);
    const hybridCutEval = evaluate(hybridCut, expected);
    const regression = rawEval.rank !== null && cutEval.rank === null;
    const hybridRegression = rawEval.rank !== null && hybridCutEval.rank === null;

    perQuery.push({
      query,
      expected,
      rawEval,
      cutEval,
      hybridEval,
      hybridCutEval,
      rawCount: raw.length,
      cutCount: cut.length,
      hybridCutCount: hybridCut.length,
      regression,
      hybridRegression,
    });

    console.log(
      `[${regression || hybridRegression ? "REGRESSION" : "ok"}] "${query}" → 期待:${expected} / raw rank=${rawEval.rank ?? "圏外"} / cut rank=${cutEval.rank ?? "圏外"} / hybrid rank=${hybridEval.rank ?? "圏外"} / hybrid+cut rank=${hybridCutEval.rank ?? "圏外"} (${keyword.length}件keywordヒット)`
    );
  }

  const rawSummary = summarize(perQuery.map((p) => p.rawEval));
  const cutSummary = summarize(perQuery.map((p) => p.cutEval));
  const hybridSummary = summarize(perQuery.map((p) => p.hybridEval));
  const hybridCutSummary = summarize(perQuery.map((p) => p.hybridCutEval));
  const regressions = perQuery.filter((p) => p.regression);
  const hybridRegressions = perQuery.filter((p) => p.hybridRegression);
  const avgCutRatio =
    perQuery.reduce((a, p) => a + (p.rawCount - p.cutCount) / p.rawCount, 0) / perQuery.length;

  console.log("\n── サマリー ─────────────────────────");
  console.log(`raw       : top1=${(rawSummary.top1Rate * 100).toFixed(0)}% top3=${(rawSummary.top3Rate * 100).toFixed(0)}% top5=${(rawSummary.top5Rate * 100).toFixed(0)}% MRR=${rawSummary.mrr.toFixed(3)}`);
  console.log(`cut       : top1=${(cutSummary.top1Rate * 100).toFixed(0)}% top3=${(cutSummary.top3Rate * 100).toFixed(0)}% top5=${(cutSummary.top5Rate * 100).toFixed(0)}% MRR=${cutSummary.mrr.toFixed(3)}`);
  console.log(`hybrid    : top1=${(hybridSummary.top1Rate * 100).toFixed(0)}% top3=${(hybridSummary.top3Rate * 100).toFixed(0)}% top5=${(hybridSummary.top5Rate * 100).toFixed(0)}% MRR=${hybridSummary.mrr.toFixed(3)}`);
  console.log(`hybrid+cut: top1=${(hybridCutSummary.top1Rate * 100).toFixed(0)}% top3=${(hybridCutSummary.top3Rate * 100).toFixed(0)}% top5=${(hybridCutSummary.top5Rate * 100).toFixed(0)}% MRR=${hybridCutSummary.mrr.toFixed(3)}`);
  console.log(`平均カット率(cut): ${(avgCutRatio * 100).toFixed(1)}%`);
  console.log(`回帰(cut)   : ${regressions.length}件${regressions.length ? " → " + regressions.map((r) => r.query).join(", ") : ""}`);
  console.log(`回帰(hybrid+cut): ${hybridRegressions.length}件${hybridRegressions.length ? " → " + hybridRegressions.map((r) => r.query).join(", ") : ""}`);

  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const dir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "eval-results");
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        topK: TOP_K,
        rawSummary,
        cutSummary,
        hybridSummary,
        hybridCutSummary,
        avgCutRatio,
        regressions: regressions.map((r) => r.query),
        hybridRegressions: hybridRegressions.map((r) => r.query),
        perQuery,
      },
      null,
      2
    )
  );
  console.log(`\n結果を保存しました: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

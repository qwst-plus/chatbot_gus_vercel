// scripts/backfill-categories.mjs
// documents.category (TEXT[]) の一括バックフィル。
// judgeCategory.ts をそのままimportしない理由: getClientConfig.ts が実行時に
// "@/config/..." という tsconfig パスエイリアスを動的importしており、
// プレーンなnode実行(Next.jsのbundler解決なし)では ERR_MODULE_NOT_FOUND になる。
// そのためこのスクリプトは分類ロジックを最小限だけ複製する(eval-retrieval.mjsと同じ方針)。
// lib/aiProvider.ts と config/clients/asahikawa-gas.ts は "@/" importを持たない
// (import type のみ、または皆無)ため直接importできる。
//
// 使い方:
//   node --env-file=.env.local scripts/backfill-categories.mjs            (dry-run)
//   node --env-file=.env.local scripts/backfill-categories.mjs --apply    (実際に書き込み)
//   node --env-file=.env.local scripts/backfill-categories.mjs --apply --limit=20  (先頭20件のみ)

import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { buildModel } from "../lib/aiProvider.ts";
import { clientConfig } from "../config/clients/asahikawa-gas.ts";

const CONCURRENCY = 5;
const CIRCUIT_BREAKER_N = 5;

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

function env(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}
const supabase = createClient(
  env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SERVER_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

const BASE_INSTRUCTION = `あなたはテキスト分類AIです。
指示に従って「normal」「emergency」「both」の1単語のみで回答してください。
余計な説明は不要です。`;

// judgeCategory.ts と同じロジック。タイトルを本文の前に付与する点のみ拡張
// (タイトルだけで判定がほぼ自明なケースが多く、誤分類のリスクを下げられるため)。
async function judgeCategory(title, content) {
  const chunk = `${title}\n${content}`.slice(0, 500);
  const { text } = await generateText({
    model: buildModel("smart"),
    system: BASE_INSTRUCTION,
    maxOutputTokens: 10,
    messages: [
      {
        role: "user",
        content: `${clientConfig.categoryPrompt.trim()}\n\nテキスト：${chunk}`,
      },
    ],
  });
  const raw = text.trim().toLowerCase();
  if (raw === "both") return ["normal", "emergency"];
  if (raw === "emergency") return ["emergency"];
  return ["normal"];
}

async function main() {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, content, category")
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);

  const todo = (data ?? []).filter((r) => r.category == null).slice(0, LIMIT);
  console.log(
    `対象: ${todo.length}件（既に分類済み: ${(data ?? []).length - todo.length}件 skip） / mode=${APPLY ? "APPLY" : "DRY-RUN"}`
  );

  const results = [];
  let cursor = 0;
  let consecutiveFailures = 0;
  let aborted = false;

  async function worker() {
    while (cursor < todo.length && !aborted) {
      const row = todo[cursor++];
      try {
        const category = await judgeCategory(row.title, row.content);
        consecutiveFailures = 0;
        if (APPLY) {
          const { error: updErr } = await supabase
            .from("documents")
            .update({ category })
            .eq("id", row.id);
          if (updErr) throw new Error(updErr.message);
        }
        results.push({ id: row.id, title: row.title, category, ok: true });
        if (category.includes("emergency")) {
          console.log(`[${category.join(",")}] ${row.title}`);
        }
      } catch (err) {
        consecutiveFailures++;
        results.push({ id: row.id, title: row.title, ok: false, error: err.message });
        console.error(`FAILED id=${row.id} "${row.title}": ${err.message}`);
        if (consecutiveFailures >= CIRCUIT_BREAKER_N) {
          aborted = true;
          console.error(`\n${CIRCUIT_BREAKER_N}件連続失敗 → 中断します（APIキー/設定の問題の可能性）`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const normal = ok.filter((r) => r.category.length === 1 && r.category[0] === "normal").length;
  const emergency = ok.filter((r) => r.category.length === 1 && r.category[0] === "emergency").length;
  const both = ok.filter((r) => r.category.length === 2).length;

  console.log("\n── サマリー ─────────────────────────");
  console.log(`分類済み: ${ok.length}/${todo.length}  normal=${normal} emergency=${emergency} both=${both}`);
  console.log(`失敗: ${failed.length}件${failed.length ? " → " + failed.map((f) => f.id).join(", ") : ""}`);
  console.log(
    aborted
      ? "中断されました（再実行すれば未処理行から再開されます）"
      : APPLY
      ? "適用完了"
      : "dry-run（--apply で実際に書き込み）"
  );

  if (failed.length && APPLY) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

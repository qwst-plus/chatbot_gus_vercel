// scripts/cleanup-stale-chunks.mjs
// documents テーブルに残っている「本文抽出バグ修正前」の古いチャンク（ナビゲーション文字列の
// 羅列）を削除する。対象は、同じURLに対して修正後の正しいチャンクが別途存在する行のみ
// （正しいチャンクが1件も無いURL＝トップページ・サイトマップ等は、その内容自体が
// ナビゲーション中心で妥当なため対象外とし、削除しない）。
//
// 使い方:
//   node --env-file=.env.local scripts/cleanup-stale-chunks.mjs            (dry-run)
//   node --env-file=.env.local scripts/cleanup-stale-chunks.mjs --apply    (実際に削除)

import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

function env(name) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}
const supabase = createClient(
  env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL"),
  env("SUPABASE_SERVER_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

// 修正前のナビゲーション文字列に特有のパターン（冒頭50字以内に出現するか）
const STALE_MARKERS = ["LOADING", "いただきガス", "サイトマップ"];

function isStale(content) {
  const head = content.slice(0, 50);
  return STALE_MARKERS.some((m) => head.includes(m));
}

async function main() {
  const { data, error } = await supabase.from("documents").select("id, site_id, url, title, content");
  if (error) throw new Error(error.message);

  const staleRows = data.filter((d) => isStale(d.content));
  const byUrl = new Map();
  for (const d of staleRows) {
    if (!byUrl.has(d.url)) byUrl.set(d.url, []);
    byUrl.get(d.url).push(d);
  }

  const toDelete = [];
  const skippedNoFresh = [];
  for (const [url, rows] of byUrl) {
    const hasFresh = data.some((d) => d.url === url && !isStale(d.content));
    if (hasFresh) {
      toDelete.push(...rows);
    } else {
      skippedNoFresh.push({ url, count: rows.length });
    }
  }

  console.log(`全document数: ${data.length}`);
  console.log(`stale判定: ${staleRows.length}件 / ${byUrl.size}URL`);
  console.log(`削除対象（正しいチャンクが別途存在する）: ${toDelete.length}件`);
  console.log(`削除しない（正しいチャンクが存在しない・トップページ等）: ${skippedNoFresh.length}URL`);
  for (const s of skippedNoFresh) console.log(`  - ${s.url} (${s.count}件はそのまま残す)`);

  if (!APPLY) {
    console.log("\ndry-run（--apply で実際に削除）");
    return;
  }

  let deleted = 0;
  for (const row of toDelete) {
    const { error: delErr } = await supabase.from("documents").delete().eq("id", row.id);
    if (delErr) {
      console.error(`FAILED id=${row.id} "${row.title}": ${delErr.message}`);
      continue;
    }
    deleted++;
  }
  console.log(`\n削除完了: ${deleted}/${toDelete.length}件`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

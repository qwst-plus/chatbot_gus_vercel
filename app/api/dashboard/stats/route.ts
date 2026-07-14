// app/api/dashboard/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifySessionValue } from "@/lib/auth";
import { MONTHLY_REQUEST_QUOTA } from "@/lib/smartRouting";

const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? "default";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// UTC タイムスタンプを JST の YYYY-MM-DD 文字列に変換
function toJstDateStr(utcStr: string): string {
  const d = new Date(new Date(utcStr).getTime() + JST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// GET /api/dashboard/stats?year=2026&month=3
export async function GET(req: NextRequest) {
  try {
    const session = await verifySessionValue(req.cookies.get("session")?.value);
    const isQuest = session?.role === "quest";

    const { searchParams } = new URL(req.url);
    const nowJst = new Date(new Date().getTime() + JST_OFFSET_MS);
    const year = parseInt(searchParams.get("year") ?? String(nowJst.getUTCFullYear()));
    const month = parseInt(searchParams.get("month") ?? String(nowJst.getUTCMonth() + 1));

    // JST 月初 0:00 = UTC 前日 15:00
    const startDate = new Date(Date.UTC(year, month - 1, 1) - JST_OFFSET_MS).toISOString();
    const endDate = new Date(Date.UTC(year, month, 1) - JST_OFFSET_MS).toISOString();
    // 月別トレンドは選択月を含む過去6ヶ月
    const trendStartDate = new Date(Date.UTC(year, month - 6, 1) - JST_OFFSET_MS).toISOString();

    // リクエスト残量は選択月に関わらず常に「実際の今月」を対象にする（毎月1日リセット）
    const curMonthStart = new Date(Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), 1) - JST_OFFSET_MS).toISOString();
    const curMonthEnd = new Date(Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth() + 1, 1) - JST_OFFSET_MS).toISOString();

    const [
      monthlyConvs,
      trendConvs,
      heatmap,
      topQuestions,
      topDocs,
      unusedDocs,
      keywords,
      categories,
      modeHistory,
      modelUsageRows,
      cacheStatsRows,
      costStatsRows,
      inputMethodRows,
      curMonthRequestCount,
    ] = await Promise.all([
      // 1. 選択月の会話（サマリー用）
      supabaseAdmin
        .from("conversations")
        .select("id, escalated, resolved")
        .eq("client_id", CLIENT_ID)
        .gte("started_at", startDate)
        .lt("started_at", endDate),

      // 2. 月別対話件数推移（過去6ヶ月）
      supabaseAdmin
        .from("conversations")
        .select("started_at")
        .eq("client_id", CLIENT_ID)
        .gte("started_at", trendStartDate)
        .lt("started_at", endDate)
        .order("started_at"),

      // 3. ヒートマップ（選択月のユーザーメッセージ）
      supabaseAdmin
        .from("messages")
        .select("created_at")
        .eq("role", "user")
        .gte("created_at", startDate)
        .lt("created_at", endDate),

      // 4. よく聞かれた質問（選択月）
      supabaseAdmin
        .from("messages")
        .select("content")
        .eq("role", "user")
        .gte("created_at", startDate)
        .lt("created_at", endDate),

      // 5. 参照ドキュメント（選択月）
      supabaseAdmin
        .from("messages")
        .select("retrieved_doc_titles, retrieved_doc_sources, created_at")
        .eq("role", "assistant")
        .not("retrieved_doc_titles", "is", null)
        .gte("created_at", startDate)
        .lt("created_at", endDate),

      // 6. 未参照ドキュメント（全ドキュメント取得 → 選択月に参照されなかったものをフィルタ）
      supabaseAdmin
        .from("documents")
        .select("id, title, url, source_url, updated_at"),

      // 7. 緊急ワード（選択月）
      supabaseAdmin
        .from("messages")
        .select("keyword_matched, created_at")
        .not("keyword_matched", "is", null)
        .gte("created_at", startDate)
        .lt("created_at", endDate),

      // 8. カテゴリ分布（選択月）
      supabaseAdmin
        .from("conversations")
        .select("category_id")
        .eq("client_id", CLIENT_ID)
        .gte("started_at", startDate)
        .lt("started_at", endDate),

      // 9. モード履歴（選択月の normal 以外の会話）
      supabaseAdmin
        .from("conversations")
        .select("id, mode, started_at, ended_at")
        .eq("client_id", CLIENT_ID)
        .neq("mode", "normal")
        .gte("started_at", startDate)
        .lt("started_at", endDate)
        .order("started_at", { ascending: false }),

      // 10. モデル使用比率（スマートルーティング）
      supabaseAdmin
        .from("messages")
        .select("model_used")
        .eq("role", "assistant")
        .not("model_used", "is", null)
        .gte("created_at", startDate)
        .lt("created_at", endDate),

      // 11. キャッシュ統計
      supabaseAdmin
        .from("messages")
        .select("cache_hit, cache_read_tokens")
        .eq("role", "assistant")
        .not("cache_hit", "is", null)
        .gte("created_at", startDate)
        .lt("created_at", endDate),

      // 12. コスト統計
      supabaseAdmin
        .from("messages")
        .select("estimated_cost_jpy")
        .eq("role", "assistant")
        .not("estimated_cost_jpy", "is", null)
        .gte("created_at", startDate)
        .lt("created_at", endDate),

      // 13. 音声 vs テキスト入力比率（選択月のユーザーメッセージ）
      supabaseAdmin
        .from("messages")
        .select("input_method")
        .eq("role", "user")
        .gte("created_at", startDate)
        .lt("created_at", endDate),

      // 14. リクエスト残量（今月のユーザーメッセージ件数。選択月に関わらず常に実際の今月で集計）
      supabaseAdmin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("role", "user")
        .gte("created_at", curMonthStart)
        .lt("created_at", curMonthEnd),
    ]);

    // ── サマリー集計 ──────────────────────────────────────────
    const convData = monthlyConvs.data ?? [];
    const totalCount = convData.length;
    const escalatedCount = convData.filter((r) => r.escalated).length;
    const resolvedCount = convData.filter((r) => r.resolved).length;
    const escalationRate = totalCount > 0 ? (escalatedCount / totalCount) * 100 : 0;
    const resolutionRate = totalCount > 0 ? (resolvedCount / totalCount) * 100 : 0;

    // ── 月別推移 ──────────────────────────────────────────────
    const monthlyMap: Record<string, number> = {};
    for (const row of trendConvs.data ?? []) {
      const m = toJstDateStr(row.started_at).slice(0, 7); // YYYY-MM (JST)
      monthlyMap[m] = (monthlyMap[m] ?? 0) + 1;
    }
    const monthlyTrend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, count]) => ({ month: m, count }));

    // ── ヒートマップ ──────────────────────────────────────────
    const heatmapMap: Record<string, number> = {};
    for (const row of heatmap.data ?? []) {
      const d = new Date(new Date(row.created_at).getTime() + 9 * 60 * 60 * 1000);
      const key = `${d.getUTCDay()}-${d.getUTCHours()}`;
      heatmapMap[key] = (heatmapMap[key] ?? 0) + 1;
    }
    const heatmapArray = Object.entries(heatmapMap).map(([key, count]) => {
      const [dow, hour] = key.split("-");
      return { day_of_week: Number(dow), hour: Number(hour), count };
    });

    // ── よく聞かれた質問 ──────────────────────────────────────
    const questionMap: Record<string, number> = {};
    for (const row of topQuestions.data ?? []) {
      const content = row.content as string;
      if (content.includes("�") || /[а-яёА-ЯЁЀ-ӿ]/.test(content)) continue; // 文字化けメッセージを除外（音声認識の誤認識など）
      questionMap[content] = (questionMap[content] ?? 0) + 1;
    }
    const topQuestionsRanking = Object.entries(questionMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([content, count]) => ({ content, count }));

    // ── 参照ドキュメント ──────────────────────────────────────
    const docMap: Record<string, { title: string; source_url: string; count: number; last: string }> = {};
    for (const row of topDocs.data ?? []) {
      const titles: string[] = row.retrieved_doc_titles ?? [];
      const sources: string[] = row.retrieved_doc_sources ?? [];
      titles.forEach((title, i) => {
        if (/[а-яёА-ЯЁЀ-ӿ]/.test(title)) return; // 文字化けタイトルを除外
        const src = sources[i] ?? "";
        const key = `${title}__${src}`;
        if (!docMap[key]) docMap[key] = { title, source_url: src, count: 0, last: row.created_at };
        docMap[key].count++;
        if (row.created_at > docMap[key].last) docMap[key].last = row.created_at;
      });
    }
    const topDocsRanking = Object.values(docMap)
      .sort((a, b) => b.count - a.count)
      .map(({ title, source_url, count, last }) => ({
        title,
        source_url,
        reference_count: count,
        last_referenced_at: last,
      }));

    // ── 未参照ドキュメント ────────────────────────────────────
    const referencedSources = new Set(
      (topDocs.data ?? []).flatMap((r) => r.retrieved_doc_sources ?? [])
    );
    const unusedDocList = (unusedDocs.data ?? []).filter((d) => {
      const docUrl = (d.url ?? d.source_url ?? "").trim();
      return docUrl && !referencedSources.has(docUrl);
    });

    // ── 緊急ワード集計 ＋ 日別推移 ───────────────────────────
    const keywordMap: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};
    for (const row of keywords.data ?? []) {
      const kw = row.keyword_matched as string;
      keywordMap[kw] = (keywordMap[kw] ?? 0) + 1;
      const date = toJstDateStr(row.created_at as string); // YYYY-MM-DD (JST)
      dailyMap[date] = (dailyMap[date] ?? 0) + 1;
    }
    // 選択月の全日を 0 で埋める（データなしの日も軸に表示するため）
    const isCurrentMonth = year === nowJst.getUTCFullYear() && month === nowJst.getUTCMonth() + 1;
    const lastDay = isCurrentMonth ? nowJst.getUTCDate() : new Date(year, month, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!(dateKey in dailyMap)) dailyMap[dateKey] = 0;
    }
    const keywordStats = Object.entries(keywordMap)
      .sort(([, a], [, b]) => b - a)
      .map(([keyword, count]) => ({ keyword, count }));
    const dailyEmergencyTrend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => {
        const [, m, dd] = date.split("-");
        return { date: `${Number(m)}/${Number(dd)}`, count };
      });

    // ── カテゴリ分布 ──────────────────────────────────────────
    const catMap: Record<string, number> = {};
    for (const row of categories.data ?? []) {
      const cat = (row.category_id as string | null) ?? "未選択";
      catMap[cat] = (catMap[cat] ?? 0) + 1;
    }
    const categoryDist = Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => ({
        category,
        count,
        percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
      }));

    // ── モード履歴 ────────────────────────────────────────────
    const modeHistoryData = (modeHistory.data ?? []).map((row) => ({
      mode: row.mode as string,
      started_at: row.started_at as string,
      ended_at: row.ended_at as string | null,
    }));

    // ── モデル使用比率 ────────────────────────────────────────
    const modelMap: Record<string, number> = {};
    for (const row of modelUsageRows.data ?? []) {
      const m = (row.model_used as string | null) ?? "unknown";
      modelMap[m] = (modelMap[m] ?? 0) + 1;
    }
    const flashLiteCount = modelMap["gemini-2.5-flash-lite"] ?? 0;
    const flashCount     = modelMap["gemini-2.5-flash"] ?? 0;
    const modelTotal     = flashLiteCount + flashCount;
    const modelUsage = {
      flashLite:     flashLiteCount,
      flash:         flashCount,
      flashLiteRate: modelTotal > 0 ? Math.round((flashLiteCount / modelTotal) * 1000) / 10 : 0,
    };

    // ── キャッシュ統計 ────────────────────────────────────────
    const cacheRows = cacheStatsRows.data ?? [];
    const hitCount   = cacheRows.filter((r) => r.cache_hit).length;
    const savedTokens = cacheRows.reduce((s, r) => s + (Number(r.cache_read_tokens) || 0), 0);
    const cacheStats = {
      hitCount,
      hitRate:     cacheRows.length > 0 ? Math.round((hitCount / cacheRows.length) * 1000) / 10 : 0,
      savedTokens,
    };

    // ── コスト統計 ────────────────────────────────────────────
    const costRows = costStatsRows.data ?? [];
    const totalCostJpy  = costRows.reduce((s, r) => s + (Number(r.estimated_cost_jpy) || 0), 0);
    const avgCostPerChat = costRows.length > 0 ? totalCostJpy / costRows.length : 0;

    // 月末までの推定（日割り外挿）
    const now2 = new Date();
    const daysInMonth   = new Date(year, month, 0).getDate();
    const daysPassed    = year === now2.getFullYear() && month === now2.getMonth() + 1
      ? now2.getDate()
      : daysInMonth;
    const estimatedMonthly = daysPassed > 0
      ? Math.round((totalCostJpy / daysPassed) * daysInMonth)
      : totalCostJpy;

    const costStats = {
      totalCostJpy:     Math.round(totalCostJpy * 10) / 10,
      avgCostPerChat:   Math.round(avgCostPerChat * 1000) / 1000,
      estimatedMonthly,
    };
    // ── リクエスト残量（旭川ガス向け。今月のユーザーメッセージ数=リクエスト数） ──
    const requestUsed = curMonthRequestCount.count ?? 0;
    const requestRemaining = Math.max(MONTHLY_REQUEST_QUOTA - requestUsed, 0);
    const nextMonthFirstDayJst = new Date(Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth() + 1, 1));
    const requestResetDate = `${nextMonthFirstDayJst.getUTCFullYear()}-${String(nextMonthFirstDayJst.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const requestQuota = {
      used: requestUsed,
      total: MONTHLY_REQUEST_QUOTA,
      remaining: requestRemaining,
      resetDate: requestResetDate,
    };

    // ── 音声入力比率 ──────────────────────────────────────────
    const inputMethodRowsData = inputMethodRows.data ?? [];
    const voiceCount = inputMethodRowsData.filter((r) => r.input_method === "voice").length;
    const textCount = inputMethodRowsData.length - voiceCount;
    const inputMethodStats = {
      voice: voiceCount,
      text: textCount,
      voiceRate: inputMethodRowsData.length > 0
        ? Math.round((voiceCount / inputMethodRowsData.length) * 1000) / 10
        : 0,
    };

    return NextResponse.json({
      summary: {
        total_count: totalCount,
        escalated_count: escalatedCount,
        resolved_count: resolvedCount,
        escalation_rate: Math.round(escalationRate * 10) / 10,
        resolution_rate: Math.round(resolutionRate * 10) / 10,
      },
      monthly_trend: monthlyTrend,
      heatmap: heatmapArray,
      top_questions: topQuestionsRanking,
      top_docs: topDocsRanking,
      unused_docs: unusedDocList,
      keyword_stats: keywordStats,
      category_distribution: categoryDist,
      mode_history: modeHistoryData,
      daily_emergency_trend: dailyEmergencyTrend,
      // 運用コストに関わる情報（モデル使用比率・キャッシュ統計・APIコスト）はクウェスト社内アカウントのみに表示
      model_usage: isQuest ? modelUsage : undefined,
      cache_stats: isQuest ? cacheStats : undefined,
      cost_stats: isQuest ? costStats : undefined,
      // 旭川ガス側は金額・モデル名を出さず、リクエスト残量のみ表示
      request_quota: isQuest ? undefined : requestQuota,
      input_method_stats: inputMethodStats,
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}

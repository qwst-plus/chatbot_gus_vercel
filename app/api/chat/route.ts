// app/api/chat/route.ts
// 埋め込み: OpenAI text-embedding-3-small
// 回答生成: AI SDK 経由（Google Gemini）
// 対象: asahikawa-gas.co.jp（クライアント設定ファイルで切替可）

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { generateText, type ModelMessage } from "ai";
import type { GoogleGenerativeAIProviderMetadata } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";
import {
  startConversation,
  logUserMessage,
  logAssistantMessage,
  escalateConversation,
} from "@/lib/log";
import { getClientConfig } from "@/lib/getClientConfig";
import { calcComplexityScore, estimateCostJpy, getSmartRoutingThreshold } from "@/lib/smartRouting";
import { applyAutocut } from "@/lib/autocut";
import { fuseHybridResults } from "@/lib/hybridSearch";
import { getSystemPromptTemplate, renderSystemPromptTemplate } from "@/lib/systemPrompt";
import { getEmergencyKeywords } from "@/lib/emergencyKeywords";
import { buildModel, getModelId } from "@/lib/aiProvider";
import { decryptSecret } from "@/lib/settingsCrypto";
import type { ConversationMode, ClientConfig, ChatRequest, ChatResponse } from "@/types/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

function mustEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

type ClientMsg = { role: "user" | "assistant"; content: string };

// リクエストボディ（後方互換のため既存フィールドも残す）
type ChatBody = Partial<ChatRequest> & {
  question?: string;
  message?: string;
  top_k?: number;
  messages?: ClientMsg[];
  scenario_context?: string;    // シナリオエンジン: 現在のノード文脈
};

// ---- OpenAI（埋め込みのみ）----
const openai = new OpenAI({ apiKey: mustEnv("OPENAI_API_KEY") });

// ---- Supabase（ベクター検索）----
const SUPABASE_URL = env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL") ?? "";
if (!SUPABASE_URL) throw new Error("SUPABASE_URL is missing");

const SUPABASE_KEY =
  env("SUPABASE_SERVER_KEY") ??
  env("SUPABASE_SERVICE_ROLE_KEY") ??
  env("SUPABASE_ANON_KEY") ??
  env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
  "";
if (!SUPABASE_KEY) throw new Error("SUPABASE key is missing");

console.log("[debug] SUPABASE_URL:", SUPABASE_URL);
console.log("[debug] SUPABASE_KEY prefix:", SUPABASE_KEY.slice(0, 30));

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const RPC_NAME = env("SUPABASE_MATCH_RPC") ?? "match_documents";
const KEYWORD_RPC_NAME = env("SUPABASE_KEYWORD_RPC") ?? "match_documents_keyword";
const MATCH_THRESHOLD = Number(env("SUPABASE_MATCH_THRESHOLD") ?? "0");
const GEMINI_KEY_SETTING = "gemini_api_key";

// 設定画面（/apikey）で保存されたGemini API Keyがあれば復号して返す。
// 未設定・復号失敗時はundefined（buildModel側で環境変数GEMINI_API_KEYにフォールバックする）
async function getCustomGeminiApiKey(): Promise<string | undefined> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", GEMINI_KEY_SETTING)
    .maybeSingle();
  if (!data?.value) return undefined;
  try {
    return decryptSecret(data.value);
  } catch (e) {
    console.warn("[chat] Gemini API Keyの復号に失敗、環境変数にフォールバックします:", e);
    return undefined;
  }
}

// ============================================================
// RAGコア（埋め込み・検索）
// ============================================================

async function embedQuery(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding as unknown as number[];
}

type Retrieved = {
  id: string;
  text: string;
  source: string;
  title: string;
  similarity: number;
  category: string[];
};

function mapRows(
  rows: Record<string, unknown>[],
  sourceUrlMap: Record<string, string>,
  simKey: "similarity" | "keyword_similarity"
): Retrieved[] {
  return rows
    .map((row) => {
      const text = String(
        row.content ?? row.text ?? row.chunk ?? row.body ?? ""
      ).trim();
      const rowId = String(row.id ?? "");
      // || で空文字も無視して source_url フォールバックまで到達させる
      const source = (
        String(row.source || row.url || row.source_url || row.path || "").trim() ||
        sourceUrlMap[rowId] ||
        ""
      );
      const title = String(row.title ?? source).trim();
      const similarity = Number(row[simKey] ?? row.score ?? 0);
      const category = Array.isArray(row.category) ? row.category.map(String) : [];
      return { id: rowId, text, source, title, similarity, category };
    })
    .filter((r) => r.text.length > 0);
}

// モードに応じてcategoryフィルタを切り替え、ベクター検索とキーワード（trigram）検索を
// 並列実行してハイブリッドに統合する
async function searchSupabase(
  query: string,
  topK: number,
  mode: ConversationMode
): Promise<Retrieved[]> {
  const qEmb = await embedQuery(query);

  const vectorArgs: Record<string, unknown> = {
    query_embedding: qEmb,
    match_count: topK,
  };
  if (MATCH_THRESHOLD > 0) vectorArgs.match_threshold = MATCH_THRESHOLD;

  const keywordArgs: Record<string, unknown> = {
    query_text: query,
    match_count: topK,
  };

  // emergencyモードは緊急カテゴリのドキュメントのみ検索
  if (mode === "emergency") {
    vectorArgs.filter_category = "emergency";
    keywordArgs.filter_category = "emergency";
  }

  const [vectorRes, keywordRes] = await Promise.all([
    supabase.rpc(RPC_NAME, vectorArgs),
    supabase.rpc(KEYWORD_RPC_NAME, keywordArgs),
  ]);

  if (vectorRes.error) throw new Error(`supabase.rpc(${RPC_NAME}) failed: ${vectorRes.error.message}`);

  // キーワードRPC（match_documents_keyword）はマイグレーション未適用でも
  // チャット自体が壊れないよう、失敗時はベクター検索のみにフォールバックする
  if (keywordRes.error) {
    console.warn(`[hybrid] ${KEYWORD_RPC_NAME} failed, falling back to vector-only:`, keywordRes.error.message);
  }

  const vectorRows = (vectorRes.data ?? []) as Record<string, unknown>[];
  const keywordRows = keywordRes.error ? [] : ((keywordRes.data ?? []) as Record<string, unknown>[]);

  // RPC が source_url を返さない場合、documents テーブルから補完する（両方の結果の和集合で1回）
  const ids = [
    ...new Set(
      [...vectorRows, ...keywordRows].map((r) => String(r.id ?? "")).filter(Boolean)
    ),
  ];
  let sourceUrlMap: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: docData } = await supabase
      .from("documents")
      .select("id, url, source_url")
      .in("id", ids);
    sourceUrlMap = Object.fromEntries(
      (docData ?? []).map((d) => [String(d.id), String(d.url || d.source_url || "")])
    );
  }

  const vectorRetrieved = mapRows(vectorRows, sourceUrlMap, "similarity");
  const keywordRetrieved = mapRows(keywordRows, sourceUrlMap, "keyword_similarity");

  return fuseHybridResults(vectorRetrieved, keywordRetrieved).slice(0, topK);
}

function lastUserFromHistory(body: ChatBody): string {
  const direct = String(body.message ?? body.question ?? "").trim();
  if (direct) return direct;
  if (Array.isArray(body.messages) && body.messages.length) {
    const lastUser = [...body.messages].reverse().find((m) => m?.role === "user");
    return String(lastUser?.content ?? "").trim();
  }
  return "";
}

function normalizeHistory(body: ChatBody, maxTurns = 60): ClientMsg[] {
  const raw = Array.isArray(body.messages) ? body.messages : [];
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 4000) }))
    .filter((m) => m.content.trim().length > 0)
    .slice(-maxTurns);
}

// ============================================================
// システムプロンプト生成（クライアント設定・モード対応）
// ============================================================

function buildSystemPrompt(
  promptTemplate: string,
  categoryId: string | null,
  mode: ConversationMode,
  config: ClientConfig,
  scenarioContext?: string
): string {
  const base = renderSystemPromptTemplate(promptTemplate, {
    clientId: config.clientId,
    phone: config.phoneNumbers.normal,
    businessHours: config.businessHours,
  });

  const categoryContext = categoryId
    ? `\nこのユーザーは「${categoryId}」に関心があります。`
    : "";

  const emergencyContext =
    mode === "emergency"
      ? `\n\n【緊急事態対応モード】
現在、緊急事態が発生している可能性があります。
避難・安全確保に関する情報を最優先で案内してください。
緊急連絡先：${config.phoneNumbers.emergency}（24時間対応）`
      : mode === "notice"
      ? `\n\n【注意報モード】
現在、注意報が発令されています。
通常の案内に加え、安全に関する情報も合わせて案内してください。`
      : "";

  const scenarioContextStr = scenarioContext
    ? `\n\n【現在の手続き文脈】\nユーザーは「${scenarioContext}」の手続き中に質問しています。\nこの文脈を踏まえて、手続きに関連した回答を優先してください。`
    : "";

  return base + categoryContext + emergencyContext + scenarioContextStr;
}

// ============================================================
// AI SDKメッセージ構築
// ============================================================

function buildAiMessages(opts: {
  question: string;
  history: ClientMsg[];
  contexts: { text: string; source: string }[];
}): ModelMessage[] {
  const { question, history, contexts } = opts;

  const ragContext = contexts.length > 0
    ? contexts.map((c) => `source: ${c.source}\n${c.text}`.trim()).join("\n\n")
    : "(資料なし)";

  const historyMessages: ModelMessage[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const lastUserMessage: ModelMessage = {
    role: "user",
    content: `# 資料\n${ragContext}\n\n# 今回の質問\n${question}\n\n# 回答（日本語）\n`,
  };

  return [...historyMessages, lastUserMessage];
}

// ============================================================
// POST /api/chat
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatBody;

    const q = lastUserFromHistory(body);
    if (!q) {
      return NextResponse.json(
        { error: "message (or question) is required" },
        { status: 400 }
      );
    }

    const topK = Math.max(1, Math.min(Number(body.top_k ?? 20), 60));
    const clientId = body.client_id ?? env("NEXT_PUBLIC_CLIENT_ID") ?? "asahikawa-gas";
    const mode: ConversationMode = body.mode ?? "normal";
    const sessionId = body.session_id ?? crypto.randomUUID();

    // ── クライアント設定取得 ──────────────────────────────────
    const config = await getClientConfig(clientId);

    // ── 1) RAG検索（モードによってカテゴリフィルタを切替）────
    const rawRetrieved = await searchSupabase(q, topK, mode);
    // 外れ値除外（オートカット）: 類似度スコアの大きなギャップでノイズの多い末尾チャンクを打ち切る
    const retrieved = applyAutocut(rawRetrieved);
    if (retrieved.length !== rawRetrieved.length) {
      console.log(
        `[Autocut] ${rawRetrieved.length} → ${retrieved.length} chunks (top1 sim=${rawRetrieved[0]?.similarity.toFixed(3)})`
      );
    }

    // ── 2) 会話履歴 ──────────────────────────────────────────
    const history = normalizeHistory(body, 60);
    const sessionTurns = Math.floor(history.length / 2) + 1;

    // ── 3) エスカレーション判定（設定画面で上書き可能なキーワードを使用）──
    const emergencyKeywords = await getEmergencyKeywords(config.emergencyKeywords);
    const matchedKeyword =
      emergencyKeywords.find((kw) => q.includes(kw)) ?? null;
    const confidenceScore = retrieved.length > 0 ? retrieved[0].similarity : 0;
    const isLowConfidence = confidenceScore < 0.5 && retrieved.length > 0;

    // ── カテゴリ自動判定 ──────────────────────────────────────
    // 緊急キーワードにマッチ → キーワード名をそのままカテゴリに（例: "ガス漏れ"）
    // それ以外 → topicKeywords でトピック分類（例: "料金・請求"）
    // どれにも該当しない → "その他"
    let autoCategory: string;
    if (matchedKeyword) {
      autoCategory = matchedKeyword;
    } else {
      const matchedTopic = config.topicKeywords.find((t) =>
        t.keywords.some((kw) => q.includes(kw))
      );
      autoCategory = matchedTopic?.label ?? "その他";
    }
    // クライアントからのcategory_idが文字化け（不正なバイト列がU+FFFDに置換された状態）の場合は
    // ダッシュボードに文字化けカテゴリが表示されないよう、自動判定側にフォールバックする
    const isCorrupted = typeof body.category_id === "string" && body.category_id.includes("�");
    const categoryId = !isCorrupted && body.category_id ? body.category_id : autoCategory;

    // ── 4) システムプロンプト生成 ─────────────────────────────
    const promptTemplate = await getSystemPromptTemplate();
    const systemPrompt = buildSystemPrompt(promptTemplate, categoryId, mode, config, body.scenario_context);

    // ── 5) スマートルーティング ───────────────────────────────
    const complexityScore = calcComplexityScore(q, retrieved, sessionTurns);
    const routingThreshold = await getSmartRoutingThreshold();
    const tier = complexityScore > routingThreshold ? "smart" : "fast";
    const customApiKey = await getCustomGeminiApiKey();
    const model = buildModel(tier, customApiKey);
    const modelId = getModelId(tier);

    // ── 6) 回答生成（AI SDK・Gemini）──────────────────────────
    const aiMessages = buildAiMessages({
      question: q,
      history,
      contexts: retrieved.map((r) => ({ text: r.text, source: r.source })),
    });

    const startMs = Date.now();
    const { text: rawAnswer, usage, providerMetadata } = await generateText({
      model,
      system: systemPrompt,
      messages: aiMessages,
      maxOutputTokens: 2048,
      // Gemini 2.5系はThinkingモデルのためbudget=0で無効化（textを正常取得するため）
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    });
    const responseMs = Date.now() - startMs;

    // ── コスト推計 ─────────────────────────────────────────────
    // Gemini の暗黙キャッシュ利用状況（Google側で自動キャッシュされた場合のみ値が入る）
    const googleMetadata = providerMetadata?.google as GoogleGenerativeAIProviderMetadata | undefined;
    const cacheReadTokens = googleMetadata?.usageMetadata?.cachedContentTokenCount ?? 0;
    const cacheHit = cacheReadTokens > 0;
    const estimatedCostJpy = estimateCostJpy(
      modelId,
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
      cacheReadTokens,
    );

    console.log(`[SmartRouting] complexity_score: ${complexityScore.toFixed(2)}, model: ${modelId}`);
    console.log(`[Cost] estimated_cost_jpy: ${estimatedCostJpy}`);
    console.log(`[DEBUG] rawAnswer length: ${rawAnswer.length}, preview: "${rawAnswer.slice(0, 100)}"`);

    const answer = rawAnswer
      .replace(/\[#\d+\]/g, "")
      .replace(/[^\S\n]{2,}/g, " ") // 改行以外の連続空白（スペース・タブ）だけを1個に整形
      .replace(/\n{3,}/g, "\n\n")   // 3行以上の空行は2行までに圧縮
      .trim();

    // ── 7) ログ書き込み ───────────────────────────────────────
    let conversationId = body.conversation_id ?? null;
    let messageId = "";

    try {
      if (!conversationId) {
        conversationId = await startConversation({
          sessionId,
          clientId,
          categoryId,
          mode,
        });
      }

      await logUserMessage({ conversationId, content: q, inputMethod: body.input_method ?? "text" });

      if (matchedKeyword) {
        await escalateConversation({ conversationId, escalateType: "keyword" });
      }

      messageId = await logAssistantMessage({
        conversationId,
        content: answer,
        confidenceScore,
        keywordMatched: matchedKeyword,
        retrievedDocIds: rawRetrieved.map((r) => r.id).filter(Boolean),
        retrievedDocTitles: rawRetrieved.map((r) => r.title),
        retrievedDocSources: rawRetrieved.map((r) => r.source),
        responseMs,
        unresolved: isLowConfidence && !matchedKeyword,
        modelUsed: modelId,
        complexityScore,
        cacheHit,
        cacheReadTokens,
        estimatedCostJpy,
      });
    } catch (logErr) {
      console.error("[log] failed:", logErr);
    }

    // ── 8) レスポンス ─────────────────────────────────────────
    // エリア判定: ユーザーの質問に旭川/江別が含まれるか
    const mentionsEbetsu    = q.includes("江別");
    const mentionsAsahikawa = q.includes("旭川");
    // タイトルが「江別地区」または「（江別）」専用ページかを判定
    // 「江別地区」または「（江別）」を含むが「旭川・江別」のような両エリア共通ページは除かない
    const isEbetsuOnly = (title: string) =>
      /江別地区|（江別）[^・]|（江別）$/.test(title);

    const response: ChatResponse = {
      message_id: messageId,
      conversation_id: conversationId ?? "",
      answer,
      confidence_score: confidenceScore,
      // 有効なURLを持つ結果から重複排除・エリアフィルタ・最高類似度の1件のみ返す
      // （オートカット前のrawRetrievedを使用。カット後だけを対象にすると、上位がエリア不一致で
      //   フィルタされた場合に本来引用できたはずのドキュメントが枯渇するおそれがあるため）
      retrieved_docs: rawRetrieved
        .filter((r) => r.source.startsWith("http"))
        // エリア未指定 or 旭川指定のとき → 江別専用ページを除外
        .filter((r) => {
          if (mentionsEbetsu) return true;
          if (mentionsAsahikawa || (!mentionsEbetsu && !mentionsAsahikawa)) {
            return !isEbetsuOnly(r.title);
          }
          return true;
        })
        .filter((r, i, arr) => arr.findIndex((x) => x.source === r.source) === i)
        .slice(0, 1)
        .map((r) => ({
          id: r.id,
          title: r.title,
          source: r.source,
        })),
      escalated: !!matchedKeyword,
      keyword_matched: matchedKeyword,
      response_ms: responseMs,
    };

    return NextResponse.json({
      ...response,
      form_urls: config.formUrls ?? [],
      // デバッグ用メタ情報
      meta: {
        top_k: topK,
        rpc: RPC_NAME,
        hits: retrieved.length,
        raw_hits: rawRetrieved.length,
        mode,
        client_id: clientId,
        provider: "google",
        model: modelId,
        complexity_score: complexityScore,
        cache_hit: cacheHit,
        cache_read_tokens: cacheReadTokens,
        estimated_cost_jpy: estimatedCostJpy,
      },
    });
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    const msg = `${err?.name ?? "Error"}: ${err?.message ?? String(e)}`;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// lib/log.ts
// Supabase conversations/messages テーブルへのログ書き込みライブラリ
// サービスロールキーを使用してRLSをバイパスする（サーバーサイド専用）

import { supabaseAdmin } from "./supabase";
import type { ConversationMode, EscalateType, InputMethod } from "@/types/log";

// ── セッション開始 ─────────────────────────────────────────────
export async function startConversation(params: {
  sessionId: string;
  clientId: string;
  categoryId: string | null;
  mode: ConversationMode;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      session_id: params.sessionId,
      client_id: params.clientId,
      category_id: params.categoryId,
      mode: params.mode,
    })
    .select("id")
    .single();

  if (error) throw new Error(`startConversation failed: ${error.message}`);
  return data.id as string;
}

// ── ユーザーメッセージ記録 ──────────────────────────────────────
export async function logUserMessage(params: {
  conversationId: string;
  content: string;
  inputMethod?: InputMethod; // 未指定時は "text" として扱う
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      role: "user",
      content: params.content,
      content_length: params.content.length,
      input_method: params.inputMethod ?? "text",
    })
    .select("id")
    .single();

  if (error) throw new Error(`logUserMessage failed: ${error.message}`);
  return data.id as string;
}

// ── Bot回答記録 ────────────────────────────────────────────────
export async function logAssistantMessage(params: {
  conversationId: string;
  content: string;
  confidenceScore: number;
  keywordMatched: string | null;
  retrievedDocIds: string[];
  retrievedDocTitles: string[];
  retrievedDocSources: string[];
  responseMs: number;
  unresolved: boolean;
  // スマートルーティング・プロンプトキャッシュ統計（オプション）
  modelUsed?: string;
  complexityScore?: number;
  cacheHit?: boolean;
  cacheReadTokens?: number;
  estimatedCostJpy?: number;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      role: "assistant",
      content: params.content,
      confidence_score: params.confidenceScore,
      keyword_matched: params.keywordMatched,
      retrieved_doc_ids: params.retrievedDocIds.length > 0 ? params.retrievedDocIds : null,
      retrieved_doc_titles: params.retrievedDocTitles.length > 0 ? params.retrievedDocTitles : null,
      retrieved_doc_sources: params.retrievedDocSources.length > 0 ? params.retrievedDocSources : null,
      response_ms: params.responseMs,
      unresolved: params.unresolved,
      model_used: params.modelUsed,
      complexity_score: params.complexityScore,
      cache_hit: params.cacheHit,
      cache_read_tokens: params.cacheReadTokens,
      estimated_cost_jpy: params.estimatedCostJpy,
    })
    .select("id")
    .single();

  if (error) throw new Error(`logAssistantMessage failed: ${error.message}`);
  return data.id as string;
}

// ── フィードバック：解決した ────────────────────────────────────
export async function resolveFeedback(params: {
  conversationId: string;
  messageId: string;
}): Promise<void> {
  const now = new Date().toISOString();

  const [msgResult, convResult] = await Promise.all([
    supabaseAdmin
      .from("messages")
      .update({ feedback: 1, feedback_at: now })
      .eq("id", params.messageId),
    supabaseAdmin
      .from("conversations")
      .update({ resolved: true, resolved_at: now, resolved_method: "feedback_positive" })
      .eq("id", params.conversationId),
  ]);

  if (msgResult.error) throw new Error(`resolveFeedback(message) failed: ${msgResult.error.message}`);
  if (convResult.error) throw new Error(`resolveFeedback(conversation) failed: ${convResult.error.message}`);
}

// ── フィードバック：解決しなかった ─────────────────────────────
export async function escalateFeedback(params: {
  conversationId: string;
  messageId: string;
}): Promise<void> {
  const now = new Date().toISOString();

  const [msgResult, convResult] = await Promise.all([
    supabaseAdmin
      .from("messages")
      .update({ feedback: -1, feedback_at: now, unresolved: true })
      .eq("id", params.messageId),
    supabaseAdmin
      .from("conversations")
      .update({ escalated: true, escalate_type: "manual" })
      .eq("id", params.conversationId),
  ]);

  if (msgResult.error) throw new Error(`escalateFeedback(message) failed: ${msgResult.error.message}`);
  if (convResult.error) throw new Error(`escalateFeedback(conversation) failed: ${convResult.error.message}`);
}

// ── エスカレーション記録（キーワード検知・信頼度低） ──────────
export async function escalateConversation(params: {
  conversationId: string;
  escalateType: EscalateType;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("conversations")
    .update({ escalated: true, escalate_type: params.escalateType })
    .eq("id", params.conversationId);

  if (error) throw new Error(`escalateConversation failed: ${error.message}`);
}

// ── 自動タイムアウト（2分間入力なし）──────────────────────────
export async function autoResolve(params: {
  conversationId: string;
}): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("conversations")
    .update({ resolved: true, resolved_at: now, resolved_method: "auto_timeout" })
    .eq("id", params.conversationId);

  if (error) throw new Error(`autoResolve failed: ${error.message}`);
}

// ── セッション終了 ──────────────────────────────────────────────
export async function endConversation(params: {
  conversationId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("conversations")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", params.conversationId);

  if (error) throw new Error(`endConversation failed: ${error.message}`);
}

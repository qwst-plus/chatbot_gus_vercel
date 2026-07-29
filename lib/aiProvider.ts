// lib/aiProvider.ts
// Gemini（Google）モデルのビルド用ユーティリティ
// AI_MODEL 環境変数でモデルIDを上書き可能
//
// このファイルはDB/Supabaseに依存しない（frontend/scripts/*.mjs から
// Next.jsのbundlerなしで直接importして再利用しているため。
// eval-retrieval.mjs / backfill-categories.mjs 参照）。
// 設定画面（/apikey）で保存されたAPIキーの取得・復号は呼び出し側（route.ts）が行い、
// 結果をapiKey引数として渡す。

import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

const GOOGLE_MODELS = {
  fast:  "gemini-2.5-flash-lite",
  smart: "gemini-2.5-flash",
} as const;

/** 使用するモデルIDを返す（AI_MODEL 環境変数で上書き可） */
export function getModelId(tier: "fast" | "smart"): string {
  return process.env.AI_MODEL ?? GOOGLE_MODELS[tier];
}

/**
 * LanguageModelV1 インスタンスを返す。
 * apiKey を渡した場合はそれを使う（設定画面で保存されたキー用）。
 * 省略時は @ai-sdk/google のデフォルト挙動（環境変数 GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY）を使う。
 */
export function buildModel(tier: "fast" | "smart", apiKey?: string): LanguageModel {
  const modelId = getModelId(tier);
  if (apiKey) {
    return createGoogleGenerativeAI({ apiKey })(modelId);
  }
  return google(modelId);
}

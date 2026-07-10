// lib/aiProvider.ts
// Gemini（Google）モデルのビルド用ユーティリティ
// AI_MODEL 環境変数でモデルIDを上書き可能

import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

const GOOGLE_MODELS = {
  fast:  "gemini-2.5-flash-lite",
  smart: "gemini-2.5-flash",
} as const;

/** 使用するモデルIDを返す（AI_MODEL 環境変数で上書き可） */
export function getModelId(tier: "fast" | "smart"): string {
  return process.env.AI_MODEL ?? GOOGLE_MODELS[tier];
}

/** LanguageModelV1 インスタンスを返す */
export function buildModel(tier: "fast" | "smart"): LanguageModel {
  return google(getModelId(tier));
}

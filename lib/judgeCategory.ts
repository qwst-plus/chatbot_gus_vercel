// lib/judgeCategory.ts
// チャンク化後にGeminiでemergencyカテゴリを自動判定する。
// クライアント設定のcategoryPromptを使い、業種固有のemergency定義に対応する。

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getClientConfig } from "./getClientConfig";
import type { CategoryTag } from "@/types/log";

const MODEL_ID = process.env.AI_MODEL ?? "gemini-2.5-flash";

const BASE_INSTRUCTION = `あなたはテキスト分類AIです。
指示に従って「normal」「emergency」「both」の1単語のみで回答してください。
余計な説明は不要です。`;

export async function judgeCategory(
  chunk: string,
  clientId: string
): Promise<CategoryTag[]> {
  const config = await getClientConfig(clientId);

  const { text } = await generateText({
    model: google(MODEL_ID),
    system: BASE_INSTRUCTION,
    maxOutputTokens: 10,
    messages: [
      {
        role: "user",
        content: `${config.categoryPrompt.trim()}\n\nテキスト：${chunk.slice(0, 500)}`,
      },
    ],
  });

  const raw = text.trim().toLowerCase();

  if (raw === "both")      return ["normal", "emergency"];
  if (raw === "emergency") return ["emergency"];
  return ["normal"];
}

// 複数チャンクをまとめて判定（バッチ処理）
export async function judgeCategories(
  chunks: string[],
  clientId: string
): Promise<CategoryTag[][]> {
  return Promise.all(chunks.map((chunk) => judgeCategory(chunk, clientId)));
}

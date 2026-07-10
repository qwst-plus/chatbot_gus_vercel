// app/api/voice/route.ts
// 音声入力（Whisper API）: 音声ファイルを受け取りテキストに変換する
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { VoiceResponse } from "@/types/log";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// フィラーワード除去（Whisperプロンプトで取り切れなかった分を正規表現で除去）
const FILLER_WORDS_RE = /あー+|えっと+|うーん+|えー+|んー+/g;

// POST /api/voice
// Content-Type: multipart/form-data
// body: { audio: File }
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "音声ファイルがありません" },
        { status: 400 }
      );
    }

    const startMs = Date.now();

    // Whisper APIに送信（language: 'ja' で日本語精度を向上）
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "ja",
      prompt:
        "フィラーワード（あー、えっと、うーん、えー、んー）は除去してください。ガス、料金、開栓、閉栓、ガス漏れ、一酸化炭素などのガス関連用語が含まれる場合があります。",
    });

    // 後処理：プロンプトで取れなかったフィラーワードを正規表現で除去
    const cleanText = transcription.text
      .replace(FILLER_WORDS_RE, "")
      .replace(/\s+/g, " ")
      .trim();

    const durationMs = Date.now() - startMs;

    return NextResponse.json({
      text: cleanText,
      duration_ms: durationMs,
    } satisfies VoiceResponse);
  } catch (error) {
    console.error("Whisper API エラー:", error);
    return NextResponse.json(
      { error: "音声認識に失敗しました" },
      { status: 500 }
    );
  }
}

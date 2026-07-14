// app/chat/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import ChatContainer from "@/components/ChatContainer";
import ChatBubble from "@/components/ChatBubble";
import ChatInput from "@/components/ChatInput";
import TypingDots from "@/components/TypingDots";

type Msg = {
  role: "user" | "assistant";
  content: string;
  messageId?: string;
  conversationId?: string;
  feedback?: 1 | -1;
};

type EarthquakeStatus = {
  is_active: boolean;
  intensity: string | null;
  area: string | null;
  detected_at: string | null;
};

// ガス漏れ関連キーワード
const GAS_LEAK_KEYWORDS = ["ガス漏れ", "ガスもれ", "ガスのにおい", "ガスくさい", "ガス臭", "異臭", "くさい"];
const EMERGENCY_PHONE = "旭川市：0166-45-2800 / 江別市：011-385-7913";

// ====== 会話履歴保持（localStorage） ======
const LS_KEY = "rag_chat_messages_v1";
const LS_SESSION_KEY = "rag_chat_session_v1";

// コスト気にしない前提でも、無限に増えると遅くなるので安全上限だけ入れます（必要なら増やしてOK）
const MAX_STORE_TURNS = 200; // 保存するメッセージ数上限
const MAX_SEND_TURNS = 60; // APIに送る履歴数（/api/chat が履歴対応なら活きる）

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const [tab, setTab] = useState<"test" | "embed">("test");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [quakeStatus, setQuakeStatus] = useState<EarthquakeStatus>({ is_active: false, intensity: null, area: null, detected_at: null });

  // UI表示用：API疎通状態
  const [apiStatus, setApiStatus] = useState<"idle" | "connected" | "error">(
    "idle"
  );

  // 自動スクロール
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 地震ステータスポーリング（5分ごと）
  useEffect(() => {
    async function checkQuake() {
      try {
        const res = await fetch("/api/earthquake-status");
        if (res.ok) setQuakeStatus(await res.json() as EarthquakeStatus);
      } catch { /* silent */ }
    }
    checkQuake();
    const id = setInterval(checkQuake, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // ガス漏れキーワード検知（入力中 OR 直近のユーザーメッセージ）
  const lastUserMsg = messages.filter(m => m.role === "user").at(-1)?.content ?? "";
  const showGasAlert = GAS_LEAK_KEYWORDS.some(kw => input.includes(kw) || lastUserMsg.includes(kw));

  // 初回：localStorage から復元
  useEffect(() => {
    const saved = safeJsonParse<Msg[]>(localStorage.getItem(LS_KEY));
    if (Array.isArray(saved) && saved.length) {
      setMessages(saved);
    }
    // セッションID：既存を再利用 or 新規生成
    const savedSession = localStorage.getItem(LS_SESSION_KEY);
    if (savedSession) {
      setSessionId(savedSession);
    } else {
      const newId = crypto.randomUUID();
      setSessionId(newId);
      localStorage.setItem(LS_SESSION_KEY, newId);
    }
  }, []);

  // messages が変わるたびに保存
  useEffect(() => {
    if (!messages.length) {
      localStorage.removeItem(LS_KEY);
      return;
    }
    const trimmed = messages.slice(-MAX_STORE_TURNS);
    localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
  }, [messages]);

  // messages / thinking が変わったら最下部へ
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const sendFeedback = async (index: number, value: 1 | -1) => {
    const msg = messages[index];
    if (!msg.messageId || !msg.conversationId) return;
    setMessages((m) => m.map((x, i) => i === index ? { ...x, feedback: value } : x));
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: msg.conversationId, message_id: msg.messageId, value }),
    }).catch(console.error);
  };

  const clearChat = () => {
    if (thinking) return;
    setMessages([]);
    setInput("");
    setApiStatus("idle");
    localStorage.removeItem(LS_KEY);
    // 「クリア」＝新しい会話の開始 → セッションIDを更新
    const newId = crypto.randomUUID();
    setSessionId(newId);
    localStorage.setItem(LS_SESSION_KEY, newId);
  };

  async function sendMessage() {
    const userMessage = input.trim();
    if (!userMessage || thinking) return;

    setInput("");
    setThinking(true);

    // setState の非同期ズレ対策：ここで「確定した履歴」を作る
    const nextMessages: Msg[] = [...messages, { role: "user", content: userMessage }];

    // UIに反映
    setMessages(nextMessages);

    try {
      const url = "/api/chat";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        // ✅ 会話履歴保持のために messages も一緒に送る
        // ※ 現状の /api/chat が messages を見ない場合でも害はなく、
        //   もし将来 /api/chat 側を履歴対応にしたらそのまま効くようになります。
        body: JSON.stringify({
          message: userMessage,
          top_k: 8,
          messages: nextMessages.slice(-MAX_SEND_TURNS),
          session_id: sessionId,
        }),
      });

      type ChatApiResponse = { answer?: string; message_id?: string; conversation_id?: string; error?: string };
      const data = await res.json().catch(() => ({})) as ChatApiResponse;

      if (!res.ok) {
        const msg = data?.error ?? `API error: ${res.status} ${res.statusText}`;
        setApiStatus("error");
        throw new Error(msg);
      }

      setApiStatus("connected");

      const botReply = data?.answer ?? "回答に失敗しました。";

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: botReply,
          messageId: data?.message_id,
          conversationId: data?.conversation_id,
        },
      ]);
    } catch (e: unknown) {
      console.error(e);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `エラー: ${e instanceof Error ? e.message : String(e)}` },
      ]);
    } finally {
      setThinking(false);
    }
  }

  const apiBadge =
    apiStatus === "connected"
      ? "connected"
      : apiStatus === "error"
      ? "error"
      : "ready";

  // 埋め込みプレビュー：本番の /embed をそのままiframe表示。左メニューを含む
  // 通常レイアウトを画面全体のオーバーレイで覆うだけで、/embed 自体（ログイン不要の
  // 公開ウィジェット）には一切手を加えない。
  if (tab === "embed") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button
            type="button"
            onClick={() => setTab("test")}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            ← テストチャットに戻る
          </button>
          <span className="text-sm font-semibold text-foreground">埋め込みプレビュー</span>
        </div>
        <iframe src="/embed" className="min-h-0 flex-1 border-0" title="埋め込みプレビュー" />
      </div>
    );
  }

  return (
    <ChatContainer>
      {/* 既存コンテナの上に “カード枠” を置く */}
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">RAG Chat</div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">チャット</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setTab("test")}
                className="rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground"
              >
                テストチャット
              </button>
              <button
                type="button"
                onClick={() => setTab("embed")}
                className="rounded-full px-3 py-1 text-muted-foreground hover:bg-accent"
              >
                埋め込みプレビュー
              </button>
            </div>

            <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
              top_k: 8
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground">
              API: {apiBadge}
            </span>

            <button
              type="button"
              onClick={clearChat}
              disabled={thinking || messages.length === 0}
              className="rounded-full border border-border bg-card px-3 py-1 text-muted-foreground disabled:opacity-50"
              title="会話を消去"
            >
              クリア
            </button>
          </div>
        </div>

        {/* Chat panel */}
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Conversation</div>
              <div className="text-xs text-muted-foreground">
                サイトの情報を根拠に回答します
              </div>
            </div>

            {/* 緊急地震バナー */}
            {quakeStatus.is_active && (
              <div className="mb-3 rounded-xl border border-red-300 bg-red-50 p-3 flex items-start gap-3 animate-pulse">
                <span className="text-2xl leading-none">🚨</span>
                <div className="flex-1">
                  <p className="text-red-700 font-bold text-sm">緊急地震情報 — 震度{quakeStatus.intensity}を検知</p>
                  <p className="text-red-600 text-xs mt-0.5">{quakeStatus.area}</p>
                  <p className="text-red-700 text-xs mt-1">
                    ガスメーターが遮断された場合は復帰手順をご確認ください。
                    緊急の場合は <span className="font-bold text-red-800">{EMERGENCY_PHONE}（24時間）</span> へ。
                  </p>
                </div>
              </div>
            )}

            <div className="min-h-[380px] max-h-[60vh] overflow-auto rounded-2xl border border-border bg-muted p-4">
              {messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  例：
                  <span className="text-foreground">
                    「はたらくあさひかわとは？」
                  </span>
                </div>
              ) : null}

              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div key={i}>
                    <ChatBubble role={m.role}>{m.content}</ChatBubble>
                    {m.role === "assistant" && m.messageId && (
                      <div className="flex gap-2 mt-1 ml-1">
                        <button
                          onClick={() => sendFeedback(i, 1)}
                          disabled={!!m.feedback}
                          className={`text-xs px-2 py-1 rounded-lg border transition-colors ${m.feedback === 1 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-border bg-card text-muted-foreground hover:bg-accent"}`}
                        >
                          👍 解決した
                        </button>
                        <button
                          onClick={() => sendFeedback(i, -1)}
                          disabled={!!m.feedback}
                          className={`text-xs px-2 py-1 rounded-lg border transition-colors ${m.feedback === -1 ? "bg-sky-50 border-sky-200 text-sky-700" : "border-border bg-card text-muted-foreground hover:bg-accent"}`}
                        >
                          👎 解決しなかった
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {thinking && (
                  <ChatBubble role="assistant">
                    <TypingDots />
                  </ChatBubble>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input area */}
            <div className="mt-4 rounded-2xl border border-border bg-muted p-3">
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={sendMessage}
                disabled={thinking}
              />

              {/* ガス漏れ緊急アラート */}
              {showGasAlert && (
                <div className="mt-3 rounded-xl border-2 border-red-500 bg-red-50 p-3 flex items-start gap-3">
                  <span className="text-2xl leading-none">⚠️</span>
                  <div>
                    <p className="text-red-700 font-bold text-sm">ガス漏れの疑いがある場合は、すぐにご連絡ください</p>
                    <p className="text-red-800 text-xl font-bold tracking-wider mt-1">{EMERGENCY_PHONE}</p>
                    <p className="text-red-600 text-xs mt-1">24時間受付 ／ 火気厳禁・窓を開けて換気してください</p>
                  </div>
                </div>
              )}

              <div className="mt-2 text-xs text-muted-foreground">
                Enterで送信／Shift+Enterで改行（実装がある場合）
              </div>

              {/* デバッグ表示（必要なら有効化）
              <div className="mt-1 text-[10px] text-muted-foreground">
                保存: {messages.length} / 送信履歴: {outboundMessages.length}
              </div>
              */}
            </div>
          </div>
        </div>
      </ChatContainer>
  );
}

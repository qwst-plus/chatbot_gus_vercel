// components/VoiceInputButton.tsx
"use client";

import { useVoiceInput } from "@/hooks/useVoiceInput";
import type { InputMethod } from "@/types/log";

type Props = {
  onTranscribed: (text: string, inputMethod: InputMethod) => void;
  disabled?: boolean;
  idleBg?: string; // 待機中の背景色（呼び出し側のテーマに合わせる）
};

export function VoiceInputButton({ onTranscribed, disabled = false, idleBg = "#e5e7eb" }: Props) {
  const { isRecording, isProcessing, volumeLevel, error, startRecording } = useVoiceInput(onTranscribed);

  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      {/* マイクボタン：1回押して録音開始・3秒無音で自動停止 */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          startRecording();
        }}
        disabled={disabled || isProcessing}
        aria-label={
          isProcessing
            ? "音声を処理中..."
            : isRecording
            ? "録音中（3秒無音で自動送信）"
            : "音声入力（押して話す・3秒無音で自動送信）"
        }
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          cursor: disabled || isProcessing ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isRecording
            ? `hsl(0, ${60 + volumeLevel * 0.4}%, ${50 - volumeLevel * 0.1}%)`
            : idleBg,
          transition: "background-color 0.1s",
          flexShrink: 0,
        }}
      >
        {isProcessing ? (
          <span style={{ fontSize: 16 }}>⏳</span>
        ) : isRecording ? (
          <span style={{ fontSize: 18 }}>🎤</span>
        ) : (
          <span style={{ fontSize: 18 }}>🎙️</span>
        )}
      </button>

      {/* 録音中：パルスアニメーション */}
      {isRecording && (
        <span
          style={{
            position: "absolute",
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: "50%",
            border: "2px solid #ef4444",
            animation: "voicePulse 1s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 録音中：音量メーター */}
      {isRecording && (
        <div
          style={{
            position: "absolute",
            bottom: -8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 36,
            height: 3,
            backgroundColor: "#e5e7eb",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${volumeLevel}%`,
              backgroundColor: volumeLevel > 20 ? "#22c55e" : "#ef4444",
              transition: "width 0.1s, background-color 0.1s",
            }}
          />
        </div>
      )}

      {/* エラーメッセージ */}
      {error && (
        <p
          role="alert"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            fontSize: 12,
            color: "#ef4444",
            backgroundColor: "white",
            padding: "4px 8px",
            borderRadius: 4,
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            marginBottom: 8,
            zIndex: 10,
          }}
        >
          {error}
        </p>
      )}

      {/* アニメーション定義（スコープを限定して既存CSSと干渉しない） */}
      <style>{`
        @keyframes voicePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

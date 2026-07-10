// hooks/useVoiceInput.ts
// 音声入力フック：マイクボタンを1回押すと録音開始、3秒間無音が続くと自動で録音停止・送信する
"use client";

import { useCallback, useRef, useState } from "react";
import type { InputMethod, VoiceResponse } from "@/types/log";

// 無音検知の設定
const SILENCE_THRESHOLD = 10; // 音量の閾値（0〜255スケール）。周囲が静かな場合は下げる
const SILENCE_DURATION_MS = 3000; // この時間（ミリ秒）無音が続いたら録音停止
const CHECK_INTERVAL_MS = 100; // 音量チェックの間隔（ミリ秒）

type UseVoiceInputReturn = {
  isRecording: boolean;
  isProcessing: boolean;
  volumeLevel: number; // 0〜100の音量レベル（UIのメーター表示に使用）
  error: string | null;
  startRecording: () => Promise<void>;
  cancelRecording: () => void; // 手動キャンセル用（録音中にボタンを再度押した場合）
};

export function useVoiceInput(
  onTranscribed: (text: string, inputMethod: InputMethod) => void
): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<number>(0); // 無音継続時間（ミリ秒）
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isCancelledRef = useRef(false); // キャンセルフラグ

  // iOSとその他でMIMEタイプを分岐
  const getMimeType = (): string => {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIOS) return "audio/mp4";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    return "audio/mp4";
  };

  // リソースを全て解放する共通処理
  const cleanup = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    silenceTimerRef.current = 0;
    setVolumeLevel(0);
  }, []);

  // 録音を停止する（停止後の送信処理は MediaRecorder.onstop 内で行う）
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    cleanup();
  }, [cleanup]);

  // 手動キャンセル（録音中にボタンを再度押した場合）
  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    stopRecording();
  }, [stopRecording]);

  const startRecording = useCallback(async () => {
    // 録音中なら手動キャンセル
    if (isRecording) {
      cancelRecording();
      return;
    }

    try {
      setError(null);
      isCancelledRef.current = false;
      chunksRef.current = [];

      // マイクへのアクセスを要求（HTTPS環境でのみ動作）
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Whisper APIの推奨サンプルレート
        },
      });
      streamRef.current = stream;

      // AudioContext で音量監視を設定（iOSはユーザー操作直後のみ起動可能。ボタンタップで解決）
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // 無音検知ループ
      checkIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        const avgVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVolumeLevel(Math.min(100, Math.round((avgVolume * 100) / 255)));

        if (avgVolume < SILENCE_THRESHOLD) {
          silenceTimerRef.current += CHECK_INTERVAL_MS;
          if (silenceTimerRef.current >= SILENCE_DURATION_MS) {
            stopRecording();
          }
        } else {
          silenceTimerRef.current = 0;
        }
      }, CHECK_INTERVAL_MS);

      const mimeType = getMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // キャンセルされた場合は送信しない
        if (isCancelledRef.current) return;

        setIsProcessing(true);
        try {
          const type = chunksRef.current[0]?.type || "audio/webm";
          const ext = type.includes("mp4") ? "mp4" : "webm";
          const blob = new Blob(chunksRef.current, { type });
          const file = new File([blob], `recording.${ext}`, { type });

          // 無音チェック（100バイト以下は無音とみなす）
          if (file.size < 100) {
            setError("音声が検出されませんでした");
            return;
          }

          const formData = new FormData();
          formData.append("audio", file);

          const res = await fetch("/api/voice", { method: "POST", body: formData });
          if (!res.ok) throw new Error("音声認識に失敗しました");

          const data = (await res.json()) as VoiceResponse;

          if (data.text?.trim()) {
            onTranscribed(data.text.trim(), "voice");
          } else {
            setError("音声を認識できませんでした");
          }
        } catch (err) {
          console.error("音声処理エラー:", err);
          setError("音声の処理に失敗しました");
        } finally {
          setIsProcessing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      cleanup();
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("マイクへのアクセスが拒否されました。ブラウザの設定を確認してください。");
        } else if (err.name === "NotFoundError") {
          setError("マイクが見つかりません。");
        } else {
          setError("マイクの起動に失敗しました。");
        }
      }
    }
  }, [isRecording, cancelRecording, stopRecording, cleanup, onTranscribed]);

  return { isRecording, isProcessing, volumeLevel, error, startRecording, cancelRecording };
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Props = {
  embedPath?: string;
  iconSrc?: string;
};

export default function FloatingChatLauncher({
  embedPath = "/embed",
  iconSrc = "/asahikawagus_chatoboto.png",
}: Props) {
  const [open, setOpen] = useState(false);
  const [emergency, setEmergency] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !emergency) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [emergency]);

  // iframe内のChatWidgetから緊急モード通知を受け取る
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "GUS_EMERGENCY_MODE") {
        setEmergency(true);
        setOpen(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <>
      {/* パネル（/embed をそのまま表示） */}
      <div
        className={[
          "fixed z-[999999]",
          emergency
            ? "inset-0 rounded-none"
            : "right-4 bottom-[112px] w-[440px] h-[660px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-140px)] rounded-[24px]",
          "overflow-hidden shadow-2xl bg-white transition-all duration-300",
          open ? "block" : "hidden",
        ].join(" ")}
      >
        {/* 緊急時は閉じるボタンを非表示、通常時のみ表示 */}
        {!emergency && (
          <button
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 z-[2] w-9 h-9 rounded-full bg-black/10 hover:bg-black/20 transition flex items-center justify-center text-black"
            aria-label="close"
            type="button"
          >
            ✕
          </button>
        )}

        <iframe
          src={embedPath}
          title="Chat"
          className="w-full h-full border-0"
        />
      </div>

      {/* 右下アイコン */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "fixed z-[999999] right-4 bottom-4",
          "w-20 h-20 rounded-full overflow-hidden",
          "bg-white border border-black/5",
          "shadow-2xl active:scale-95 transition",
        ].join(" ")}
        aria-label="open chat"
        type="button"
      >
        <Image
          src={iconSrc}
          alt="Open chat"
          width={80}
          height={80}
          className="w-full h-full object-cover"
          priority
        />
      </button>
    </>
  );
}

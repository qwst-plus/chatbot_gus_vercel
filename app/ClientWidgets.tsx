"use client";
import { usePathname } from "next/navigation";
import FloatingChatLauncher from "@/components/FloatingChatLauncher";
import type { Role } from "@/lib/auth";

const AUTH_PATHS = ["/login", "/forgot-password", "/reset-password"];

export default function ClientWidgets({ role }: { role?: Role }) {
  const pathname = usePathname();
  if (pathname === "/embed") return null; // embedでは出さない
  if (AUTH_PATHS.includes(pathname)) return null; // ログイン関連画面では出さない
  if (role === "asahikawa-gas") return null; // 旭川ガスの管理ツールでは出さない
  if (role === "quest") return null; // questの管理ツールでは出さない（埋め込みプレビューでのみ表示）

  return (
    <FloatingChatLauncher embedPath="/embed" iconSrc="/asahikawagus_chatoboto.png" />
  );
}

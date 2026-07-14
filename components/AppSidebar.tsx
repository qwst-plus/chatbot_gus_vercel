"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, BarChart3, FileText, Globe, KeyRound, MessageSquare, Puzzle, ScrollText, SlidersHorizontal, Users, X } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

// Server Component（layout.tsx）からClient Componentへは関数/クラスを渡せないため、
// アイコンはコンポーネント参照ではなく文字列キーで受け取り、ここで解決する。
const ICONS = {
  puzzle: Puzzle,
  chat: MessageSquare,
  file: FileText,
  globe: Globe,
  chart: BarChart3,
  users: Users,
  key: KeyRound,
  sliders: SlidersHorizontal,
  prompt: ScrollText,
  alert: AlertTriangle,
} as const;

export type IconKey = keyof typeof ICONS;

export type NavItem = {
  title: string;
  href: string;
  icon: IconKey;
  external?: boolean;
};

export function AppSidebar({
  items,
  displayName,
  open,
  onClose,
}: {
  items: NavItem[];
  displayName: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-4 py-6 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-2">
        <Link href="/" className="flex items-center gap-3" onClick={onClose}>
          <Image
            src="/asahikawagus_chatoboto.png"
            alt=""
            width={36}
            height={36}
            className="rounded-full border border-border object-cover"
          />
          <div>
            <div className="text-xs text-muted-foreground">RAG Chatbot</div>
            <div className="text-sm font-semibold text-foreground">管理ダッシュボード</div>
          </div>
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent md:hidden"
          aria-label="メニューを閉じる"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = !item.external && pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noreferrer" : undefined}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-accent text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="font-medium">{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-border px-2 pt-4">
        <div className="text-xs text-muted-foreground">{displayName} でログイン中</div>
        <LogoutButton className="w-full rounded-xl border border-border bg-background px-3 py-2 text-left text-sm hover:bg-accent" />
      </div>
    </aside>
  );
}

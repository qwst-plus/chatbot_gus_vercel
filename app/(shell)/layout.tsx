// app/(shell)/layout.tsx
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import type { NavItem } from "@/components/AppSidebar";
import { verifySessionValue } from "@/lib/auth";
import { getUserById } from "@/lib/credentials";

// 旭川ガスのアカウントには不要（社内の開発・動作確認用）
// 埋め込みプレビューは「チャット」ページ内のタブとして統合済み（独立したナビ項目は持たない）
const internalOnlyItems: NavItem[] = [
  { title: "チャット", href: "/chat", icon: "chat" },
];

const baseItems: NavItem[] = [
  { title: "運用ダッシュボード", href: "/dashboard", icon: "chart" },
  { title: "Webサイト管理", href: "/websites", icon: "globe" },
  { title: "ファイル管理", href: "/ingest", icon: "file" },
];

const accountsItem: NavItem = { title: "アカウント管理", href: "/dashboard/accounts", icon: "users" };

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const sessionCookie = (await cookies()).get("session")?.value;
  const session = await verifySessionValue(sessionCookie);
  const user = session ? await getUserById(session.userId) : null;

  const items: NavItem[] = [
    ...baseItems,
    ...(user?.role === "asahikawa-gas" ? [] : internalOnlyItems),
    ...(user?.is_admin ? [accountsItem] : []),
  ];

  const displayName = user?.name || (user?.role === "asahikawa-gas" ? "旭川ガス" : "クウェスト");

  return (
    <AppShell items={items} displayName={displayName}>
      {children}
    </AppShell>
  );
}

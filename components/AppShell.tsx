"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AppSidebar, type NavItem } from "@/components/AppSidebar";

export function AppShell({
  items,
  displayName,
  children,
}: {
  items: NavItem[];
  displayName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* モバイル用の背景オーバーレイ */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <AppSidebar items={items} displayName={displayName} open={open} onClose={() => setOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* モバイル用の上部バー */}
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-foreground hover:bg-accent"
            aria-label="メニューを開く"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-foreground">管理ダッシュボード</span>
        </div>

        <main className="min-w-0 flex-1 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}

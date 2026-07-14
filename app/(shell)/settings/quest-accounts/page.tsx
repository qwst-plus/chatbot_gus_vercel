"use client";
import { RoleAccountsManager } from "@/components/RoleAccountsManager";

export const dynamic = "force-dynamic";

export default function QuestAccountsPage() {
  return (
    <RoleAccountsManager
      role="quest"
      title="アカウント管理（クウェスト）"
      description="クウェスト社内アカウントを確認・作成・編集・削除できます。"
    />
  );
}

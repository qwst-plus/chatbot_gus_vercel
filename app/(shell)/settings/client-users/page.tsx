"use client";
import { RoleAccountsManager } from "@/components/RoleAccountsManager";

export const dynamic = "force-dynamic";

export default function ClientUsersPage() {
  return (
    <RoleAccountsManager
      role="asahikawa-gas"
      title="クライアントユーザー管理"
      description="旭川ガス側のアカウント（管理者含む）を確認・作成・編集・削除できます。"
    />
  );
}

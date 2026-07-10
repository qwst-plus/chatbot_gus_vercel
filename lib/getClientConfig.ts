// lib/getClientConfig.ts
// クライアント設定ファイルを動的に読み込む。
// 設定ファイルがない場合はデフォルトを使用。
// 新クライアント追加時は config/clients/<client_id>.ts を1枚追加するだけでよい。

import type { ClientConfig } from "@/types/log";
import { clientConfig as defaultConfig } from "@/config/clients/default";

export async function getClientConfig(clientId: string): Promise<ClientConfig> {
  try {
    const mod = await import(`@/config/clients/${clientId}`);
    return mod.clientConfig as ClientConfig;
  } catch {
    // 設定ファイルが存在しない場合はデフォルトを返す
    return defaultConfig;
  }
}

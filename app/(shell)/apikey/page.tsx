// frontend/app/apikey/page.tsx
"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function ApiKey() {
  const [key, setKey] = useState("");
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">API設定</h1>
      <label className="mb-2 block text-sm text-foreground">OpenAI API Key</label>
      <Input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="sk-..."
      />
      <p className="mt-3 text-sm text-muted-foreground">
        ※サンプルでは保存せず見た目だけ。後で Supabase に暗号化保存します。
      </p>
    </div>
  );
}

"use client";

import Image from "next/image";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <Image
            src="/asahikawagus_chatoboto.png"
            alt=""
            width={40}
            height={40}
            className="rounded-full border border-border object-cover"
          />
          <div className="text-sm text-muted-foreground">RAG Chatbot</div>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

// app/(shell)/page.tsx
import Image from "next/image";
import { cookies } from "next/headers";
import { verifySessionValue } from "@/lib/auth";
import { getUserById } from "@/lib/credentials";

export default async function Home() {
  const sessionCookie = (await cookies()).get("session")?.value;
  const session = await verifySessionValue(sessionCookie);
  const user = session ? await getUserById(session.userId) : null;
  const displayName = user?.name || (user?.role === "asahikawa-gas" ? "旭川ガス" : "クウェスト");

  return (
    <div className="px-10 py-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 text-sm text-muted-foreground">おかえりなさい</div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{displayName} さん</h1>
        <p className="mt-3 text-muted-foreground">
          左のメニューから、チャットの動作確認やファイル・Webサイトの管理、運用ダッシュボードの確認ができます。
        </p>

        <div className="mt-10 flex items-center gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <Image
            src="/asahikawagus_chatoboto.png"
            alt=""
            width={64}
            height={64}
            className="rounded-full border border-border object-cover"
          />
          <div>
            <div className="text-base font-semibold text-foreground">困ったときは</div>
            <p className="mt-1 text-sm text-muted-foreground">
              まずは「チャット」でRAGの回答を試してから、必要に応じてファイル・Webサイトを追加してください。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// app/layout.tsx
import "./globals.css";
import { cookies } from "next/headers";
import ClientWidgets from "./ClientWidgets";
import { verifySessionValue } from "@/lib/auth";
import { getUserById } from "@/lib/credentials";

export const metadata = {
  title: "Chatbot",
  description: "RAG Chatbot",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sessionCookie = (await cookies()).get("session")?.value;
  const session = await verifySessionValue(sessionCookie);
  const user = session ? await getUserById(session.userId) : null;

  return (
    <html lang="ja" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <ClientWidgets role={user?.role} />
      </body>
    </html>
  );
}

// lib/email.ts
import { Resend } from "resend";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is missing");
  return new Resend(apiKey);
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const resend = getResendClient();
  const from = process.env.EMAIL_FROM ?? "no-reply@example.com";

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "【RAG Chatbot】パスワード再設定のご案内",
    text:
      `パスワード再設定のリクエストを受け付けました。\n\n` +
      `以下のリンクから新しいパスワードを設定してください（30分間有効）。\n` +
      `${resetUrl}\n\n` +
      `このリクエストに心当たりがない場合は、このメールを破棄してください。`,
  });

  if (error) throw new Error(`Resend送信エラー: ${error.message}`);
}

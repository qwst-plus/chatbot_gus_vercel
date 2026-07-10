// app/api/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveFeedback, escalateFeedback } from "@/lib/log";

// PATCH /api/feedback
// body: { conversation_id, message_id, value: 1 | -1 }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      conversation_id?: string;
      message_id?: string;
      value?: number;
    };

    const { conversation_id, message_id, value } = body;

    if (!conversation_id || !message_id) {
      return NextResponse.json(
        { error: "conversation_id and message_id are required" },
        { status: 400 }
      );
    }
    if (value !== 1 && value !== -1) {
      return NextResponse.json(
        { error: "value must be 1 or -1" },
        { status: 400 }
      );
    }

    if (value === 1) {
      await resolveFeedback({ conversationId: conversation_id, messageId: message_id });
    } else {
      await escalateFeedback({ conversationId: conversation_id, messageId: message_id });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ error: err?.message ?? String(e) }, { status: 500 });
  }
}

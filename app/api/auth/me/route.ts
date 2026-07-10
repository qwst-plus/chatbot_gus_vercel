// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifySessionValue } from "@/lib/auth";
import { getUserById } from "@/lib/credentials";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await verifySessionValue(req.cookies.get("session")?.value);
  if (!session) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ role: user.role, name: user.name, isAdmin: user.is_admin });
}

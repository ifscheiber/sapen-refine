import { NextResponse } from "next/server";
import { getUserFromSessionCookie } from "@/server/auth/session";

export async function GET() {
  const user = await getUserFromSessionCookie();
  if (!user) return NextResponse.json({ ok: false, user: null }, { status: 401 });

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
}

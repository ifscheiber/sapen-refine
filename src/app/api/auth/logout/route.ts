import { NextResponse } from "next/server";
import { clearSessionCookie, revokeSessionFromCookie } from "@/server/auth/session";

export async function POST() {
  await revokeSessionFromCookie();
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

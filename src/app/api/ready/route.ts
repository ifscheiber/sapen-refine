import { NextResponse } from "next/server";

import { checkReadiness } from "@/server/runtime/readiness";

export async function GET() {
  const readiness = await checkReadiness();
  return NextResponse.json(readiness, {
    status: readiness.status === "ok" ? 200 : 503,
  });
}

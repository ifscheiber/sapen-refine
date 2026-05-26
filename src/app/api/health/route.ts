import { NextResponse } from "next/server";

import { getHealthStatus } from "@/server/runtime/health";

export async function GET() {
  return NextResponse.json(getHealthStatus());
}

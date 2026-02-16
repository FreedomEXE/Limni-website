import { NextResponse } from "next/server";

import { getSessionRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const role = await getSessionRole();
  return NextResponse.json({ authenticated: role !== null, role });
}

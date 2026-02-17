import { NextResponse } from "next/server";

import { canAccessMt5Source, getSessionRole, getSessionUsername } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const role = await getSessionRole();
  const username = await getSessionUsername();
  const canAccessSource = await canAccessMt5Source();
  return NextResponse.json({
    authenticated: role !== null,
    role,
    username,
    canAccessSource,
  });
}

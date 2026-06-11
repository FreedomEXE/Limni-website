import { NextResponse } from "next/server";

import { getSessionRole, getSessionUsername } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const role = await getSessionRole();
  const username = await getSessionUsername();
  return NextResponse.json({
    authenticated: role !== null,
    role,
    username,
  });
}

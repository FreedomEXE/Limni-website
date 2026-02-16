import { NextResponse } from "next/server";

import { getSessionRole, getSessionUsername } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const role = await getSessionRole();
  const username = await getSessionUsername();
  const adminUsername = process.env.AUTH_USERNAME || "admin";
  const canAccessSource = role === "admin" && username?.toLowerCase() === adminUsername.toLowerCase();
  return NextResponse.json({
    authenticated: role !== null,
    role,
    username,
    canAccessSource,
  });
}

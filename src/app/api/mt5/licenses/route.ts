import { NextResponse, type NextRequest } from "next/server";

import { createMt5License } from "@/lib/mt5Licensing";

export const runtime = "nodejs";

function isAdmin(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? "";
  const expected = process.env.ADMIN_TOKEN ?? "";
  return Boolean(expected) && token === expected;
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { licenseKey?: string; notes?: string; expiresAtIso?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const created = await createMt5License({
      licenseKey: body.licenseKey,
      notes: body.notes,
      expiresAtIso: body.expiresAtIso,
    });
    return NextResponse.json({ ok: true, licenseKey: created.licenseKey });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

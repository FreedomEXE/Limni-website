import { NextResponse } from "next/server";
import { loadAccountsPayload } from "@/lib/accounts/loadAccountsPayload";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await loadAccountsPayload();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[accounts/payload] Failed to load accounts payload:", error);
    return NextResponse.json(
      { error: "Failed to load accounts payload" },
      { status: 500 },
    );
  }
}

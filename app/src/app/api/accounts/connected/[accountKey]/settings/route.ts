import { NextResponse, type NextRequest } from "next/server";
import {
  getConnectedAccount,
  updateConnectedAccountRiskMode,
} from "@/lib/connectedAccounts";

export const runtime = "nodejs";

const ALLOWED_RISK_MODES = new Set(["god", "normal", "low", "1:1", "high", "reduced", "aggressive"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountKey: string }> },
) {
  try {
    const { accountKey } = await params;
    const body = (await request.json()) as { riskMode?: string };
    const riskMode = String(body?.riskMode ?? "").trim().toLowerCase();
    if (!riskMode || !ALLOWED_RISK_MODES.has(riskMode)) {
      return NextResponse.json(
        { error: "Invalid risk mode. Allowed: god, normal, low." },
        { status: 400 },
      );
    }

    const account = await getConnectedAccount(accountKey);
    if (!account) {
      return NextResponse.json({ error: "Connected account not found." }, { status: 404 });
    }

    const updatedKey = await updateConnectedAccountRiskMode(account.account_key, riskMode);
    if (!updatedKey) {
      return NextResponse.json({ error: "Failed to update risk mode." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, accountKey: updatedKey, riskMode });
  } catch (error) {
    console.error("Update connected account settings failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}


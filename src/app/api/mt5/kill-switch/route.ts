/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * MT5 kill-switch polling and admin control API.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse, type NextRequest } from "next/server";

import {
  clearMt5KillSwitch,
  logMt5RiskEvent,
  readMt5KillSwitch,
  upsertMt5KillSwitch,
} from "@/lib/mt5Store";
import { validateMt5License } from "@/lib/mt5Licensing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? "";
  const expected = process.env.ADMIN_TOKEN ?? "";
  return Boolean(expected) && token === expected;
}

async function validateMt5Request(request: NextRequest, accountId: string) {
  const token = request.headers.get("x-mt5-token") ?? "";
  const expectedToken = process.env.MT5_PUSH_TOKEN ?? process.env.ADMIN_TOKEN ?? "";
  if (expectedToken && token !== expectedToken) {
    return { ok: false as const, status: 401, body: { error: "Unauthorized" } };
  }

  const licenseKey = request.headers.get("x-mt5-license") ?? token;
  const licenseCheck = await validateMt5License({
    accountId,
    licenseKey,
    server: request.headers.get("x-mt5-server") ?? "",
    broker: request.headers.get("x-mt5-broker") ?? "",
  });
  if (!licenseCheck.ok) {
    return {
      ok: false as const,
      status: 401,
      body: { error: "License validation failed.", code: licenseCheck.reason },
    };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("account_id") ?? "";
  if (!accountId.trim()) {
    return NextResponse.json({ error: "account_id is required." }, { status: 400 });
  }

  const auth = await validateMt5Request(request, accountId);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const state = await readMt5KillSwitch(accountId);
  const isActive = state.halt || state.liquidate;

  return NextResponse.json({
    halt: state.halt,
    liquidate: state.liquidate,
    reason: state.reason,
    issued_at: isActive ? state.issued_at : "",
  });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { account_id?: string; action?: "halt" | "liquidate" | "clear"; reason?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const accountId = String(body.account_id ?? "").trim();
  if (!accountId) {
    return NextResponse.json({ error: "account_id is required." }, { status: 400 });
  }

  const action = String(body.action ?? "").trim().toLowerCase() as "halt" | "liquidate" | "clear";
  if (action !== "halt" && action !== "liquidate" && action !== "clear") {
    return NextResponse.json({ error: "action must be one of: halt, liquidate, clear." }, { status: 400 });
  }

  const reason = String(body.reason ?? "").trim();
  const issuedBy = "admin_api";

  try {
    let state;
    if (action === "clear") {
      state = await clearMt5KillSwitch(accountId);
      await logMt5RiskEvent(accountId, "kill_switch_clear", "medium", reason || "Kill switch cleared", {
        action,
      });
    } else {
      const halt = action === "halt";
      const liquidate = action === "liquidate";
      state = await upsertMt5KillSwitch(accountId, halt, liquidate, reason, issuedBy);
      await logMt5RiskEvent(
        accountId,
        action === "liquidate" ? "kill_switch_liquidate" : "kill_switch_halt",
        action === "liquidate" ? "critical" : "high",
        reason || `Kill switch action: ${action}`,
        { action },
      );
    }

    return NextResponse.json({
      success: true,
      kill_switch: {
        halt: state.halt,
        liquidate: state.liquidate,
        reason: state.reason,
        issued_at: state.issued_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

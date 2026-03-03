/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * MT5 heartbeat ingestion endpoint.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse, type NextRequest } from "next/server";

import { HeartbeatPushSchema } from "@/lib/mt5/contracts";
import { insertMt5Heartbeat } from "@/lib/mt5Store";
import { validateMt5License } from "@/lib/mt5Licensing";
import { toValidationResponse, validateMt5Payload } from "@/lib/mt5/validatePayload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-admin-token") ?? request.headers.get("x-mt5-token") ?? "";
  const expectedToken = process.env.MT5_PUSH_TOKEN ?? process.env.ADMIN_TOKEN ?? "";
  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const validation = validateMt5Payload(HeartbeatPushSchema, payload);
  if (!validation.ok) {
    return NextResponse.json(toValidationResponse(validation.error), { status: 400 });
  }

  const data = validation.data;
  const licenseKey = request.headers.get("x-mt5-license") ?? token;
  const licenseCheck = await validateMt5License({
    accountId: data.account_id,
    licenseKey,
    server: request.headers.get("x-mt5-server") ?? "",
    broker: request.headers.get("x-mt5-broker") ?? "",
  });
  if (!licenseCheck.ok) {
    return NextResponse.json(
      { error: "License validation failed.", code: licenseCheck.reason },
      { status: 401 },
    );
  }

  try {
    await insertMt5Heartbeat({
      account_id: data.account_id,
      ts_utc: data.ts_utc,
      ea_version: data.ea_version,
      state: data.state,
      open_positions: data.open_positions,
      basket_pnl_pct: data.basket_pnl_pct,
      equity: data.equity,
      errors_last_hour: data.errors_last_hour,
    });
    return NextResponse.json({ ack: true, server_time: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

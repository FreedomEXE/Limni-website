/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Single broker profile fetch API.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import { normalizeBrokerProfileId } from "@/lib/brokerProfiles";
import { readBrokerProfileById } from "@/lib/brokerProfilesStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const profile = await readBrokerProfileById(normalizeBrokerProfileId(id));
    if (!profile) {
      return NextResponse.json({ error: "Broker profile not found." }, { status: 404 });
    }
    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load broker profile.", details: message }, { status: 500 });
  }
}

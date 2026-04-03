/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Broker profile listing and upsert API.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import { BrokerProfileUpsertSchema, normalizeBrokerProfileId } from "@/lib/brokerProfiles";
import {
  ensureBrokerProfilesSchema,
  readBrokerProfileSummaries,
  upsertBrokerProfile,
} from "@/lib/brokerProfilesStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profiles = await readBrokerProfileSummaries();
    return NextResponse.json(profiles, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load broker profiles.", details: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const token = request.headers.get("x-admin-token") ?? "";
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

  const parsed = BrokerProfileUpsertSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid broker profile payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const profile = await upsertBrokerProfile({
      ...parsed.data,
      profile_id: normalizeBrokerProfileId(parsed.data.profile_id),
    });
    return NextResponse.json(
      {
        ok: true,
        profile_id: profile.profile_id,
        symbol_count: profile.symbol_specs.length,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("broker_profiles")) {
      try {
        await ensureBrokerProfilesSchema();
        const profile = await upsertBrokerProfile({
          ...parsed.data,
          profile_id: normalizeBrokerProfileId(parsed.data.profile_id),
        });
        return NextResponse.json(
          {
            ok: true,
            profile_id: profile.profile_id,
            symbol_count: profile.symbol_specs.length,
          },
          { status: 200 },
        );
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
        return NextResponse.json({ error: "Broker profile upsert failed.", details: retryMessage }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Broker profile upsert failed.", details: message }, { status: 500 });
  }
}

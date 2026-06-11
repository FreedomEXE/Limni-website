/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Serves the read-only per-week canon inventory contract for the active
 * release canon version without mutating frozen release artifacts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse, type NextRequest } from "next/server";
import {
  canonArtifactCacheControl,
  canonArtifactStatusHeaders,
} from "@/lib/canon/canonArtifactStatus";
import {
  buildCanonInventoryManifest,
} from "@/lib/canon/canonWeekShard.server";
import { releaseManifest } from "@/lib/version/releaseManifest";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ version: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { version } = await context.params;
  if (version !== releaseManifest.canonVersion) {
    return NextResponse.json({ error: `Unknown canon version: ${version}` }, { status: 404 });
  }

  const strategyVariant = request.nextUrl.searchParams.get("strategyVariant")?.trim();
  const inventory = await buildCanonInventoryManifest({
    manifest: releaseManifest,
    currentWeekOpenUtc: getDisplayWeekOpenUtc(),
    strategyVariants: strategyVariant ? [strategyVariant] : undefined,
  });

  return NextResponse.json(
    { inventory },
    {
      headers: {
        "Cache-Control": canonArtifactCacheControl(
          releaseManifest,
          "public, max-age=60, stale-while-revalidate=300",
        ),
        "X-Limni-Canon-Version": version,
        "X-Limni-Canon-Inventory-Schema": inventory.schemaVersion,
        ...canonArtifactStatusHeaders(releaseManifest),
      },
    },
  );
}

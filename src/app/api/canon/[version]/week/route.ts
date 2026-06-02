/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Serves a deterministic one-week release-canon shard derived from immutable
 * monolithic release canon artifacts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse, type NextRequest } from "next/server";
import {
  buildClosedWeekDeltaShard,
  buildCanonWeekShard,
  readReleaseCanonArtifact,
} from "@/lib/canon/canonWeekShard.server";
import { releaseManifest } from "@/lib/version/releaseManifest";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ version: string }>;
};

function requiredParam(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();
  return value && value.length > 0 ? value : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { version } = await context.params;
  if (version !== releaseManifest.canonVersion) {
    return NextResponse.json({ error: `Unknown canon version: ${version}` }, { status: 404 });
  }

  const strategyVariant = requiredParam(request.nextUrl.searchParams, "strategyVariant");
  const weekOpenUtc =
    requiredParam(request.nextUrl.searchParams, "weekOpenUtc") ??
    requiredParam(request.nextUrl.searchParams, "week");
  if (!strategyVariant || !weekOpenUtc) {
    return NextResponse.json(
      { error: "Missing required params: strategyVariant, weekOpenUtc" },
      { status: 400 },
    );
  }

  try {
    const artifact = await readReleaseCanonArtifact(releaseManifest, strategyVariant);
    const shard = buildCanonWeekShard({
      manifest: releaseManifest,
      artifact,
      strategyVariant,
      weekOpenUtc,
    });
    if (shard.payload.closedHistoryRows.length === 0) {
      const deltaShard = await buildClosedWeekDeltaShard({
        manifest: releaseManifest,
        strategyVariant,
        weekOpenUtc,
        currentWeekOpenUtc: getDisplayWeekOpenUtc(),
        baselineLatestClosedWeekOpenUtc: Array.from(
          new Set(artifact.bundle.rows.map((row) => row.weekOpenUtc)),
        ).sort().at(-1) ?? null,
      });
      if (!deltaShard) {
        return NextResponse.json(
          { error: `Canon week shard not found: ${strategyVariant} ${weekOpenUtc}` },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { shard: deltaShard },
        {
          headers: {
            "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
            "X-Limni-Canon-Version": version,
            "X-Limni-Canon-Shard-Schema": deltaShard.metadata.schemaVersion,
            "X-Limni-Canon-Shard-Hash": deltaShard.metadata.payloadHash,
            "X-Limni-Canon-Shard-Source": deltaShard.metadata.source,
          },
        },
      );
    }

    return NextResponse.json(
      { shard },
      {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Limni-Canon-Version": version,
          "X-Limni-Canon-Shard-Schema": shard.metadata.schemaVersion,
          "X-Limni-Canon-Shard-Hash": shard.metadata.payloadHash,
          "X-Limni-Canon-Shard-Source": shard.metadata.source,
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 404 },
    );
  }
}

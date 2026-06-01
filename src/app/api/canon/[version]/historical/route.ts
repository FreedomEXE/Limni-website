/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Serves immutable materialized release canon artifacts from releases/vN/canon.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { canonFileNameForStrategyVariant, type CanonArtifact } from "@/lib/canon/canonArtifact";
import { releaseManifest } from "@/lib/version/releaseManifest";

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
  if (!strategyVariant) {
    return NextResponse.json({ error: "Missing required param: strategyVariant" }, { status: 400 });
  }

  const manifestEntry = releaseManifest.canon.variants.find((entry) =>
    entry.strategyVariant === strategyVariant,
  );
  if (!manifestEntry) {
    return NextResponse.json({ error: `Canon variant not found: ${strategyVariant}` }, { status: 404 });
  }

  const fileName = canonFileNameForStrategyVariant(strategyVariant);
  if (fileName !== manifestEntry.file) {
    return NextResponse.json({ error: "Canon manifest file mapping mismatch" }, { status: 500 });
  }

  const filePath = path.join(process.cwd(), "releases", version, "canon", fileName);
  const raw = await readFile(filePath, "utf8");
  const artifact = JSON.parse(raw) as CanonArtifact;
  return NextResponse.json(
    { bundle: artifact.bundle, metadata: artifact.metadata },
    {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Limni-Canon-Version": version,
        "X-Limni-Canon-Hash": manifestEntry.sha256,
      },
    },
  );
}

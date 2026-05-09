import { NextResponse } from "next/server";
import {
  buildStrategySelectionKey,
  listVisibleStrategyBootstrapSelections,
} from "@/lib/performance/strategySelection";
import { listStrategyArtifactReadiness } from "@/lib/performance/strategyArtifactReadiness";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedKey = url.searchParams.get("key");
  const selections = listVisibleStrategyBootstrapSelections();
  const filteredSelections = requestedKey
    ? selections.filter((selection) => buildStrategySelectionKey(selection) === requestedKey)
    : selections;
  const artifacts = await listStrategyArtifactReadiness(filteredSelections);

  return NextResponse.json({
    generatedAtUtc: new Date().toISOString(),
    readyCount: artifacts.filter((artifact) => artifact.ready).length,
    totalCount: artifacts.length,
    artifacts,
  });
}

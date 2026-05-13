import { NextRequest, NextResponse } from "next/server";
import { getStrategy, normalizeFilterSelection, resolveStrategyId } from "@/lib/performance/strategyConfig";
import { buildStrategySelectionKey } from "@/lib/performance/strategySelection";
import { readReadyStrategyArtifactPayload } from "@/lib/performance/strategyArtifactReadiness";
import {
  toCurrentWeekStrategyClientPayload,
} from "@/lib/performance/strategyClientPayload";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import {
  computeWeeklySignalsOnly,
  type WeeklyHoldResult,
} from "@/lib/performance/weeklyHoldEngine";
import type { BiasSourceConfig } from "@/lib/performance/strategyConfig";

export const dynamic = "force-dynamic";

const CURRENT_WEEK_SIGNAL_ATTEMPTS = 3;

function isTransientDatabaseError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("connection terminated") ||
    message.includes("connection timeout") ||
    message.includes("terminating connection") ||
    message.includes("connection ended unexpectedly")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function computeCurrentWeekSignalsWithRetry(
  biasSource: BiasSourceConfig,
  currentWeekOpenUtc: string,
): Promise<WeeklyHoldResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= CURRENT_WEEK_SIGNAL_ATTEMPTS; attempt += 1) {
    try {
      return await computeWeeklySignalsOnly(biasSource, currentWeekOpenUtc);
    } catch (error) {
      lastError = error;
      if (attempt === CURRENT_WEEK_SIGNAL_ATTEMPTS || !isTransientDatabaseError(error)) {
        throw error;
      }
      console.warn(
        `[strategy-current-week] Retrying current week signal load (${attempt}/${CURRENT_WEEK_SIGNAL_ATTEMPTS - 1}):`,
        error instanceof Error ? error.message : error,
      );
      await wait(750 * attempt);
    }
  }

  throw lastError;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const strategyId = resolveStrategyId(searchParams.get("strategy") ?? searchParams.get("bias"));
  const normalizedFilters = normalizeFilterSelection({
    f1: searchParams.get("f1"),
    f2: searchParams.get("f2"),
  });
  const scope = searchParams.get("scope") === "matrix"
    ? "matrix"
    : searchParams.get("scope") === "full"
      ? "full"
      : "performance";
  const selection = {
    strategyId,
    f1: normalizedFilters.f1,
    f2: normalizedFilters.f2,
  };

  try {
    const selectionKey = buildStrategySelectionKey(selection);
    if (scope === "matrix") {
      const biasSource = getStrategy(selection.strategyId);
      if (!biasSource) {
        return NextResponse.json({ error: "Unknown strategy" }, { status: 400 });
      }
      const currentWeekOpenUtc = getDisplayWeekOpenUtc();
      const result = await computeCurrentWeekSignalsWithRetry(biasSource, currentWeekOpenUtc);
      return NextResponse.json({
        engineWeekMap: null,
        engineSimMap: null,
        engineWeekResults: {
          [currentWeekOpenUtc]: result,
        },
        sidebarStats: null,
        weekOptions: ["all", currentWeekOpenUtc],
        currentWeekOpenUtc,
        artifactMeta: {
          status: "hit",
          selectionKey,
          cachedAtUtc: null,
          refreshedWeeks: [currentWeekOpenUtc],
          removedWeeks: [],
          missingWeeks: [],
          stale: false,
          staleReason: null,
        },
      });
    }

    const data = await readReadyStrategyArtifactPayload(selection, {
      includeCurrentWeek: true,
    });
    if (!data) {
      return NextResponse.json({
        engineWeekMap: null,
        engineSimMap: null,
        engineWeekResults: null,
        sidebarStats: null,
        weekOptions: [],
        artifactMeta: {
          status: "miss",
          selectionKey,
          cachedAtUtc: null,
          refreshedWeeks: [],
          removedWeeks: [],
          missingWeeks: [],
        },
      });
    }

    return NextResponse.json(toCurrentWeekStrategyClientPayload(data, scope));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load current week strategy data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

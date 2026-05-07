import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  buildStrategySelectionKey,
  listVisibleStrategyBootstrapSelections,
} from "@/lib/performance/strategySelection";
import { getEntryStyle, getStrengthGate, getStrategy } from "@/lib/performance/strategyConfig";

export const dynamic = "force-dynamic";

type ArtifactRow = {
  selection_key: string;
  cached_at_utc: string;
  payload_bytes: number;
};

function labelFor(selection: ReturnType<typeof listVisibleStrategyBootstrapSelections>[number]) {
  const strategy = getStrategy(selection.strategyId)?.label ?? selection.strategyId;
  const entry = getEntryStyle(selection.f1)?.label ?? selection.f1;
  const overlay = getStrengthGate(selection.f2);
  return [
    strategy,
    entry,
    overlay && overlay.id !== "none" ? overlay.label : null,
  ].filter(Boolean).join(" · ");
}

export async function GET() {
  const selections = listVisibleStrategyBootstrapSelections();
  const keys = selections.map(buildStrategySelectionKey);
  const rows = keys.length > 0
    ? await query<ArtifactRow>(
        `SELECT selection_key,
                cached_at_utc::text AS cached_at_utc,
                pg_column_size(payload_json)::int AS payload_bytes
           FROM strategy_artifacts
          WHERE selection_key = ANY($1::text[])`,
        [keys],
      )
    : [];
  const rowByKey = new Map(rows.map((row) => [row.selection_key, row]));

  return NextResponse.json({
    generatedAtUtc: new Date().toISOString(),
    artifacts: selections.map((selection) => {
      const key = buildStrategySelectionKey(selection);
      const row = rowByKey.get(key);
      return {
        key,
        label: labelFor(selection),
        strategy: selection.strategyId,
        f1: selection.f1,
        f2: selection.f2,
        ready: Boolean(row),
        cachedAtUtc: row?.cached_at_utc ?? null,
        payloadBytes: row?.payload_bytes ?? null,
      };
    }),
  });
}

/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-sentiment-resolver.ts
 *
 * Description:
 * Lightweight verification for the canonical sentiment resolver. Confirms
 * every backtest week resolves to 36 non-neutral directions and reports the
 * tier distribution used to get there.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import { resolveSentimentDirections } from "../src/lib/sentiment/resolver";
import { DateTime } from "luxon";

type Tier = "S1" | "A" | "R" | "F";

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

async function main() {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc()) ?? getDisplayWeekOpenUtc();
  const historicalWeeks = (await listDataSectionWeeks())
    .map((week) => normalizeWeekOpenUtc(week) ?? week)
    .filter((week) => week < currentWeek)
    .slice(0, 10)
    .sort();

  const totals = { S1: 0, A: 0, R: 0, F: 0 } satisfies Record<Tier, number>;

  console.log("Sentiment Resolver Verification");
  console.log("================================");
  console.log("Week       | Total | S1 | A | R | F |");

  for (const weekOpenUtc of historicalWeeks) {
    const rows = await resolveSentimentDirections(weekOpenUtc);
    const counts = { S1: 0, A: 0, R: 0, F: 0 } satisfies Record<Tier, number>;
    for (const row of rows) {
      counts[row.tier] += 1;
      totals[row.tier] += 1;
      if (row.direction !== "LONG" && row.direction !== "SHORT") {
        throw new Error(`Unexpected direction ${row.direction} for ${row.symbol} ${weekOpenUtc}`);
      }
    }
    if (rows.length !== 36) {
      throw new Error(`Expected 36 directions for ${weekOpenUtc}, got ${rows.length}`);
    }
    console.log(
      `${weekLabel(weekOpenUtc).padEnd(10)}| ${String(rows.length).padStart(5)} | ${String(counts.S1).padStart(2)} | ${String(counts.A).padStart(1)} | ${String(counts.R).padStart(1)} | ${String(counts.F).padStart(1)} |`,
    );
  }

  const totalDirections = totals.S1 + totals.A + totals.R + totals.F;
  console.log("================================");
  console.log(
    `Total      | ${String(totalDirections).padStart(5)} | ${String(totals.S1).padStart(2)} | ${String(totals.A).padStart(1)} | ${String(totals.R).padStart(1)} | ${String(totals.F).padStart(1)} |`,
  );
  console.log("");
  console.log("✓ All weeks have exactly 36 directions");
  console.log("✓ No NEUTRAL directions found");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

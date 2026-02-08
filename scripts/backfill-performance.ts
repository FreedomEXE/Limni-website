import { DateTime } from "luxon";
import fs from "node:fs";
import path from "node:path";
import { query } from "../src/lib/db";
import { readSnapshot } from "../src/lib/cotStore";
import { readAggregates, getAggregatesForWeekStart } from "../src/lib/sentiment/store";
import {
  computeModelPerformance,
  buildSentimentPairsWithHistory,
} from "../src/lib/performanceLab";
import {
  getPairPerformance,
  getPairPerformanceForWindows,
} from "../src/lib/pricePerformance";
import { writePerformanceSnapshots, type PerformanceSnapshot } from "../src/lib/performanceSnapshots";
import { listAssetClasses } from "../src/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { PairSnapshot } from "../src/lib/cotTypes";

async function listWeeks(): Promise<string[]> {
  const rows = await query<{ week_open_utc: Date }>(
    "SELECT DISTINCT week_open_utc FROM performance_snapshots ORDER BY week_open_utc",
  );
  return rows.map((row) => row.week_open_utc.toISOString());
}

async function listWeekReports(weekOpenUtc: string): Promise<Map<string, string | null>> {
  const rows = await query<{ asset_class: string; report_date: Date | null }>(
    "SELECT DISTINCT asset_class, report_date FROM performance_snapshots WHERE week_open_utc = $1",
    [weekOpenUtc],
  );
  const map = new Map<string, string | null>();
  rows.forEach((row) => {
    map.set(row.asset_class, row.report_date ? row.report_date.toISOString().slice(0, 10) : null);
  });
  return map;
}

// Sentiment is snapshotted as-of the trading week open (Monday 00:00 ET).

function loadDotEnv() {
  const cwd = process.cwd();
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (!key) continue;
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function buildAllPairs(assetId: string): Record<string, PairSnapshot> {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetId as keyof typeof PAIRS_BY_ASSET_CLASS] ?? [];
  const pairs: Record<string, PairSnapshot> = {};
  for (const pair of pairDefs) {
    pairs[pair.pair] = {
      direction: "LONG",
      base_bias: "NEUTRAL",
      quote_bias: "NEUTRAL",
    };
  }
  return pairs;
}

async function main() {
  loadDotEnv();
  const assetClasses = listAssetClasses();

  const weeks = await listWeeks();
  if (weeks.length === 0) {
    console.log("No weeks found in performance_snapshots.");
    return;
  }

  const sentimentHistory = await readAggregates();

  for (const weekOpenUtc of weeks) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    if (!weekOpen.isValid) {
      continue;
    }
    const now = DateTime.utc();
    if (weekOpen.toMillis() > now.toMillis()) {
      continue;
    }
    const rawWeekClose = weekOpen.plus({ days: 5, hours: 23, minutes: 59, seconds: 59 });
    const weekClose = rawWeekClose.toMillis() > now.toMillis() ? now : rawWeekClose;
    const reportDates = await listWeekReports(weekOpenUtc);
    const weekCloseIso = weekOpen.plus({ days: 7 }).toUTC().toISO() ?? weekOpenUtc;
    const latestSentiment = await getAggregatesForWeekStart(weekOpenUtc, weekCloseIso);

    const payload: PerformanceSnapshot[] = [];
    for (const asset of assetClasses) {
      const reportDate = reportDates.get(asset.id) ?? null;
      const snapshot = reportDate
        ? await readSnapshot({ assetClass: asset.id, reportDate })
        : await readSnapshot({ assetClass: asset.id });
      if (!snapshot) {
        continue;
      }

      // Antikythera depends on sentiment gating; recompute it alongside sentiment so historical
      // weeks reflect the correct "neutral = no trade" rules.
      const basePerformance = await getPairPerformance(buildAllPairs(asset.id), {
        assetClass: asset.id,
        reportDate: snapshot.report_date,
        isLatestReport: false,
      });
      const antikythera = await computeModelPerformance({
        model: "antikythera",
        assetClass: asset.id,
        snapshot,
        sentiment: latestSentiment,
        performance: basePerformance,
      });
      payload.push({
        week_open_utc: weekOpenUtc,
        asset_class: asset.id,
        model: "antikythera",
        report_date: snapshot.report_date ?? null,
        percent: antikythera.percent,
        priced: antikythera.priced,
        total: antikythera.total,
        note: antikythera.note,
        returns: antikythera.returns,
        pair_details: antikythera.pair_details,
        stats: antikythera.stats,
      });

      const sentimentPairs = buildSentimentPairsWithHistory({
        assetClass: asset.id,
        sentimentHistory,
        weekOpenUtc: weekOpen,
        weekCloseUtc: weekClose,
      });
      const sentimentPerformance = await getPairPerformanceForWindows(
        sentimentPairs.pairs,
        Object.fromEntries(
          Object.entries(sentimentPairs.windows).map(([pair, windowInfo]) => [
            pair,
            { openUtc: windowInfo.openUtc, closeUtc: windowInfo.closeUtc },
          ]),
        ),
        { assetClass: asset.id },
      );
      const result = await computeModelPerformance({
        model: "sentiment",
        assetClass: asset.id,
        snapshot,
        sentiment: latestSentiment,
        performance: sentimentPerformance,
        pairsOverride: sentimentPairs.pairs,
        reasonOverrides: sentimentPairs.reasonOverrides,
      });
      payload.push({
        week_open_utc: weekOpenUtc,
        asset_class: asset.id,
        model: "sentiment",
        report_date: snapshot.report_date ?? null,
        percent: result.percent,
        priced: result.priced,
        total: result.total,
        note: result.note,
        returns: result.returns,
        pair_details: result.pair_details,
        stats: result.stats,
      });
    }

    await writePerformanceSnapshots(payload);
    console.log(`Backfilled week ${weekOpenUtc} (${payload.length} snapshots)`);
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});

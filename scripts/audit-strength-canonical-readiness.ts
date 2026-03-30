import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { query, getPool } from "../src/lib/db";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";

type CurrencyCoverageRow = {
  window: string;
  rows: string;
  currencies: string;
  snapshot_hours: string;
  earliest: string | null;
  latest: string | null;
};

type AssetCoverageRow = {
  asset_class: string;
  window: string;
  rows: string;
  assets: string;
  snapshot_hours: string;
  earliest: string | null;
  latest: string | null;
};

type WeekRow = {
  week_open_utc: string;
};

type LatestBeforeRow = {
  latest_before: string | null;
};

type StrengthSupportRow = {
  assetClass: string;
  symbol: string;
  path: "currency" | "asset" | "missing";
};

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function trackedPairs(supportedAssetClasses: Set<string>): StrengthSupportRow[] {
  return [
    ...PAIRS_BY_ASSET_CLASS.fx.map((pair) => ({
      assetClass: "fx",
      symbol: pair.pair,
      path: "currency" as const,
    })),
    ...PAIRS_BY_ASSET_CLASS.crypto.map((pair) => ({
      assetClass: "crypto",
      symbol: pair.pair,
      path: supportedAssetClasses.has("crypto") ? ("asset" as const) : ("missing" as const),
    })),
    ...PAIRS_BY_ASSET_CLASS.commodities.map((pair) => ({
      assetClass: "commodities",
      symbol: pair.pair,
      path: supportedAssetClasses.has("commodities") ? ("asset" as const) : ("missing" as const),
    })),
    ...PAIRS_BY_ASSET_CLASS.indices.map((pair) => ({
      assetClass: "indices",
      symbol: pair.pair,
      path: supportedAssetClasses.has("indices") ? ("asset" as const) : ("missing" as const),
    })),
  ];
}

async function main() {
  section("TRACKED UNIVERSE");
  const universeCounts = Object.entries(PAIRS_BY_ASSET_CLASS).reduce<Record<string, number>>(
    (acc, [assetClass, pairs]) => {
      acc[assetClass] = pairs.length;
      return acc;
    },
    {},
  );
  console.table(universeCounts);

  section("CURRENCY STRENGTH SNAPSHOT COVERAGE");
  const currencyCoverage = await query<CurrencyCoverageRow>(
    `SELECT "window",
            COUNT(*)::text AS rows,
            COUNT(DISTINCT currency)::text AS currencies,
            COUNT(DISTINCT snapshot_time_utc)::text AS snapshot_hours,
            MIN(snapshot_time_utc)::text AS earliest,
            MAX(snapshot_time_utc)::text AS latest
       FROM currency_strength_snapshots
      GROUP BY "window"
      ORDER BY "window"`,
    [],
  );
  console.table(currencyCoverage);

  section("ASSET STRENGTH SNAPSHOT COVERAGE");
  const assetCoverage = await query<AssetCoverageRow>(
    `SELECT asset_class,
            "window",
            COUNT(*)::text AS rows,
            COUNT(DISTINCT asset)::text AS assets,
            COUNT(DISTINCT snapshot_time_utc)::text AS snapshot_hours,
            MIN(snapshot_time_utc)::text AS earliest,
            MAX(snapshot_time_utc)::text AS latest
       FROM asset_strength_snapshots
      GROUP BY asset_class, "window"
      ORDER BY asset_class, "window"`,
    [],
  );
  console.table(assetCoverage);

  const structurallyCompleteClasses = ["crypto", "commodities", "indices"].filter((assetClass) => {
    const rows = assetCoverage.filter((row) => row.asset_class === assetClass);
    if (rows.length !== 3) return false;
    const expectedAssets = PAIRS_BY_ASSET_CLASS[assetClass as keyof typeof PAIRS_BY_ASSET_CLASS].length;
    return rows.every((row) => Number(row.assets) === expectedAssets);
  });
  const expectedAssetSnapshotHours = structurallyCompleteClasses.reduce((max, assetClass) => {
    const rows = assetCoverage.filter((row) => row.asset_class === assetClass);
    const classMax = rows.reduce((rowMax, row) => Math.max(rowMax, Number(row.snapshot_hours)), 0);
    return Math.max(max, classMax);
  }, 0);
  const readinessToleranceHours = 2;

  const readyAssetClasses = new Set(
    structurallyCompleteClasses.filter((assetClass) => {
      const rows = assetCoverage.filter((row) => row.asset_class === assetClass);
      return rows.every((row) => Number(row.snapshot_hours) >= expectedAssetSnapshotHours - readinessToleranceHours);
    }),
  );

  console.log(`Expected asset snapshot hours for readiness: ${expectedAssetSnapshotHours}`);
  console.log(`Readiness tolerance (hours): ${readinessToleranceHours}`);
  console.log(`Asset classes fully ready: ${[...readyAssetClasses].join(", ") || "none"}`);

  const supportedAssetClasses = readyAssetClasses;
  const tracked = trackedPairs(supportedAssetClasses);

  section("PAIR-LEVEL STRENGTH PATH SUPPORT");
  const supportSummary = tracked.reduce<Record<string, number>>((acc, row) => {
    acc[row.path] = (acc[row.path] ?? 0) + 1;
    return acc;
  }, {});
  console.table(supportSummary);
  console.table(tracked);

  const weekRows = await query<WeekRow>(
    `SELECT period_open_utc::text AS week_open_utc
       FROM pair_period_returns
      WHERE period_type = 'weekly'
      GROUP BY period_open_utc
      ORDER BY period_open_utc ASC`,
    [],
  );

  section("WEEK-OPEN SNAPSHOT AVAILABILITY");
  const availability: Array<Record<string, string>> = [];
  for (const week of weekRows) {
    const currencyLatest = await query<LatestBeforeRow>(
      `SELECT MAX(snapshot_time_utc)::text AS latest_before
         FROM currency_strength_snapshots
        WHERE snapshot_time_utc <= $1::timestamptz`,
      [week.week_open_utc],
    );
    const assetLatest = await query<LatestBeforeRow>(
      `SELECT MAX(snapshot_time_utc)::text AS latest_before
         FROM asset_strength_snapshots
        WHERE snapshot_time_utc <= $1::timestamptz`,
      [week.week_open_utc],
    );
    availability.push({
      week_open_utc: week.week_open_utc,
      currency_latest_before: currencyLatest[0]?.latest_before ?? "none",
      asset_latest_before: assetLatest[0]?.latest_before ?? "none",
    });
  }
  console.table(availability);

  section("READINESS SUMMARY");
  const readyPairs = tracked.filter((row) => row.path !== "missing").length;
  const missingPairs = tracked.filter((row) => row.path === "missing").length;
  console.log(`Tracked pairs: ${tracked.length}`);
  console.log(`Strength path ready now: ${readyPairs}`);
  console.log(`Missing strength path: ${missingPairs}`);
  const missingAssetClasses = [...new Set(tracked.filter((row) => row.path === "missing").map((row) => row.assetClass))];
  console.log(
    missingAssetClasses.length > 0
      ? `Missing asset class today: ${missingAssetClasses.join(", ")}`
      : "Missing asset class today: none",
  );

  await getPool().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

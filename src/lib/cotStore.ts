import { query, queryOne } from "./db";
import {
  buildMarketSnapshot,
  derivePairDirections,
  derivePairDirectionsByBase,
} from "./cotCompute";
import { fetchCotRowsForDate, fetchLatestReportDate } from "./cotFetch";
import type { CotRow } from "./cotFetch";
import {
  COT_VARIANT,
  getAssetClassDefinition,
  type AssetClass,
  type CotSource,
} from "./cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "./cotPairs";
import type { CotSnapshot, MarketSnapshot, PairSnapshot } from "./cotTypes";

type ReadSnapshotOptions = {
  assetClass?: AssetClass;
  reportDate?: string;
};

export async function readSnapshot(
  options: ReadSnapshotOptions = {},
): Promise<CotSnapshot | null> {
  try {
    const assetClass = options.assetClass ?? "fx";
    const params = [assetClass, COT_VARIANT];
    let queryText =
      "SELECT report_date, asset_class, variant, currencies, pairs, fetched_at FROM cot_snapshots WHERE asset_class = $1 AND variant = $2";

    if (options.reportDate) {
      params.push(options.reportDate);
      queryText += " AND report_date = $3";
    } else {
      queryText += " ORDER BY report_date DESC LIMIT 1";
    }

    const row = await queryOne<{
      report_date: string | Date;
      asset_class: string;
      variant: string;
      currencies: Record<string, MarketSnapshot>;
      pairs: Record<string, PairSnapshot>;
      fetched_at: Date;
    }>(queryText, params);

    if (!row) {
      return null;
    }

    const reportDate =
      row.report_date instanceof Date
        ? row.report_date.toISOString().slice(0, 10)
        : row.report_date;

    return {
      report_date: reportDate,
      last_refresh_utc: row.fetched_at.toISOString(),
      asset_class: (row.asset_class ?? assetClass) as AssetClass,
      variant: row.variant ?? COT_VARIANT,
      currencies: row.currencies,
      pairs: row.pairs,
    };
  } catch (error) {
    console.error("Error reading COT snapshot from database:", error);
    throw error;
  }
}

export async function writeSnapshot(snapshot: CotSnapshot): Promise<void> {
  try {
    await query(
      `INSERT INTO cot_snapshots (report_date, asset_class, variant, currencies, pairs, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (report_date, asset_class, variant)
       DO UPDATE SET
         currencies = EXCLUDED.currencies,
         pairs = EXCLUDED.pairs,
         fetched_at = EXCLUDED.fetched_at`,
      [
        snapshot.report_date,
        snapshot.asset_class,
        snapshot.variant,
        JSON.stringify(snapshot.currencies),
        JSON.stringify(snapshot.pairs),
        new Date(snapshot.last_refresh_utc),
      ]
    );
  } catch (error) {
    console.error("Error writing COT snapshot to database:", error);
    throw error;
  }
}

export async function listSnapshotDates(
  assetClass: AssetClass = "fx",
): Promise<string[]> {
  try {
    const rows = await query<{ report_date: string | Date }>(
      "SELECT report_date FROM cot_snapshots WHERE asset_class = $1 AND variant = $2 ORDER BY report_date DESC",
      [assetClass, COT_VARIANT],
    );
    return rows.map((row) =>
      row.report_date instanceof Date
        ? row.report_date.toISOString().slice(0, 10)
        : row.report_date,
    );
  } catch (error) {
    console.error("Error listing COT snapshot dates:", error);
    throw error;
  }
}

export async function refreshSnapshotForClass(
  assetClass: AssetClass = "fx",
  reportDate?: string,
): Promise<CotSnapshot> {
  const resolvedReportDate =
    reportDate ?? (await fetchLatestReportDate(assetDefinition.source));
  const assetDefinition = getAssetClassDefinition(assetClass);
  const marketDefs = Object.values(assetDefinition.markets);
  const marketNames = marketDefs.flatMap((market) => market.marketNames);
  const rows = await fetchCotRowsForDate(
    resolvedReportDate,
    marketNames,
    COT_VARIANT,
    assetDefinition.source,
  );

  const byMarket = new Map(
    rows.map((row) => [row.contract_market_name, row]),
  );

  const currencies: Record<string, MarketSnapshot> = {};
  const missing: string[] = [];

  for (const market of marketDefs) {
    let row = null as typeof rows[number] | null;
    for (const name of market.marketNames) {
      const candidate = byMarket.get(name);
      if (candidate) {
        row = candidate;
        break;
      }
    }

    if (!row) {
      missing.push(market.id);
      continue;
    }

    const [dealerLong, dealerShort] = getPositions(row, assetDefinition.source);

    if (!Number.isFinite(dealerLong) || !Number.isFinite(dealerShort)) {
      throw new Error(`Invalid position data for ${market.id}`);
    }

    currencies[market.id] = buildMarketSnapshot(dealerLong, dealerShort);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing COT rows for ${assetDefinition.label}: ${missing.join(", ")}`,
    );
  }

  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
  const pairs =
    assetClass === "fx"
      ? derivePairDirections(currencies, pairDefs)
      : derivePairDirectionsByBase(currencies, pairDefs);
  const snapshot: CotSnapshot = {
    report_date: resolvedReportDate,
    last_refresh_utc: new Date().toISOString(),
    asset_class: assetClass,
    variant: COT_VARIANT,
    currencies,
    pairs,
  };

  await writeSnapshot(snapshot);
  return snapshot;
}

export async function refreshAllSnapshots(
  reportDate?: string,
): Promise<Record<AssetClass, CotSnapshot>> {
  const entries = (Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]).map(
    async (assetClass) => [assetClass, await refreshSnapshotForClass(assetClass, reportDate)] as const,
  );
  const snapshots = await Promise.all(entries);
  return Object.fromEntries(snapshots) as Record<AssetClass, CotSnapshot>;
}

function getPositions(row: CotRow, source: CotSource): [number, number] {
  if (source === "tff") {
    return [
      Number(row.dealer_positions_long_all),
      Number(row.dealer_positions_short_all),
    ];
  }

  if (source === "legacy") {
    return [
      Number(row.comm_positions_long_all),
      Number(row.comm_positions_short_all),
    ];
  }

  return [
    Number(row.prod_merc_positions_long),
    Number(row.prod_merc_positions_short),
  ];
}

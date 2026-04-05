import { query, queryOne } from "./db";
import {
  buildMarketSnapshot,
  derivePairDirections,
  derivePairDirectionsByBase,
  type BiasMode,
  type CotEnrichment,
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
import { DateTime } from "luxon";
import { clearRuntimeCacheByPrefix, getOrSetRuntimeCache } from "./runtimeCache";

type ReadSnapshotOptions = {
  assetClass?: AssetClass;
  reportDate?: string;
};

const COT_STORE_CACHE_TTL_MS = Number(process.env.COT_STORE_CACHE_TTL_MS ?? "30000");

function getCotCacheTtlMs() {
  return Number.isFinite(COT_STORE_CACHE_TTL_MS) && COT_STORE_CACHE_TTL_MS >= 0
    ? COT_STORE_CACHE_TTL_MS
    : 30000;
}

export async function readSnapshot(
  options: ReadSnapshotOptions = {},
): Promise<CotSnapshot | null> {
  const assetClass = options.assetClass ?? "fx";
  const reportDate = options.reportDate ?? "latest";
  const cacheKey = `cotStore:${assetClass}:readSnapshot:${reportDate}:${COT_VARIANT}`;
  return getOrSetRuntimeCache(cacheKey, getCotCacheTtlMs(), async () => {
    try {
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

      let resolvedRow = row;
      if (!resolvedRow && !options.reportDate) {
        resolvedRow = await queryOne<{
          report_date: string | Date;
          asset_class: string;
          variant: string;
          currencies: Record<string, MarketSnapshot>;
          pairs: Record<string, PairSnapshot>;
          fetched_at: Date;
        }>(
          "SELECT report_date, asset_class, variant, currencies, pairs, fetched_at FROM cot_snapshots WHERE asset_class = $1 ORDER BY report_date DESC LIMIT 1",
          [assetClass],
        );
      }

      if (!resolvedRow) {
        return null;
      }

      const resolvedReportDate =
        resolvedRow.report_date instanceof Date
          ? resolvedRow.report_date.toISOString().slice(0, 10)
          : resolvedRow.report_date;

      return {
        report_date: resolvedReportDate,
        last_refresh_utc: resolvedRow.fetched_at.toISOString(),
        asset_class: (resolvedRow.asset_class ?? assetClass) as AssetClass,
        variant: resolvedRow.variant ?? COT_VARIANT,
        currencies: resolvedRow.currencies,
        pairs: resolvedRow.pairs,
      };
    } catch (error) {
      console.error("Error reading COT snapshot from database:", error);
      throw error;
    }
  });
}

export async function ensureSnapshotForClass(
  assetClass: AssetClass = "fx",
): Promise<CotSnapshot | null> {
  const snapshot = await readSnapshot({ assetClass });
  if (!snapshot) {
    return refreshSnapshotForClass(assetClass);
  }
  const refreshSeconds = Number(process.env.COT_REFRESH_SECONDS ?? "43200");
  if (!snapshot.last_refresh_utc) {
    return refreshSnapshotForClass(assetClass);
  }
  const refreshedAt = DateTime.fromISO(snapshot.last_refresh_utc);
  if (!refreshedAt.isValid) {
    return refreshSnapshotForClass(assetClass);
  }
  const ageSeconds = DateTime.utc().diff(refreshedAt, "seconds").seconds;
  if (Number.isFinite(ageSeconds) && ageSeconds > refreshSeconds) {
    return refreshSnapshotForClass(assetClass);
  }
  return snapshot;
}

export async function readSnapshotHistory(
  assetClass: AssetClass = "fx",
  limit = 104,
): Promise<CotSnapshot[]> {
  const cacheKey = `cotStore:${assetClass}:readSnapshotHistory:${limit}:${COT_VARIANT}`;
  return getOrSetRuntimeCache(cacheKey, getCotCacheTtlMs(), async () => {
    try {
      const rows = await query<{
        report_date: string | Date;
        asset_class: string;
        variant: string;
        currencies: Record<string, MarketSnapshot>;
        pairs: Record<string, PairSnapshot>;
        fetched_at: Date;
      }>(
        "SELECT report_date, asset_class, variant, currencies, pairs, fetched_at FROM cot_snapshots WHERE asset_class = $1 AND variant = $2 ORDER BY report_date DESC LIMIT $3",
        [assetClass, COT_VARIANT, limit],
      );

      return rows.map((row) => {
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
      });
    } catch (error) {
      console.error("Error reading COT snapshot history:", error);
      throw error;
    }
  });
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
  } finally {
    clearRuntimeCacheByPrefix(`cotStore:${snapshot.asset_class}:`);
    clearRuntimeCacheByPrefix("cotStore:all:");
  }
}

export async function listSnapshotDates(
  assetClass: AssetClass = "fx",
): Promise<string[]> {
  const cacheKey = `cotStore:${assetClass}:listSnapshotDates:${COT_VARIANT}`;
  return getOrSetRuntimeCache(cacheKey, getCotCacheTtlMs(), async () => {
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
  });
}

export async function refreshSnapshotForClass(
  assetClass: AssetClass = "fx",
  reportDate?: string,
): Promise<CotSnapshot> {
  const assetDefinition = getAssetClassDefinition(assetClass);
  const dealerSource: CotSource = "tff";
  const commercialSource: CotSource =
    assetClass === "commodities" ? "disaggregated" : "legacy";
  let resolvedReportDate = reportDate;
  if (!resolvedReportDate) {
    const dealerLatest = await fetchLatestReportDate(dealerSource);
    const commercialLatest = await fetchLatestReportDate(commercialSource);
    resolvedReportDate = [dealerLatest, commercialLatest]
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1);
  }
  if (!resolvedReportDate) {
    throw new Error("Unable to resolve COT report date.");
  }
  const marketDefs = Object.values(assetDefinition.markets);
  const marketNames = marketDefs.flatMap((market) => market.marketNames);
  const dealerRows = await fetchCotRowsForDate(
    resolvedReportDate,
    marketNames,
    COT_VARIANT,
    dealerSource,
  );
  const commercialRows = await fetchCotRowsForDate(
    resolvedReportDate,
    marketNames,
    COT_VARIANT,
    commercialSource,
  );

  const dealerByMarket = new Map(
    dealerRows.map((row) => [row.contract_market_name, row]),
  );
  const commercialByMarket = new Map(
    commercialRows.map((row) => [row.contract_market_name, row]),
  );

  const currencies: Record<string, MarketSnapshot> = {};
  const missing: string[] = [];
  const missingCommercial: string[] = [];
  const missingDealer: string[] = [];

  for (const market of marketDefs) {
    let dealerRow = null as typeof dealerRows[number] | null;
    let commercialRow = null as typeof commercialRows[number] | null;
    for (const name of market.marketNames) {
      const dealerCandidate = dealerByMarket.get(name);
      if (dealerCandidate) {
        dealerRow = dealerCandidate;
      }
      const commercialCandidate = commercialByMarket.get(name);
      if (commercialCandidate) {
        commercialRow = commercialCandidate;
      }
      if (dealerRow && commercialRow) {
        break;
      }
    }

    if (!dealerRow && !commercialRow) {
      missing.push(market.id);
      continue;
    }
    if (!dealerRow) {
      missingDealer.push(market.id);
    }

    let dealerLong: number;
    let dealerShort: number;
    if (dealerRow) {
      [dealerLong, dealerShort] = getPositions(dealerRow, dealerSource);
    } else if (commercialRow) {
      [dealerLong, dealerShort] = getPositions(
        commercialRow,
        commercialSource,
      );
    } else {
      continue;
    }

    let commercialLong: number | null = null;
    let commercialShort: number | null = null;
    if (commercialRow) {
      const [commLong, commShort] = getPositions(
        commercialRow,
        commercialSource,
      );
      commercialLong = commLong;
      commercialShort = commShort;
    } else {
      missingCommercial.push(market.id);
    }

    if (!Number.isFinite(dealerLong) || !Number.isFinite(dealerShort)) {
      throw new Error(`Invalid position data for ${market.id}`);
    }

    const marketEnrichment = buildMarketEnrichment(
      dealerRow,
      commercialRow,
      commercialSource,
    );

    currencies[market.id] = buildMarketSnapshot(
      dealerLong,
      dealerShort,
      commercialLong,
      commercialShort,
      marketEnrichment,
    );
  }

  const priorDates = (await listSnapshotDates(assetClass))
    .filter((date) => date < resolvedReportDate)
    .sort((left, right) => left.localeCompare(right))
    .slice(-4);

  if (priorDates.length > 0) {
    const priorSnapshots = (
      await Promise.all(
        priorDates.map((date) => readSnapshot({ assetClass, reportDate: date })),
      )
    ).filter((snapshot): snapshot is CotSnapshot => Boolean(snapshot));

    for (const [currencyId, snapshot] of Object.entries(currencies)) {
      const applyPersistence = (
        currentDelta: number | null | undefined,
        field: "dealer_delta_persistence" | "commercial_delta_persistence",
      ) => {
        if (typeof currentDelta !== "number" || currentDelta === 0) {
          return;
        }
        const currentSign = currentDelta > 0 ? 1 : -1;
        let count = 0;
        for (const priorSnapshot of priorSnapshots) {
          const priorDelta =
            field === "dealer_delta_persistence"
              ? priorSnapshot.currencies[currencyId]?.dealer_delta_net
              : priorSnapshot.currencies[currencyId]?.commercial_delta_net;
          if (typeof priorDelta !== "number" || priorDelta === 0) {
            continue;
          }
          if ((priorDelta > 0 ? 1 : -1) === currentSign) {
            count += 1;
          }
        }
        snapshot[field] = count;
      };

      applyPersistence(snapshot.dealer_delta_net, "dealer_delta_persistence");
      applyPersistence(snapshot.commercial_delta_net, "commercial_delta_persistence");
    }
  }

  if (missing.length > 0) {
    console.warn(
      `Missing COT rows for ${assetDefinition.label}: ${missing.join(", ")}`,
    );
  }

  if (missingCommercial.length > 0) {
    console.warn(
      `Missing commercial rows for ${assetDefinition.label}: ${missingCommercial.join(", ")}`,
    );
  }

  if (missingDealer.length > 0) {
    console.warn(
      `Missing dealer rows for ${assetDefinition.label}: ${missingDealer.join(", ")}`,
    );
  }

  const biasMode: BiasMode = "blended";
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
  const pairs =
    assetClass === "fx"
      ? derivePairDirections(currencies, pairDefs, biasMode)
      : derivePairDirectionsByBase(currencies, pairDefs, biasMode);
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

function numberOrNull(value: string | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractDealerEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  return {
    dealer_delta_long: numberOrNull(row.change_in_dealer_long_all),
    dealer_delta_short: numberOrNull(row.change_in_dealer_short_all),
  };
}

function extractDealerExtraEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  return {
    dealer_spread: numberOrNull(row.dealer_positions_spread_all),
    dealer_spread_delta: numberOrNull(row.change_in_dealer_spread_all),
    dealer_pct_oi_long: numberOrNull(row.pct_of_oi_dealer_long_all),
    dealer_pct_oi_short: numberOrNull(row.pct_of_oi_dealer_short_all),
    dealer_traders_long: numberOrNull(row.traders_dealer_long_all),
    dealer_traders_short: numberOrNull(row.traders_dealer_short_all),
  };
}

function extractCommercialEnrichment(
  row: CotRow | null,
  source: CotSource,
): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  if (source === "disaggregated") {
    return {
      commercial_delta_long: numberOrNull(row.change_in_prod_merc_long),
      commercial_delta_short: numberOrNull(row.change_in_prod_merc_short),
    };
  }

  return {
    commercial_delta_long: numberOrNull(row.change_in_comm_long_all),
    commercial_delta_short: numberOrNull(row.change_in_comm_short_all),
  };
}

function extractLegacyNoncommEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  return {
    noncomm_long: numberOrNull(row.noncomm_positions_long_all),
    noncomm_short: numberOrNull(row.noncomm_positions_short_all),
    noncomm_spread: numberOrNull(row.noncomm_postions_spread_all),
    noncomm_delta_long: numberOrNull(row.change_in_noncomm_long_all),
    noncomm_delta_short: numberOrNull(row.change_in_noncomm_short_all),
    noncomm_delta_spread: numberOrNull(row.change_in_noncomm_spead_all),
    noncomm_pct_oi_long: numberOrNull(row.pct_of_oi_noncomm_long_all),
    noncomm_pct_oi_short: numberOrNull(row.pct_of_oi_noncomm_short_all),
    noncomm_traders_long: numberOrNull(row.traders_noncomm_long_all),
    noncomm_traders_short: numberOrNull(row.traders_noncomm_short_all),
    noncomm_traders_spread: numberOrNull(row.traders_noncomm_spread_all),
  };
}

function extractLegacyCommercialExtraEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  return {
    commercial_traders_long: numberOrNull(row.traders_comm_long_all),
    commercial_traders_short: numberOrNull(row.traders_comm_short_all),
    commercial_pct_oi_long: numberOrNull(row.pct_of_oi_comm_long_all),
    commercial_pct_oi_short: numberOrNull(row.pct_of_oi_comm_short_all),
  };
}

function extractAssetMgrEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  return {
    asset_mgr_long: numberOrNull(row.asset_mgr_positions_long),
    asset_mgr_short: numberOrNull(row.asset_mgr_positions_short),
    asset_mgr_spread: numberOrNull(row.asset_mgr_positions_spread),
    asset_mgr_delta_long: numberOrNull(row.change_in_asset_mgr_long),
    asset_mgr_delta_short: numberOrNull(row.change_in_asset_mgr_short),
    asset_mgr_pct_oi_long: numberOrNull(row.pct_of_oi_asset_mgr_long),
    asset_mgr_pct_oi_short: numberOrNull(row.pct_of_oi_asset_mgr_short),
    asset_mgr_traders_long: numberOrNull(row.traders_asset_mgr_long_all),
    asset_mgr_traders_short: numberOrNull(row.traders_asset_mgr_short_all),
  };
}

function extractLevMoneyEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  return {
    lev_money_long: numberOrNull(row.lev_money_positions_long),
    lev_money_short: numberOrNull(row.lev_money_positions_short),
    lev_money_spread: numberOrNull(row.lev_money_positions_spread),
    lev_money_delta_long: numberOrNull(row.change_in_lev_money_long),
    lev_money_delta_short: numberOrNull(row.change_in_lev_money_short),
    lev_money_pct_oi_long: numberOrNull(row.pct_of_oi_lev_money_long),
    lev_money_pct_oi_short: numberOrNull(row.pct_of_oi_lev_money_short),
    lev_money_traders_long: numberOrNull(row.traders_lev_money_long_all),
    lev_money_traders_short: numberOrNull(row.traders_lev_money_short_all),
  };
}

function extractOtherReptEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  return {
    other_rept_long: numberOrNull(row.other_rept_positions_long),
    other_rept_short: numberOrNull(row.other_rept_positions_short),
    other_rept_spread: numberOrNull(row.other_rept_positions_spread),
    other_rept_delta_long: numberOrNull(row.change_in_other_rept_long),
    other_rept_delta_short: numberOrNull(row.change_in_other_rept_short),
  };
}

function extractNonreptEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  return {
    nonrept_long: numberOrNull(row.nonrept_positions_long_all),
    nonrept_short: numberOrNull(row.nonrept_positions_short_all),
    nonrept_delta_long: numberOrNull(row.change_in_nonrept_long_all),
    nonrept_delta_short: numberOrNull(row.change_in_nonrept_short_all),
  };
}

function extractNetConcentrationEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  return {
    conc_net_4_long: numberOrNull(row.conc_net_le_4_tdr_long_all),
    conc_net_4_short: numberOrNull(row.conc_net_le_4_tdr_short_all),
    conc_net_8_long: numberOrNull(row.conc_net_le_8_tdr_long_all),
    conc_net_8_short: numberOrNull(row.conc_net_le_8_tdr_short_all),
  };
}

function extractMarketLevelEnrichment(row: CotRow | null): Partial<CotEnrichment> {
  if (!row) {
    return {};
  }

  return {
    open_interest: numberOrNull(row.open_interest_all),
    oi_delta: numberOrNull(row.change_in_open_interest_all),
    conc_gross_4_long: numberOrNull(row.conc_gross_le_4_tdr_long),
    conc_gross_4_short: numberOrNull(row.conc_gross_le_4_tdr_short),
    conc_gross_8_long: numberOrNull(row.conc_gross_le_8_tdr_long),
    conc_gross_8_short: numberOrNull(row.conc_gross_le_8_tdr_short),
  };
}

function buildMarketEnrichment(
  dealerRow: CotRow | null,
  commercialRow: CotRow | null,
  commercialSource: CotSource,
): CotEnrichment {
  return {
    ...extractDealerEnrichment(dealerRow),
    ...extractDealerExtraEnrichment(dealerRow),
    ...extractCommercialEnrichment(commercialRow, commercialSource),
    ...extractLegacyNoncommEnrichment(commercialRow),
    ...extractLegacyCommercialExtraEnrichment(commercialRow),
    ...extractAssetMgrEnrichment(dealerRow),
    ...extractLevMoneyEnrichment(dealerRow),
    ...extractOtherReptEnrichment(dealerRow),
    ...extractNonreptEnrichment(dealerRow),
    ...extractNetConcentrationEnrichment(dealerRow),
    ...extractMarketLevelEnrichment(commercialRow),
    ...extractMarketLevelEnrichment(dealerRow),
  };
}

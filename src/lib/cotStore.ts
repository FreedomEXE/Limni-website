import { query, queryOne } from "./db";
import { buildCurrencySnapshot, derivePairDirections } from "./cotCompute";
import { fetchCotRowsForDate, fetchLatestReportDate } from "./cotFetch";
import { COT_MARKETS, COT_VARIANT, SUPPORTED_CURRENCIES } from "./cotMarkets";
import type { CotSnapshot, CurrencySnapshot, PairSnapshot } from "./cotTypes";

export async function readSnapshot(): Promise<CotSnapshot | null> {
  try {
    const row = await queryOne<{
      report_date: string;
      currencies: Record<string, CurrencySnapshot>;
      pairs: Record<string, PairSnapshot>;
      fetched_at: Date;
    }>(
      "SELECT report_date, currencies, pairs, fetched_at FROM cot_snapshots ORDER BY report_date DESC LIMIT 1"
    );

    if (!row) {
      return null;
    }

    return {
      report_date: row.report_date,
      last_refresh_utc: row.fetched_at.toISOString(),
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
      `INSERT INTO cot_snapshots (report_date, currencies, pairs, fetched_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (report_date)
       DO UPDATE SET
         currencies = EXCLUDED.currencies,
         pairs = EXCLUDED.pairs,
         fetched_at = EXCLUDED.fetched_at`,
      [
        snapshot.report_date,
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

export async function refreshSnapshot(): Promise<CotSnapshot> {
  const reportDate = await fetchLatestReportDate();
  const marketNames = SUPPORTED_CURRENCIES.map(
    (currency) => COT_MARKETS[currency].marketName,
  );
  const rows = await fetchCotRowsForDate(reportDate, marketNames, COT_VARIANT);

  const byMarket = new Map(
    rows.map((row) => [row.contract_market_name, row]),
  );

  const currencies: Record<string, CurrencySnapshot> = {};
  const missing: string[] = [];

  for (const currency of SUPPORTED_CURRENCIES) {
    const marketName = COT_MARKETS[currency].marketName;
    const row = byMarket.get(marketName);

    if (!row) {
      missing.push(currency);
      continue;
    }

    const dealerLong = Number(row.dealer_positions_long_all);
    const dealerShort = Number(row.dealer_positions_short_all);

    if (!Number.isFinite(dealerLong) || !Number.isFinite(dealerShort)) {
      throw new Error(`Invalid dealer data for ${currency}`);
    }

    currencies[currency] = buildCurrencySnapshot(dealerLong, dealerShort);
  }

  if (missing.length > 0) {
    throw new Error(`Missing COT rows for: ${missing.join(", ")}`);
  }

  const pairs = derivePairDirections(currencies);
  const snapshot: CotSnapshot = {
    report_date: reportDate,
    last_refresh_utc: new Date().toISOString(),
    currencies,
    pairs,
  };

  await writeSnapshot(snapshot);
  return snapshot;
}

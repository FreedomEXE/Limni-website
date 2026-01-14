import fs from "node:fs/promises";
import path from "node:path";
import { buildCurrencySnapshot, derivePairDirections } from "./cotCompute";
import { fetchCotRowsForDate, fetchLatestReportDate } from "./cotFetch";
import { COT_MARKETS, COT_VARIANT, SUPPORTED_CURRENCIES } from "./cotMarkets";
import type { CotSnapshot, CurrencySnapshot } from "./cotTypes";

// Use /tmp in production (Vercel), data/ locally
const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const SNAPSHOT_PATH = path.join(DATA_DIR, "cot_snapshot.json");

async function ensureDataDir() {
  const dir = path.dirname(SNAPSHOT_PATH);
  await fs.mkdir(dir, { recursive: true });
}

export async function readSnapshot(): Promise<CotSnapshot | null> {
  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, "utf-8");
    return JSON.parse(raw) as CotSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeSnapshot(snapshot: CotSnapshot): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
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

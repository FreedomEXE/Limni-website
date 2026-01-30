import Database from "better-sqlite3";

type CountRow = {
  taken: number | null;
  recouped: number | null;
  open: number | null;
};

type RecoupRow = {
  eligible_first_at: number | null;
  recouped_at: number | null;
};

type SignalRow = {
  eligible_first_at: number | null;
};

type SnapshotRow = {
  last_seen_metrics: string | null;
};

type TokenRow = {
  token_address: string;
  last_name: string | null;
  last_symbol: string | null;
  called_price_usd: number | null;
  post_alert_price_usd: number | null;
  max_price_usd: number | null;
  min_price_usd: number | null;
  moonbag_tokens: number | null;
  moonbag_sold_at: number | null;
  moonbag_sold_value: number | null;
  recouped_at: number | null;
  eligible_first_at: number | null;
};

let cachedDb: Database.Database | null = null;

function parseNumber(value: string | null | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDbPath(): string {
  const configured = process.env.TRENCHBOT_DB_PATH;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }
  throw new Error("TRENCHBOT_DB_PATH is not configured.");
}

function getDb(): Database.Database {
  if (!cachedDb) {
    cachedDb = new Database(getDbPath(), { readonly: true, fileMustExist: true });
  }
  return cachedDb;
}

function readStateValue(db: Database.Database, key: string): string | null {
  const row = db.prepare("SELECT value FROM state WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

function toIsoSeconds(epochSeconds: number | null): string | null {
  if (!epochSeconds) {
    return null;
  }
  const date = new Date(epochSeconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function computeMultiple(price: number | null, entry: number | null): number | null {
  if (!price || !entry || entry === 0) {
    return null;
  }
  return price / entry;
}

function computePercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = Math.min(100, Math.max(0, percentile));
  const index = (clamped / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function getUtcHour(epochSeconds: number | null): number | null {
  if (!epochSeconds) {
    return null;
  }
  const date = new Date(epochSeconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getUTCHours();
}

type MetricsSnapshot = {
  marketCap?: number | null;
  volume1h?: number | null;
  change1h?: number | null;
  change6h?: number | null;
  change24h?: number | null;
  priceUsd?: number | null;
  holderCount?: number | null;
};

function parseSnapshot(raw: string | null): MetricsSnapshot | null {
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") {
      return null;
    }
    return {
      marketCap: Number.isFinite(Number(data.marketCap)) ? Number(data.marketCap) : null,
      volume1h: Number.isFinite(Number(data.volume1h)) ? Number(data.volume1h) : null,
      change1h: Number.isFinite(Number(data.change1h)) ? Number(data.change1h) : null,
      change6h: Number.isFinite(Number(data.change6h)) ? Number(data.change6h) : null,
      change24h: Number.isFinite(Number(data.change24h)) ? Number(data.change24h) : null,
      priceUsd: Number.isFinite(Number(data.priceUsd)) ? Number(data.priceUsd) : null,
      holderCount: Number.isFinite(Number(data.holderCount)) ? Number(data.holderCount) : null,
    };
  } catch {
    return null;
  }
}

export function getTrenchbotSummary() {
  const db = getDb();
  const resetAt = parseNumber(readStateValue(db, "sim_reset_at"), 0);
  const startBalance = parseNumber(readStateValue(db, "sim_start_balance"), 100);
  const positionSize = parseNumber(readStateValue(db, "sim_position_size"), 1);
  const cash = parseNumber(readStateValue(db, "sim_cash"), startBalance);

  const countRow = db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN sim_taken = 1 THEN 1 ELSE 0 END) AS taken,
        SUM(CASE WHEN sim_taken = 1 AND recouped_at IS NOT NULL THEN 1 ELSE 0 END) AS recouped,
        SUM(CASE WHEN sim_taken = 1 AND recouped_at IS NULL THEN 1 ELSE 0 END) AS open
      FROM tokens
      WHERE eligible_first_at >= ?
    `,
    )
    .get(resetAt) as CountRow;

  const recoupRows = db
    .prepare(
      `
      SELECT eligible_first_at, recouped_at
      FROM tokens
      WHERE sim_taken = 1
        AND recouped_at IS NOT NULL
        AND eligible_first_at >= ?
    `,
    )
    .all(resetAt) as RecoupRow[];

  const signalRows = db
    .prepare(
      `
      SELECT eligible_first_at
      FROM tokens
      WHERE sim_taken = 1
        AND eligible_first_at >= ?
    `,
    )
    .all(resetAt) as SignalRow[];

  const recoupDurations = recoupRows
    .map((row) =>
      row.eligible_first_at && row.recouped_at
        ? Math.max(0, row.recouped_at - row.eligible_first_at)
        : null,
    )
    .filter((value): value is number => value !== null);

  const signalsByHour = Array.from({ length: 24 }, () => 0);
  for (const row of signalRows) {
    const hour = getUtcHour(row.eligible_first_at);
    if (hour != null) {
      signalsByHour[hour] += 1;
    }
  }

  const recoupsByHour = Array.from({ length: 24 }, () => [] as number[]);
  for (const row of recoupRows) {
    const hour = getUtcHour(row.eligible_first_at);
    if (hour == null || !row.recouped_at || !row.eligible_first_at) {
      continue;
    }
    const duration = Math.max(0, row.recouped_at - row.eligible_first_at);
    recoupsByHour[hour].push(duration);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const lookback24h = nowSec - 24 * 3600;
  const snapshotRows = db
    .prepare(
      `
      SELECT last_seen_metrics
      FROM tokens
      WHERE last_seen >= ?
        AND last_seen_metrics IS NOT NULL
    `,
    )
    .all(lookback24h) as SnapshotRow[];

  const snapshots = snapshotRows
    .map((row) => parseSnapshot(row.last_seen_metrics))
    .filter((row): row is MetricsSnapshot => row != null);

  const metricValues = <T extends keyof MetricsSnapshot>(key: T) =>
    snapshots
      .map((snap) => snap[key])
      .filter((value): value is number => value != null && Number.isFinite(value));

  const volume1hTotal = metricValues("volume1h").reduce((sum, val) => sum + val, 0);

  const moonbagRows = db
    .prepare(
      `
      SELECT
        token_address,
        last_name,
        last_symbol,
        called_price_usd,
        post_alert_price_usd,
        max_price_usd,
        min_price_usd,
        moonbag_tokens,
        moonbag_sold_at,
        moonbag_sold_value,
        recouped_at,
        eligible_first_at
      FROM tokens
      WHERE sim_taken = 1
        AND moonbag_tokens IS NOT NULL
        AND eligible_first_at >= ?
      ORDER BY eligible_first_at DESC
      LIMIT 200
    `,
    )
    .all(resetAt) as TokenRow[];

  const recentRows = db
    .prepare(
      `
      SELECT
        token_address,
        last_name,
        last_symbol,
        called_price_usd,
        post_alert_price_usd,
        max_price_usd,
        min_price_usd,
        moonbag_tokens,
        moonbag_sold_at,
        moonbag_sold_value,
        recouped_at,
        eligible_first_at
      FROM tokens
      WHERE sim_taken = 1
        AND eligible_first_at >= ?
      ORDER BY eligible_first_at DESC
      LIMIT 50
    `,
    )
    .all(resetAt) as TokenRow[];

  const formatToken = (row: TokenRow) => {
    const entry = row.called_price_usd ?? null;
    const current = row.post_alert_price_usd ?? null;
    return {
      token_address: row.token_address,
      name: row.last_name ?? "",
      symbol: row.last_symbol ?? "",
      eligible_first_at: row.eligible_first_at ?? null,
      eligible_first_iso: toIsoSeconds(row.eligible_first_at ?? null),
      entry_price_usd: entry,
      current_price_usd: current,
      max_price_usd: row.max_price_usd ?? null,
      min_price_usd: row.min_price_usd ?? null,
      current_multiple: computeMultiple(current, entry),
      max_multiple: computeMultiple(row.max_price_usd ?? null, entry),
      min_multiple: computeMultiple(row.min_price_usd ?? null, entry),
      recouped_at: row.recouped_at ?? null,
      recouped_iso: toIsoSeconds(row.recouped_at ?? null),
      moonbag_tokens: row.moonbag_tokens ?? null,
      moonbag_sold_at: row.moonbag_sold_at ?? null,
      moonbag_sold_iso: toIsoSeconds(row.moonbag_sold_at ?? null),
      moonbag_sold_value: row.moonbag_sold_value ?? null,
    };
  };

  return {
    updated_at: new Date().toISOString(),
    sim: {
      reset_at: resetAt,
      reset_iso: toIsoSeconds(resetAt),
      start_balance: startBalance,
      position_size: positionSize,
      cash,
    },
    counts: {
      taken: countRow.taken ?? 0,
      recouped: countRow.recouped ?? 0,
      open: countRow.open ?? 0,
    },
    stats: {
      recoup_p50_sec: computePercentile(recoupDurations, 50),
      recoup_p75_sec: computePercentile(recoupDurations, 75),
      recoup_p90_sec: computePercentile(recoupDurations, 90),
      signals_by_hour: signalsByHour,
      recoup_p50_by_hour: recoupsByHour.map((bucket) => computePercentile(bucket, 50)),
    },
    solana: {
      sample_tokens_24h: snapshots.length,
      volume1h_total: volume1hTotal,
      marketcap_median: computePercentile(metricValues("marketCap"), 50),
      change1h_median: computePercentile(metricValues("change1h"), 50),
      change6h_median: computePercentile(metricValues("change6h"), 50),
      change24h_median: computePercentile(metricValues("change24h"), 50),
      price_median: computePercentile(metricValues("priceUsd"), 50),
      holders_median: computePercentile(metricValues("holderCount"), 50),
    },
    moonbags: moonbagRows.map(formatToken),
    recent: recentRows.map(formatToken),
  };
}

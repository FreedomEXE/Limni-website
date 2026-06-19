import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";
import type { AssetClass } from "@/lib/cotMarkets";
import { getCanonicalWeekWindow } from "@/lib/canonicalPriceWindows";
import { repoPath } from "@/lib/server/repoPaths";

export type LocalM1WarehouseBar = {
  symbol: string;
  assetClass: AssetClass;
  timeframe: "1m";
  barOpenUtc: string;
  barCloseUtc: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  sourceProvider: string;
  qualityStatus: string;
};

export type LocalM1CoverageRow = {
  symbol: string;
  assetClass: AssetClass;
  weekOpenUtc: string;
  timeframe: "1m";
  expectedBars: number;
  actualBars: number;
  coveragePct: number;
  firstBarUtc: string | null;
  lastBarUtc: string | null;
  sourceProvider: string | null;
  qualityStatus: string | null;
  status: "complete" | "partial" | "missing" | "in_progress";
};

export type LocalStrengthSnapshotRow = {
  snapshotTimeUtc: string;
  assetClass: AssetClass;
  sourceType: "currency";
  window: string;
  key: string;
  rawStrength: number | null;
  normalizedStrength: number | null;
  coverageExpectedBars: number;
  coverageActualBars: number;
  coveragePct: number;
  contributingPairs: number;
  sourceTimeframe: "1m";
  sourceProvider: string;
  derivationVersion: string;
};

type LocalM1DbRow = {
  symbol: string;
  asset_class: AssetClass;
  timeframe: "1m";
  bar_open_utc: string;
  bar_close_utc: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  source_provider: string;
  quality_status: string;
};

type LocalM1CoverageDbRow = {
  actual_bars: number;
  first_bar_utc: string | null;
  last_bar_utc: string | null;
  source_provider: string | null;
  quality_status: string | null;
};

type LocalStrengthSnapshotDbRow = {
  snapshot_time_utc: string;
  asset_class: AssetClass;
  source_type: "currency";
  strength_window: string;
  key_symbol: string;
  raw_strength: number | null;
  normalized_strength: number | null;
  coverage_expected_bars: number;
  coverage_actual_bars: number;
  coverage_pct: number;
  contributing_pairs: number;
  source_timeframe: "1m";
  source_provider: string;
  derivation_version: string;
};

let dbCache: Database.Database | null = null;
let dbCachePath: string | null = null;

export function getLocalM1WarehousePath() {
  const configured = process.env.LIMNI_M1_SQLITE_PATH?.trim();
  if (!configured) {
    return repoPath("data", "canonical-m1", "canonical-m1.sqlite");
  }
  return path.isAbsolute(configured)
    ? configured
    : repoPath(configured);
}

export function getLocalStrengthWarehousePath() {
  const configured = process.env.LIMNI_STRENGTH_SQLITE_PATH?.trim();
  if (!configured) {
    return getLocalM1WarehousePath();
  }
  return path.isAbsolute(configured)
    ? configured
    : repoPath(configured);
}

export function localM1WarehouseExists(databasePath = getLocalM1WarehousePath()) {
  return existsSync(databasePath);
}

export function localStrengthWarehouseExists(databasePath = getLocalStrengthWarehousePath()) {
  return existsSync(databasePath);
}

export function shouldUseLocalM1Warehouse(resolution: string) {
  if (resolution !== "1m") return false;
  const mode = process.env.LIMNI_M1_WAREHOUSE?.trim().toLowerCase();
  return mode === "sqlite" || Boolean(process.env.LIMNI_M1_SQLITE_PATH?.trim());
}

export function shouldUseLocalStrengthWarehouse() {
  const mode = process.env.LIMNI_STRENGTH_WAREHOUSE?.trim().toLowerCase();
  if (mode === "sqlite") return true;
  if (mode === "postgres" || mode === "db" || mode === "database") return false;
  return Boolean(process.env.LIMNI_STRENGTH_SQLITE_PATH?.trim());
}

export function openLocalM1Warehouse(options: {
  databasePath?: string;
  readonly?: boolean;
} = {}) {
  const databasePath = options.databasePath ?? getLocalM1WarehousePath();
  if (!options.readonly) {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }
  if (!options.readonly && dbCache && dbCachePath === databasePath) {
    return dbCache;
  }

  const db = new Database(databasePath, {
    readonly: options.readonly ?? false,
    fileMustExist: options.readonly ?? false,
  });
  if (!options.readonly) {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
  }
  db.pragma("temp_store = MEMORY");
  db.pragma("busy_timeout = 5000");

  if (!options.readonly) {
    ensureLocalM1WarehouseSchema(db);
    dbCache = db;
    dbCachePath = databasePath;
  }

  return db;
}

export function ensureLocalM1WarehouseSchema(db = openLocalM1Warehouse()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS canonical_m1_bars (
      symbol TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      bar_open_utc TEXT NOT NULL,
      bar_close_utc TEXT NOT NULL,
      open_price REAL NOT NULL,
      high_price REAL NOT NULL,
      low_price REAL NOT NULL,
      close_price REAL NOT NULL,
      source_provider TEXT NOT NULL,
      quality_status TEXT NOT NULL,
      PRIMARY KEY (symbol, timeframe, bar_open_utc)
    ) WITHOUT ROWID;

    CREATE INDEX IF NOT EXISTS idx_canonical_m1_bars_asset_time
      ON canonical_m1_bars(asset_class, timeframe, bar_open_utc);
  `);
}

export function ensureLocalStrengthWarehouseSchema(db = openLocalM1Warehouse({
  databasePath: getLocalStrengthWarehousePath(),
})) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fx_strength_history_snapshots (
      snapshot_time_utc TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      source_type TEXT NOT NULL,
      strength_window TEXT NOT NULL,
      key_symbol TEXT NOT NULL,
      raw_strength REAL,
      normalized_strength REAL,
      coverage_expected_bars INTEGER NOT NULL,
      coverage_actual_bars INTEGER NOT NULL,
      coverage_pct REAL NOT NULL,
      contributing_pairs INTEGER NOT NULL,
      source_timeframe TEXT NOT NULL,
      source_provider TEXT NOT NULL,
      derivation_version TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      PRIMARY KEY (
        snapshot_time_utc,
        asset_class,
        source_type,
        strength_window,
        key_symbol,
        derivation_version
      )
    ) WITHOUT ROWID;

    CREATE INDEX IF NOT EXISTS idx_fx_strength_history_lookup
      ON fx_strength_history_snapshots (
        asset_class,
        source_type,
        strength_window,
        key_symbol,
        derivation_version,
        snapshot_time_utc
      );

    CREATE INDEX IF NOT EXISTS idx_fx_strength_history_snapshot
      ON fx_strength_history_snapshots (
        asset_class,
        derivation_version,
        snapshot_time_utc
      );
  `);
}

export function upsertLocalM1Bars(rows: LocalM1WarehouseBar[], db = openLocalM1Warehouse()) {
  if (rows.length === 0) return 0;
  const insert = db.prepare(`
    INSERT INTO canonical_m1_bars (
      symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
      open_price, high_price, low_price, close_price,
      source_provider, quality_status
    ) VALUES (
      @symbol, @assetClass, @timeframe, @barOpenUtc, @barCloseUtc,
      @openPrice, @highPrice, @lowPrice, @closePrice,
      @sourceProvider, @qualityStatus
    )
    ON CONFLICT(symbol, timeframe, bar_open_utc) DO UPDATE SET
      asset_class = excluded.asset_class,
      bar_close_utc = excluded.bar_close_utc,
      open_price = excluded.open_price,
      high_price = excluded.high_price,
      low_price = excluded.low_price,
      close_price = excluded.close_price,
      source_provider = excluded.source_provider,
      quality_status = excluded.quality_status
  `);
  const transaction = db.transaction((batch: LocalM1WarehouseBar[]) => {
    for (const row of batch) {
      insert.run(row);
    }
  });
  transaction(rows);
  return rows.length;
}

export function writeLocalStrengthHistorySnapshots(
  rows: LocalStrengthSnapshotRow[],
  databasePath = getLocalStrengthWarehousePath(),
) {
  if (rows.length === 0) return 0;
  const db = openLocalM1Warehouse({ databasePath });
  ensureLocalStrengthWarehouseSchema(db);
  const insert = db.prepare(`
    INSERT INTO fx_strength_history_snapshots (
      snapshot_time_utc,
      asset_class,
      source_type,
      strength_window,
      key_symbol,
      raw_strength,
      normalized_strength,
      coverage_expected_bars,
      coverage_actual_bars,
      coverage_pct,
      contributing_pairs,
      source_timeframe,
      source_provider,
      derivation_version
    ) VALUES (
      @snapshotTimeUtc,
      @assetClass,
      @sourceType,
      @window,
      @key,
      @rawStrength,
      @normalizedStrength,
      @coverageExpectedBars,
      @coverageActualBars,
      @coveragePct,
      @contributingPairs,
      @sourceTimeframe,
      @sourceProvider,
      @derivationVersion
    )
    ON CONFLICT (
      snapshot_time_utc,
      asset_class,
      source_type,
      strength_window,
      key_symbol,
      derivation_version
    ) DO UPDATE SET
      raw_strength = excluded.raw_strength,
      normalized_strength = excluded.normalized_strength,
      coverage_expected_bars = excluded.coverage_expected_bars,
      coverage_actual_bars = excluded.coverage_actual_bars,
      coverage_pct = excluded.coverage_pct,
      contributing_pairs = excluded.contributing_pairs,
      source_timeframe = excluded.source_timeframe,
      source_provider = excluded.source_provider,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `);
  const transaction = db.transaction((batch: LocalStrengthSnapshotRow[]) => {
    for (const row of batch) insert.run(row);
  });
  transaction(rows);
  return rows.length;
}

export function readLocalStrengthHistorySnapshots(options: {
  fromUtc: string;
  toUtc: string;
  windows: string[];
  derivationVersion: string;
  databasePath?: string;
}): LocalStrengthSnapshotRow[] {
  const databasePath = options.databasePath ?? getLocalStrengthWarehousePath();
  if (!localStrengthWarehouseExists(databasePath) || options.windows.length === 0) {
    return [];
  }
  const db = openLocalM1Warehouse({ databasePath, readonly: true });
  const placeholders = options.windows.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT snapshot_time_utc,
           asset_class,
           source_type,
           strength_window,
           key_symbol,
           raw_strength,
           normalized_strength,
           coverage_expected_bars,
           coverage_actual_bars,
           coverage_pct,
           contributing_pairs,
           source_timeframe,
           source_provider,
           derivation_version
      FROM fx_strength_history_snapshots
     WHERE asset_class = 'fx'
       AND source_type = 'currency'
       AND derivation_version = ?
       AND strength_window IN (${placeholders})
       AND snapshot_time_utc >= ?
       AND snapshot_time_utc <= ?
     ORDER BY strength_window ASC, key_symbol ASC, snapshot_time_utc ASC
  `).all(
    options.derivationVersion,
    ...options.windows,
    normalizeIso(options.fromUtc),
    normalizeIso(options.toUtc),
  ) as LocalStrengthSnapshotDbRow[];
  db.close();

  return rows.map((row) => ({
    snapshotTimeUtc: normalizeIso(row.snapshot_time_utc),
    assetClass: row.asset_class,
    sourceType: row.source_type,
    window: row.strength_window,
    key: row.key_symbol,
    rawStrength: row.raw_strength === null ? null : Number(row.raw_strength),
    normalizedStrength: row.normalized_strength === null ? null : Number(row.normalized_strength),
    coverageExpectedBars: Number(row.coverage_expected_bars),
    coverageActualBars: Number(row.coverage_actual_bars),
    coveragePct: Number(row.coverage_pct),
    contributingPairs: Number(row.contributing_pairs),
    sourceTimeframe: row.source_timeframe,
    sourceProvider: row.source_provider,
    derivationVersion: row.derivation_version,
  }));
}

export function readLocalM1Bars(
  symbols: string[],
  fromUtc: string,
  toUtc: string,
  resolution = "1m",
  databasePath = getLocalM1WarehousePath(),
): Map<string, CanonicalPriceBar[]> {
  const normalizedSymbols = normalizeSymbols(symbols);
  const bySymbol = new Map<string, CanonicalPriceBar[]>();
  for (const symbol of normalizedSymbols) bySymbol.set(symbol, []);
  if (normalizedSymbols.length === 0 || resolution !== "1m" || !localM1WarehouseExists(databasePath)) {
    return bySymbol;
  }

  const db = openLocalM1Warehouse({ databasePath, readonly: true });
  const placeholders = normalizedSymbols.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
           open_price, high_price, low_price, close_price,
           source_provider, quality_status
      FROM canonical_m1_bars
     WHERE symbol IN (${placeholders})
       AND timeframe = ?
       AND bar_open_utc >= ?
       AND bar_open_utc < ?
     ORDER BY symbol ASC, bar_open_utc ASC
  `).all(...normalizedSymbols, resolution, normalizeIso(fromUtc), normalizeIso(toUtc)) as LocalM1DbRow[];
  db.close();

  for (const row of rows) {
    const symbol = row.symbol.toUpperCase();
    bySymbol.get(symbol)?.push(mapDbRowToCanonicalPriceBar(row));
  }
  return bySymbol;
}

export function readLocalM1CoverageRows(options: {
  symbols: string[];
  weeks: string[];
  assetClass?: AssetClass;
  databasePath?: string;
}): LocalM1CoverageRow[] {
  const assetClass = options.assetClass ?? "fx";
  const databasePath = options.databasePath ?? getLocalM1WarehousePath();
  const normalizedSymbols = normalizeSymbols(options.symbols);
  if (!localM1WarehouseExists(databasePath)) {
    return normalizedSymbols.flatMap((symbol) =>
      options.weeks.map((weekOpenUtc) => buildMissingCoverageRow(symbol, assetClass, weekOpenUtc)),
    );
  }

  const db = openLocalM1Warehouse({ databasePath, readonly: true });
  const coverage = db.prepare(`
    SELECT
      COUNT(bar_open_utc) AS actual_bars,
      MIN(bar_open_utc) AS first_bar_utc,
      MAX(bar_open_utc) AS last_bar_utc
    FROM canonical_m1_bars
    WHERE symbol = ?
      AND asset_class = ?
      AND timeframe = '1m'
      AND bar_open_utc >= ?
      AND bar_open_utc < ?
  `);
  const latest = db.prepare(`
    SELECT source_provider, quality_status
    FROM canonical_m1_bars
    WHERE symbol = ?
      AND asset_class = ?
      AND timeframe = '1m'
      AND bar_open_utc >= ?
      AND bar_open_utc < ?
    ORDER BY bar_open_utc DESC
    LIMIT 1
  `);

  const rows: LocalM1CoverageRow[] = [];
  for (const symbol of normalizedSymbols) {
    for (const weekOpenUtc of options.weeks) {
      const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
      const openUtc = window.openUtc.toISO() ?? "";
      const closeUtc = window.closeUtc.toISO() ?? "";
      const aggregate = coverage.get(symbol, assetClass, openUtc, closeUtc) as LocalM1CoverageDbRow;
      const latestRow = latest.get(symbol, assetClass, openUtc, closeUtc) as Pick<
        LocalM1CoverageDbRow,
        "source_provider" | "quality_status"
      > | undefined;
      const expectedBars = expectedMinuteBars(weekOpenUtc, assetClass);
      const actualBars = Number(aggregate.actual_bars ?? 0);
      const coveragePct = expectedBars > 0 ? round((actualBars / expectedBars) * 100, 2) : 100;
      const row: LocalM1CoverageRow = {
        symbol,
        assetClass,
        weekOpenUtc,
        timeframe: "1m",
        expectedBars,
        actualBars,
        coveragePct,
        firstBarUtc: aggregate.first_bar_utc,
        lastBarUtc: aggregate.last_bar_utc,
        sourceProvider: latestRow?.source_provider ?? null,
        qualityStatus: latestRow?.quality_status ?? null,
        status: "missing",
      };
      row.status = coverageStatus(row);
      rows.push(row);
    }
  }
  db.close();
  return rows;
}

function mapDbRowToCanonicalPriceBar(row: LocalM1DbRow): CanonicalPriceBar {
  return {
    symbol: row.symbol,
    assetClass: row.asset_class,
    timeframe: row.timeframe,
    barOpenUtc: row.bar_open_utc,
    barCloseUtc: row.bar_close_utc,
    openPrice: Number(row.open_price),
    highPrice: Number(row.high_price),
    lowPrice: Number(row.low_price),
    closePrice: Number(row.close_price),
    sourceProvider: row.source_provider,
    qualityStatus: row.quality_status,
  };
}

function buildMissingCoverageRow(
  symbol: string,
  assetClass: AssetClass,
  weekOpenUtc: string,
): LocalM1CoverageRow {
  return {
    symbol,
    assetClass,
    weekOpenUtc,
    timeframe: "1m",
    expectedBars: expectedMinuteBars(weekOpenUtc, assetClass),
    actualBars: 0,
    coveragePct: 0,
    firstBarUtc: null,
    lastBarUtc: null,
    sourceProvider: null,
    qualityStatus: null,
    status: "missing",
  };
}

function expectedMinuteBars(weekOpenUtc: string, assetClass: AssetClass) {
  const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
  return Math.ceil(window.closeUtc.diff(window.openUtc, "minutes").minutes);
}

function coverageStatus(row: {
  weekOpenUtc: string;
  assetClass: AssetClass;
  actualBars: number;
  coveragePct: number;
}) {
  const closeUtc = getCanonicalWeekWindow(row.weekOpenUtc, row.assetClass).closeUtc;
  if (closeUtc.toMillis() > Date.now() - 5 * 60_000) {
    return "in_progress" as const;
  }
  if (row.actualBars === 0) return "missing" as const;
  if (row.coveragePct >= 90) return "complete" as const;
  return "partial" as const;
}

function normalizeSymbols(symbols: string[]) {
  return Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))).sort();
}

function normalizeIso(value: string) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : value;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

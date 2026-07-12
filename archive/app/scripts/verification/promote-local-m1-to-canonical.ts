import { createHash } from "node:crypto";
import { finished } from "node:stream/promises";

import { loadEnvConfig } from "@next/env";
import Database from "better-sqlite3";
import { Pool, type PoolClient } from "pg";

import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getLocalM1WarehousePath } from "@/lib/research/localM1Warehouse";

loadEnvConfig(process.cwd());

const copyFrom = (require("pg-copy-streams") as { from: (sql: string) => NodeJS.WritableStream }).from;

type LocalM1Row = {
  symbol: string;
  asset_class: string;
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

type CliOptions = {
  fromUtc: string;
  toUtc: string;
  symbols: string[];
  batchDays: number;
  write: boolean;
  sqlitePath: string;
};

const FX_SYMBOLS = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase()).sort();
const DEFAULT_FROM_UTC = "2019-02-01T22:00:00.000Z";
const DEFAULT_TO_UTC = "2023-01-02T00:00:00.000Z";

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`);
}

function normalizeIso(value: string, label: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    throw new Error(`Invalid --${label}: ${value}`);
  }
  return new Date(ms).toISOString();
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, received ${value}`);
  }
  return parsed;
}

function parseSymbols(value: string | null) {
  const requested = (value ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);
  if (requested.length === 0) return FX_SYMBOLS;
  const allowed = new Set(FX_SYMBOLS);
  const invalid = requested.filter((symbol) => !allowed.has(symbol));
  if (invalid.length > 0) {
    throw new Error(`Unsupported FX symbols: ${invalid.join(",")}`);
  }
  return [...new Set(requested)].sort();
}

function parseCli(): CliOptions {
  return {
    fromUtc: normalizeIso(argValue("from") ?? DEFAULT_FROM_UTC, "from"),
    toUtc: normalizeIso(argValue("to") ?? DEFAULT_TO_UTC, "to"),
    symbols: parseSymbols(argValue("symbols")),
    batchDays: parsePositiveInteger(argValue("batch-days"), 14),
    write: hasFlag("write"),
    sqlitePath: argValue("sqlite-path") ?? getLocalM1WarehousePath(),
  };
}

function databaseSsl(databaseUrl: string) {
  return databaseUrl.includes("render.com") || databaseUrl.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false;
}

function openPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  return new Pool({
    connectionString: databaseUrl,
    ssl: databaseSsl(databaseUrl),
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
}

function addDays(isoUtc: string, days: number) {
  const date = new Date(isoUtc);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function minIso(left: string, right: string) {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

function csvValue(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function csvLine(row: LocalM1Row) {
  return [
    row.symbol,
    row.asset_class,
    row.timeframe,
    row.bar_open_utc,
    row.bar_close_utc,
    row.open_price,
    row.high_price,
    row.low_price,
    row.close_price,
    row.source_provider,
    row.quality_status,
  ].map(csvValue).join(",") + "\n";
}

async function ensureTempTable(client: PoolClient) {
  await client.query(`
    CREATE TEMP TABLE IF NOT EXISTS gate55_local_m1_promote (
      symbol TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      bar_open_utc TIMESTAMPTZ NOT NULL,
      bar_close_utc TIMESTAMPTZ NOT NULL,
      open_price DOUBLE PRECISION NOT NULL,
      high_price DOUBLE PRECISION NOT NULL,
      low_price DOUBLE PRECISION NOT NULL,
      close_price DOUBLE PRECISION NOT NULL,
      source_provider TEXT NOT NULL,
      quality_status TEXT NOT NULL
    ) ON COMMIT PRESERVE ROWS
  `);
}

function readLocalRows(options: {
  db: Database.Database;
  symbol: string;
  fromUtc: string;
  toUtc: string;
}) {
  return options.db.prepare(`
    SELECT symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
           open_price, high_price, low_price, close_price,
           source_provider, quality_status
      FROM canonical_m1_bars
     WHERE symbol = ?
       AND timeframe = '1m'
       AND bar_open_utc >= ?
       AND bar_open_utc < ?
     ORDER BY bar_open_utc ASC
  `).all(options.symbol, options.fromUtc, options.toUtc) as LocalM1Row[];
}

async function copyRows(client: PoolClient, rows: LocalM1Row[]) {
  if (rows.length === 0) return 0;
  const stream = client.query(copyFrom(`
    COPY gate55_local_m1_promote (
      symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
      open_price, high_price, low_price, close_price,
      source_provider, quality_status
    ) FROM STDIN WITH (FORMAT csv)
  `));
  for (const row of rows) {
    stream.write(csvLine(row));
  }
  stream.end();
  await finished(stream);
  return rows.length;
}

async function promoteTempRows(client: PoolClient) {
  const result = await client.query(`
    INSERT INTO canonical_price_bars (
      symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
      open_price, high_price, low_price, close_price,
      source_provider, quality_status
    )
    SELECT symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
           open_price, high_price, low_price, close_price,
           source_provider, quality_status
      FROM gate55_local_m1_promote
    ON CONFLICT (symbol, timeframe, bar_open_utc) DO NOTHING
  `);
  await client.query("TRUNCATE gate55_local_m1_promote");
  return result.rowCount ?? 0;
}

async function main() {
  const options = parseCli();
  if (Date.parse(options.toUtc) <= Date.parse(options.fromUtc)) {
    throw new Error("--to must be after --from.");
  }

  const sqlite = new Database(options.sqlitePath, { readonly: true, fileMustExist: true });
  const pool = openPool();
  const client = await pool.connect();
  const hash = createHash("sha256");

  let batches = 0;
  let localRows = 0;
  let copiedRows = 0;
  let insertedRows = 0;
  const startedAt = Date.now();

  console.log(
    [
      "Gate55 local M1 -> canonical promotion",
      `from=${options.fromUtc}`,
      `to=${options.toUtc}`,
      `symbols=${options.symbols.length}`,
      `batchDays=${options.batchDays}`,
      `write=${options.write}`,
      `sqlite=${options.sqlitePath}`,
    ].join(" | "),
  );

  try {
    if (options.write) {
      await ensureTempTable(client);
    }

    for (const symbol of options.symbols) {
      let fromUtc = options.fromUtc;
      while (Date.parse(fromUtc) < Date.parse(options.toUtc)) {
        const toUtc = minIso(addDays(fromUtc, options.batchDays), options.toUtc);
        const rows = readLocalRows({ db: sqlite, symbol, fromUtc, toUtc });
        batches += 1;
        localRows += rows.length;
        hash.update(`${symbol}|${fromUtc}|${toUtc}|${rows.length}\n`);
        if (rows.length > 0) {
          hash.update(rows[0]!.bar_open_utc);
          hash.update(rows.at(-1)!.bar_open_utc);
        }

        let batchCopied = 0;
        let batchInserted = 0;
        if (options.write && rows.length > 0) {
          batchCopied = await copyRows(client, rows);
          batchInserted = await promoteTempRows(client);
          copiedRows += batchCopied;
          insertedRows += batchInserted;
        }

        console.log(
          [
            `symbol=${symbol}`,
            `from=${fromUtc}`,
            `to=${toUtc}`,
            `localRows=${rows.length}`,
            options.write ? `copied=${batchCopied}` : "copied=0",
            options.write ? `inserted=${batchInserted}` : "inserted=0",
            `elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
          ].join(" | "),
        );

        fromUtc = toUtc;
      }
    }
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }

  console.log(
    [
      "promotionSummary",
      `batches=${batches}`,
      `localRows=${localRows}`,
      `copiedRows=${copiedRows}`,
      `insertedRows=${insertedRows}`,
      `inputHash=${hash.digest("hex").toUpperCase()}`,
      `elapsed=${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    ].join(" | "),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

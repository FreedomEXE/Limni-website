/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: menthorqOverlay.ts
 *
 * Description:
 * DB-backed MenthorQ overlay snapshots with CSV import helpers.
 * Runtime gates can read this source first, then fallback to CSV.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { appPath } from "@/lib/server/repoPaths";

import { getPool } from "./db";

export type MenthorqGammaCondition = "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";

export type MenthorqOverlayRow = {
  snapshotDateUtc: string;
  symbol: string;
  gammaCondition: MenthorqGammaCondition;
  netGexText: string | null;
  totalGexText: string | null;
  timestampText: string | null;
  sourceUrl: string | null;
  capturedAtUtc: string | null;
  parseConfidence: "HIGH" | "MEDIUM" | "LOW" | null;
  notes: string | null;
  sourceMode: "MENTHORQ_BROWSER_CAPTURE";
};

type DbOverlayRow = {
  snapshot_date_utc: Date | string;
  symbol: string;
  gamma_condition: string;
  net_gex_text: string | null;
  total_gex_text: string | null;
  timestamp_text: string | null;
  source_url: string | null;
  captured_at_utc: Date | string | null;
  parse_confidence: string | null;
  notes: string | null;
  source_mode: string;
};

const DEFAULT_CSV_PATH = appPath("reports", "bias-gate", "menthorq-gamma-daily.csv");

const GAMMA_SYMBOL_PREFIXES = [
  "6E",
  "6B",
  "6J",
  "6A",
  "6S",
  "6C",
  "6N",
  "DX",
  "ES",
  "NQ",
  "GC",
  "SI",
  "CL",
] as const;

function normalizePair(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export function normalizeGammaSymbol(value: unknown): string {
  const raw = normalizePair(value).replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";
  const prefix = GAMMA_SYMBOL_PREFIXES.find((candidate) => raw.startsWith(candidate));
  return prefix ?? raw;
}

function parseGammaCondition(value: unknown): MenthorqGammaCondition {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw.startsWith("POS")) return "POSITIVE";
  if (raw.startsWith("NEG")) return "NEGATIVE";
  if (raw.startsWith("NEU")) return "NEUTRAL";
  return "UNKNOWN";
}

function parseConfidence(value: unknown): "HIGH" | "MEDIUM" | "LOW" | null {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "HIGH" || raw === "MEDIUM" || raw === "LOW") return raw;
  return null;
}

function toIsoUtc(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = DateTime.fromISO(String(value), { zone: "utc" });
  return parsed.isValid ? parsed.toISO() ?? String(value) : String(value);
}

function toDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const parsed = DateTime.fromISO(String(value), { zone: "utc" });
  return parsed.isValid ? parsed.toISODate() ?? String(value).slice(0, 10) : String(value).slice(0, 10);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function parseCsvObjects(filePath: string): Array<Record<string, string>> {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function mapDbRow(row: DbOverlayRow): MenthorqOverlayRow {
  return {
    snapshotDateUtc: toDateOnly(row.snapshot_date_utc) ?? "",
    symbol: row.symbol,
    gammaCondition: parseGammaCondition(row.gamma_condition),
    netGexText: row.net_gex_text,
    totalGexText: row.total_gex_text,
    timestampText: row.timestamp_text,
    sourceUrl: row.source_url,
    capturedAtUtc: toIsoUtc(row.captured_at_utc),
    parseConfidence: parseConfidence(row.parse_confidence),
    notes: row.notes,
    sourceMode: "MENTHORQ_BROWSER_CAPTURE",
  };
}

export async function importMenthorqDailyCsv(options?: {
  csvPath?: string;
  targetDateUtc?: string;
}): Promise<{
  snapshotDateUtc: string;
  rowsParsed: number;
  rowsUpserted: number;
  symbols: string[];
}> {
  const snapshotDateUtc = options?.targetDateUtc?.trim() || DateTime.utc().toISODate() || "";
  if (!snapshotDateUtc) {
    throw new Error("Failed to resolve snapshot date.");
  }
  const csvPath = options?.csvPath?.trim()
    ? path.resolve(process.cwd(), options.csvPath)
    : process.env.PERFORMANCE_MENTHORQ_GAMMA_CSV?.trim()
      ? path.resolve(process.cwd(), process.env.PERFORMANCE_MENTHORQ_GAMMA_CSV)
      : DEFAULT_CSV_PATH;

  const sourceRows = parseCsvObjects(csvPath);
  const candidates = sourceRows.filter((row) => String(row.date ?? "").trim() === snapshotDateUtc);

  const bySymbol = new Map<string, MenthorqOverlayRow>();
  for (const row of candidates) {
    const symbol = normalizeGammaSymbol(row.page_symbol || row.symbol_input || row.symbol || "");
    if (!symbol) continue;

    const capturedAt = toIsoUtc(row.captured_at_utc) ?? `${snapshotDateUtc}T00:00:00.000Z`;
    const nextRow: MenthorqOverlayRow = {
      snapshotDateUtc,
      symbol,
      gammaCondition: parseGammaCondition(row.gamma_condition || row.gammacondition),
      netGexText: (row.net_gex || "").trim() || null,
      totalGexText: (row.total_gex || "").trim() || null,
      timestampText: (row.timestamp_text || "").trim() || null,
      sourceUrl: (row.source_url || "").trim() || null,
      capturedAtUtc: capturedAt,
      parseConfidence: parseConfidence(row.parse_confidence),
      notes: (row.notes || "").trim() || null,
      sourceMode: "MENTHORQ_BROWSER_CAPTURE",
    };

    const prev = bySymbol.get(symbol);
    if (!prev) {
      bySymbol.set(symbol, nextRow);
      continue;
    }
    const prevTs = Date.parse(prev.capturedAtUtc ?? "");
    const nextTs = Date.parse(nextRow.capturedAtUtc ?? "");
    if (!Number.isFinite(prevTs) || (Number.isFinite(nextTs) && nextTs >= prevTs)) {
      bySymbol.set(symbol, nextRow);
    }
  }

  const rows = Array.from(bySymbol.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  if (rows.length === 0) {
    return {
      snapshotDateUtc,
      rowsParsed: 0,
      rowsUpserted: 0,
      symbols: [],
    };
  }

  const pool = getPool();
  const client = await pool.connect();
  let rowsUpserted = 0;
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      const result = await client.query(
        `
          INSERT INTO menthorq_overlay_snapshots (
            snapshot_date_utc,
            symbol,
            gamma_condition,
            net_gex_text,
            total_gex_text,
            timestamp_text,
            source_url,
            captured_at_utc,
            parse_confidence,
            notes,
            source_mode
          )
          VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8::timestamp, $9, $10, $11)
          ON CONFLICT (snapshot_date_utc, symbol)
          DO UPDATE SET
            gamma_condition = EXCLUDED.gamma_condition,
            net_gex_text = EXCLUDED.net_gex_text,
            total_gex_text = EXCLUDED.total_gex_text,
            timestamp_text = EXCLUDED.timestamp_text,
            source_url = EXCLUDED.source_url,
            captured_at_utc = EXCLUDED.captured_at_utc,
            parse_confidence = EXCLUDED.parse_confidence,
            notes = EXCLUDED.notes,
            source_mode = EXCLUDED.source_mode
        `,
        [
          row.snapshotDateUtc,
          row.symbol,
          row.gammaCondition,
          row.netGexText,
          row.totalGexText,
          row.timestampText,
          row.sourceUrl,
          row.capturedAtUtc,
          row.parseConfidence,
          row.notes,
          row.sourceMode,
        ],
      );
      rowsUpserted += result.rowCount ?? 0;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    snapshotDateUtc,
    rowsParsed: rows.length,
    rowsUpserted,
    symbols: rows.map((row) => row.symbol),
  };
}

export async function readMenthorqSnapshotsByDate(snapshotDateUtc: string): Promise<MenthorqOverlayRow[]> {
  const pool = getPool();
  const rows = await pool.query<DbOverlayRow>(
    `
      SELECT
        snapshot_date_utc,
        symbol,
        gamma_condition,
        net_gex_text,
        total_gex_text,
        timestamp_text,
        source_url,
        captured_at_utc,
        parse_confidence,
        notes,
        source_mode
      FROM menthorq_overlay_snapshots
      WHERE snapshot_date_utc = $1::date
      ORDER BY symbol ASC
    `,
    [snapshotDateUtc],
  );
  return rows.rows.map(mapDbRow);
}

export async function readLatestMenthorqDate(): Promise<string | null> {
  const pool = getPool();
  const latest = await pool.query<{ snapshot_date_utc: Date | string }>(
    `
      SELECT snapshot_date_utc
      FROM menthorq_overlay_snapshots
      ORDER BY snapshot_date_utc DESC
      LIMIT 1
    `,
  );
  if (latest.rows.length === 0) return null;
  return toDateOnly(latest.rows[0].snapshot_date_utc);
}

export async function readLatestMenthorqSnapshots(): Promise<{
  snapshotDateUtc: string;
  rows: MenthorqOverlayRow[];
} | null> {
  const snapshotDateUtc = await readLatestMenthorqDate();
  if (!snapshotDateUtc) return null;
  const rows = await readMenthorqSnapshotsByDate(snapshotDateUtc);
  return {
    snapshotDateUtc,
    rows,
  };
}

export async function readMenthorqHistory(symbol: string, daysBack: number): Promise<MenthorqOverlayRow[]> {
  const normalizedSymbol = normalizeGammaSymbol(symbol);
  if (!normalizedSymbol) return [];

  const safeDaysBack = Math.max(1, Math.min(365, Math.trunc(daysBack || 1)));
  const fromDate = DateTime.utc().minus({ days: safeDaysBack - 1 }).toISODate();
  if (!fromDate) return [];

  const pool = getPool();
  const rows = await pool.query<DbOverlayRow>(
    `
      SELECT
        snapshot_date_utc,
        symbol,
        gamma_condition,
        net_gex_text,
        total_gex_text,
        timestamp_text,
        source_url,
        captured_at_utc,
        parse_confidence,
        notes,
        source_mode
      FROM menthorq_overlay_snapshots
      WHERE symbol = $1
        AND snapshot_date_utc >= $2::date
      ORDER BY snapshot_date_utc DESC
    `,
    [normalizedSymbol, fromDate],
  );

  return rows.rows.map(mapDbRow);
}

/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: sourceFingerprint.ts
 *
 * Description:
 * Source-data fingerprints for strategy artifact invalidation. A weekly
 * strategy shard should be considered stale when the anchor-specific weekly
 * source rows it was built from change.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import crypto from "node:crypto";
import { query } from "@/lib/db";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { readFrozenSourceLedgerWeek, type FrozenSourceLedgerWeek } from "@/lib/sourceFreeze/sourceLedger";
import {
  CANONICAL_ANCHOR_VERSION,
  EXECUTION_ANCHOR_VERSION,
  type AnchorType,
} from "@/lib/pairReturns";

type WeeklySourceRow = {
  period_open_utc: Date;
  anchor_type: AnchorType;
  anchor_version: string;
  symbol: string;
  asset_class: string;
  open_price: number | string;
  close_price: number | string;
  return_pct: number | string;
  derivation_version: string | null;
  updated_at: Date;
};

export type WeeklySourceFingerprint = {
  weekOpenUtc: string;
  anchorType: AnchorType;
  anchorVersion: string;
  fingerprint: string;
  rowCount: number;
  maxUpdatedAtUtc: string | null;
  derivationVersions: string[];
};

type FrozenLedgerFingerprintPayload = {
  ledgerVersion: string;
  releaseWindow: string;
  freezeTargetUtc: string;
  complete: boolean;
  trustedForFreeze: boolean;
  sourceHash: string;
} | null;

const SOURCE_FINGERPRINT_CACHE_TTL_MS = Number(
  process.env.SOURCE_FINGERPRINT_CACHE_TTL_MS ?? "30000",
);

function normalizeNumber(value: number | string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(8)) : null;
}

function normalizeWeek(value: Date) {
  return value.toISOString();
}

function getAnchorVersion(anchorType: AnchorType) {
  return anchorType === "execution" ? EXECUTION_ANCHOR_VERSION : CANONICAL_ANCHOR_VERSION;
}

function buildHashPayload(
  weekOpenUtc: string,
  anchorType: AnchorType,
  anchorVersion: string,
  rows: WeeklySourceRow[],
  frozenLedger: FrozenLedgerFingerprintPayload,
) {
  const normalizedRows = rows
    .map((row) => ({
      anchorType: row.anchor_type,
      anchorVersion: row.anchor_version,
      symbol: row.symbol.toUpperCase(),
      assetClass: row.asset_class,
      openPrice: normalizeNumber(row.open_price),
      closePrice: normalizeNumber(row.close_price),
      returnPct: normalizeNumber(row.return_pct),
      derivationVersion: row.derivation_version ?? "unknown",
    }))
    .sort((left, right) =>
      left.assetClass === right.assetClass
        ? left.symbol.localeCompare(right.symbol)
        : left.assetClass.localeCompare(right.assetClass),
    );

  return JSON.stringify({
    weekOpenUtc,
    anchorType,
    anchorVersion,
    frozenLedger,
    rows: normalizedRows,
  });
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function toFrozenLedgerFingerprintPayload(
  ledger: FrozenSourceLedgerWeek | null,
): FrozenLedgerFingerprintPayload {
  if (!ledger) return null;
  return {
    ledgerVersion: ledger.ledgerVersion,
    releaseWindow: ledger.releaseWindow,
    freezeTargetUtc: ledger.freezeTargetUtc,
    complete: ledger.complete,
    trustedForFreeze: ledger.trustedForFreeze,
    sourceHash: ledger.sourceHash,
  };
}

function buildFingerprint(
  weekOpenUtc: string,
  anchorType: AnchorType,
  anchorVersion: string,
  rows: WeeklySourceRow[],
  frozenLedger: FrozenLedgerFingerprintPayload,
): WeeklySourceFingerprint {
  const updatedValues = rows
    .map((row) => row.updated_at.toISOString())
    .sort((left, right) => right.localeCompare(left));
  const derivationVersions = Array.from(
    new Set(rows.map((row) => row.derivation_version ?? "unknown")),
  ).sort();
  return {
    weekOpenUtc,
    anchorType,
    anchorVersion,
    fingerprint: `weekly-source-v3:${anchorType}:${anchorVersion}:${hash(
      buildHashPayload(weekOpenUtc, anchorType, anchorVersion, rows, frozenLedger),
    )}`,
    rowCount: rows.length,
    maxUpdatedAtUtc: updatedValues[0] ?? null,
    derivationVersions,
  };
}

export async function listWeeklySourceFingerprints(
  weekOpenUtcs: string[],
  anchorType: AnchorType = "execution",
): Promise<Record<string, WeeklySourceFingerprint>> {
  const uniqueWeeks = Array.from(new Set(weekOpenUtcs)).sort();
  if (uniqueWeeks.length === 0) return {};
  const anchorVersion = getAnchorVersion(anchorType);
  const cacheKey = `weeklySourceFingerprints:v3:${anchorType}:${anchorVersion}:${uniqueWeeks.join(",")}`;
  return getOrSetRuntimeCache(cacheKey, SOURCE_FINGERPRINT_CACHE_TTL_MS, async () => {
    const rows = await query<WeeklySourceRow>(
      `SELECT period_open_utc,
              anchor_type,
              anchor_version,
              symbol,
              asset_class,
              open_price,
              close_price,
              return_pct,
              derivation_version,
              updated_at
         FROM pair_period_returns
        WHERE period_type = 'weekly'
          AND period_open_utc = ANY($1::timestamptz[])
          AND anchor_type = $2
          AND anchor_version = $3
        ORDER BY period_open_utc ASC, asset_class ASC, symbol ASC`,
      [uniqueWeeks, anchorType, anchorVersion],
    );

    const rowsByWeek = new Map<string, WeeklySourceRow[]>();
    for (const weekOpenUtc of uniqueWeeks) rowsByWeek.set(weekOpenUtc, []);
    for (const row of rows) {
      const weekOpenUtc = normalizeWeek(row.period_open_utc);
      const list = rowsByWeek.get(weekOpenUtc);
      if (list) list.push(row);
    }

    const frozenLedgersByWeek = new Map(
      await Promise.all(
        uniqueWeeks.map(async (weekOpenUtc) => [
          weekOpenUtc,
          toFrozenLedgerFingerprintPayload(await readFrozenSourceLedgerWeek(weekOpenUtc)),
        ] as const),
      ),
    );

    return Object.fromEntries(
      uniqueWeeks.map((weekOpenUtc) => [
        weekOpenUtc,
        buildFingerprint(
          weekOpenUtc,
          anchorType,
          anchorVersion,
          rowsByWeek.get(weekOpenUtc) ?? [],
          frozenLedgersByWeek.get(weekOpenUtc) ?? null,
        ),
      ]),
    );
  });
}

export function fingerprintMapToStringMap(
  fingerprints: Record<string, WeeklySourceFingerprint>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fingerprints).map(([weekOpenUtc, entry]) => [weekOpenUtc, entry.fingerprint]),
  );
}

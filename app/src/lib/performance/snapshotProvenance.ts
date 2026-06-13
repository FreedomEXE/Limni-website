/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: snapshotProvenance.ts
 *
 * Description:
 * Computes the canonical snapshot timestamp per data source for a given
 * trading week. Used to show exactly what data drove each week's signals.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { queryOne } from "@/lib/db";
import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { dbTimestampValueToIsoUtc } from "@/lib/dbUtcTimestamp";
import type { BaseBasketModel } from "@/lib/performance/basketSource";
import { readFrozenSourceLedgerWeek } from "@/lib/sourceFreeze/sourceLedger";
import { latestIso } from "@/lib/time";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export type SourceProvenance = {
  label: string;
  snapshotUtc: string | null;
  source: string;
  status: "frozen" | "source_snapshot" | "missing" | "invalid_future";
  invalidReason?: string | null;
};

export type WeekSnapshotProvenance = {
  weekOpenUtc: string;
  cot: SourceProvenance;
  sentiment: SourceProvenance;
  strength: SourceProvenance;
};

function toIsoUtc(value: Date | string | null | undefined): string | null {
  return dbTimestampValueToIsoUtc(value);
}

function validAtOrBefore(isoUtc: string | null, cutoffMs: number): string | null {
  if (!isoUtc) return null;
  const parsed = Date.parse(isoUtc);
  if (!Number.isFinite(parsed) || parsed > cutoffMs) {
    return null;
  }
  return isoUtc;
}

function buildSourceProvenance({
  label,
  frozenSnapshotUtc,
  frozenSource,
  legacySnapshotUtc,
  legacySource,
  missingSource,
  cutoffMs,
}: {
  label: string;
  frozenSnapshotUtc: string | null;
  frozenSource: string;
  legacySnapshotUtc: string | null;
  legacySource: string;
  missingSource: string;
  cutoffMs: number;
}): SourceProvenance {
  const validFrozenSnapshotUtc = validAtOrBefore(frozenSnapshotUtc, cutoffMs);
  if (validFrozenSnapshotUtc) {
    return {
      label,
      snapshotUtc: validFrozenSnapshotUtc,
      source: frozenSource,
      status: "frozen",
    };
  }

  const validLegacySnapshotUtc = validAtOrBefore(legacySnapshotUtc, cutoffMs);
  if (validLegacySnapshotUtc) {
    return {
      label,
      snapshotUtc: validLegacySnapshotUtc,
      source: legacySource,
      status: "source_snapshot",
    };
  }

  const hasFutureFrozen = Boolean(frozenSnapshotUtc && !validFrozenSnapshotUtc);
  const hasFutureLegacy = Boolean(legacySnapshotUtc && !validLegacySnapshotUtc);
  if (hasFutureFrozen || hasFutureLegacy) {
    return {
      label,
      snapshotUtc: null,
      source: hasFutureFrozen ? frozenSource : legacySource,
      status: "invalid_future",
      invalidReason: "Source timestamp is later than the current app/server time.",
    };
  }

  return {
    label,
    snapshotUtc: null,
    source: missingSource,
    status: "missing",
  };
}

type SnapshotRow = {
  snapshot_utc: Date | string | null;
};

async function readFrozenSourceSnapshotUtc(
  weekOpenUtc: string,
  source: BaseBasketModel,
): Promise<string | null> {
  try {
    const ledger = await readFrozenSourceLedgerWeek(weekOpenUtc);
    if (!ledger) {
      return null;
    }
    return latestIso(
      ledger.signals
        .filter((signal) => signal.model === source)
        .map((signal) => signal.sourceTimestampUtc),
    );
  } catch {
    return null;
  }
}

export async function getWeekSnapshotProvenance(
  weekOpenUtc: string,
): Promise<WeekSnapshotProvenance> {
  const normalizedWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  const cotReportDate = deriveCotReportDate(normalizedWeekOpenUtc);
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  const [
    cotRow,
    frozenSentimentUtc,
    frozenStrengthUtc,
    sentimentLockRow,
    sentimentAggregateRow,
    strengthLockRow,
    currencyStrengthRow,
    assetStrengthRow,
  ] =
    await Promise.all([
      queryOne<SnapshotRow>(
        `
          SELECT MAX(created_at)::text AS snapshot_utc
          FROM cot_snapshots
          WHERE report_date = $1::date
            AND created_at <= ($2::timestamptz AT TIME ZONE 'UTC')
        `,
        [cotReportDate, nowIso],
      ),
      readFrozenSourceSnapshotUtc(normalizedWeekOpenUtc, "sentiment"),
      readFrozenSourceSnapshotUtc(normalizedWeekOpenUtc, "strength"),
      queryOne<SnapshotRow>(
        `
          SELECT MAX(snapshot_time_utc)::text AS snapshot_utc
          FROM sentiment_daily_snapshots
          WHERE snapshot_time_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
            AND snapshot_time_utc <= ($2::timestamptz AT TIME ZONE 'UTC')
            AND snapshot_time_utc >= (($1::timestamptz AT TIME ZONE 'UTC') - INTERVAL '7 days')
        `,
        [normalizedWeekOpenUtc, nowIso],
      ),
      queryOne<SnapshotRow>(
        `
          SELECT MAX(timestamp_utc)::text AS snapshot_utc
          FROM sentiment_aggregates
          WHERE timestamp_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
            AND timestamp_utc <= ($2::timestamptz AT TIME ZONE 'UTC')
        `,
        [normalizedWeekOpenUtc, nowIso],
      ),
      queryOne<SnapshotRow>(
        `
          SELECT MAX(COALESCE(source_snapshot_utc, locked_at_utc))::text AS snapshot_utc
          FROM strength_weekly_snapshots
          WHERE week_open_utc = ($1::timestamptz AT TIME ZONE 'UTC')
            AND COALESCE(source_snapshot_utc, locked_at_utc) <= ($2::timestamptz AT TIME ZONE 'UTC')
        `,
        [normalizedWeekOpenUtc, nowIso],
      ),
      queryOne<SnapshotRow>(
        `
          SELECT MAX(snapshot_time_utc)::text AS snapshot_utc
          FROM currency_strength_snapshots
          WHERE snapshot_time_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
            AND snapshot_time_utc <= ($2::timestamptz AT TIME ZONE 'UTC')
            AND "window" IN ('1h', '4h', '24h')
        `,
        [normalizedWeekOpenUtc, nowIso],
      ),
      queryOne<SnapshotRow>(
        `
          SELECT MAX(snapshot_time_utc)::text AS snapshot_utc
          FROM asset_strength_snapshots
          WHERE snapshot_time_utc <= ($1::timestamptz AT TIME ZONE 'UTC')
            AND snapshot_time_utc <= ($2::timestamptz AT TIME ZONE 'UTC')
            AND "window" IN ('1h', '4h', '24h')
        `,
        [normalizedWeekOpenUtc, nowIso],
      ),
    ]);

  const lockedStrengthUtc = toIsoUtc(strengthLockRow?.snapshot_utc);
  const liveStrengthUtc = [toIsoUtc(currencyStrengthRow?.snapshot_utc), toIsoUtc(assetStrengthRow?.snapshot_utc)]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const sentimentLockUtc = toIsoUtc(sentimentLockRow?.snapshot_utc);
  const sentimentAggregateUtc = toIsoUtc(sentimentAggregateRow?.snapshot_utc);
  const sentimentSnapshotUtc = sentimentLockUtc ?? sentimentAggregateUtc;
  const sentimentSource = sentimentLockUtc
    ? "sentiment_daily_snapshots_legacy"
    : sentimentAggregateUtc
      ? "sentiment_aggregates_legacy"
      : "sentiment_missing";
  const strengthSnapshotUtc = lockedStrengthUtc ?? liveStrengthUtc;
  const strengthSource = lockedStrengthUtc
    ? "strength_weekly_snapshots"
    : liveStrengthUtc
      ? "strength_snapshots_legacy"
      : "strength_missing";

  return {
    weekOpenUtc: normalizedWeekOpenUtc,
    cot: buildSourceProvenance({
      label: "COT",
      frozenSnapshotUtc: null,
      frozenSource: "cot_snapshots",
      legacySnapshotUtc: toIsoUtc(cotRow?.snapshot_utc),
      legacySource: "cot_snapshots",
      missingSource: "cot_snapshots",
      cutoffMs: nowMs,
    }),
    sentiment: buildSourceProvenance({
      label: "Sentiment",
      frozenSnapshotUtc: frozenSentimentUtc,
      frozenSource: "source_freeze_ledger:sentiment_friday_close_v1",
      legacySnapshotUtc: sentimentSnapshotUtc,
      legacySource: sentimentSource,
      missingSource: "sentiment_missing",
      cutoffMs: nowMs,
    }),
    strength: buildSourceProvenance({
      label: "Strength",
      frozenSnapshotUtc: frozenStrengthUtc,
      frozenSource: "source_freeze_ledger:strength_friday_close_v1",
      legacySnapshotUtc: strengthSnapshotUtc,
      legacySource: strengthSource,
      missingSource: "strength_missing",
      cutoffMs: nowMs,
    }),
  };
}

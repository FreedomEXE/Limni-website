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
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export type SourceProvenance = {
  label: string;
  snapshotUtc: string | null;
  source: string;
};

export type WeekSnapshotProvenance = {
  weekOpenUtc: string;
  cot: SourceProvenance;
  sentiment: SourceProvenance;
  strength: SourceProvenance;
};

function toIsoUtc(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

type SnapshotRow = {
  snapshot_utc: Date | string | null;
};

export async function getWeekSnapshotProvenance(
  weekOpenUtc: string,
): Promise<WeekSnapshotProvenance> {
  const normalizedWeekOpenUtc = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  const cotReportDate = deriveCotReportDate(normalizedWeekOpenUtc);

  const [cotRow, sentimentLockRow, sentimentAggregateRow, strengthLockRow, currencyStrengthRow, assetStrengthRow] =
    await Promise.all([
      queryOne<SnapshotRow>(
        `
          SELECT MAX(fetched_at) AS snapshot_utc
          FROM cot_snapshots
          WHERE report_date = $1::date
        `,
        [cotReportDate],
      ),
      queryOne<SnapshotRow>(
        `
          SELECT MAX(snapshot_time_utc) AS snapshot_utc
          FROM sentiment_daily_snapshots
          WHERE snapshot_time_utc <= $1::timestamptz
            AND snapshot_time_utc >= ($1::timestamptz - INTERVAL '7 days')
        `,
        [normalizedWeekOpenUtc],
      ),
      queryOne<SnapshotRow>(
        `
          SELECT MAX(timestamp_utc) AS snapshot_utc
          FROM sentiment_aggregates
          WHERE timestamp_utc <= $1::timestamptz
        `,
        [normalizedWeekOpenUtc],
      ),
      queryOne<SnapshotRow>(
        `
          SELECT MAX(COALESCE(source_snapshot_utc, locked_at_utc)) AS snapshot_utc
          FROM strength_weekly_snapshots
          WHERE week_open_utc = $1::timestamp
        `,
        [normalizedWeekOpenUtc],
      ),
      queryOne<SnapshotRow>(
        `
          SELECT MAX(snapshot_time_utc) AS snapshot_utc
          FROM currency_strength_snapshots
          WHERE snapshot_time_utc <= $1::timestamptz
            AND "window" IN ('1h', '4h', '24h')
        `,
        [normalizedWeekOpenUtc],
      ),
      queryOne<SnapshotRow>(
        `
          SELECT MAX(snapshot_time_utc) AS snapshot_utc
          FROM asset_strength_snapshots
          WHERE snapshot_time_utc <= $1::timestamptz
            AND "window" IN ('1h', '4h', '24h')
        `,
        [normalizedWeekOpenUtc],
      ),
    ]);

  const lockedStrengthUtc = toIsoUtc(strengthLockRow?.snapshot_utc);
  const liveStrengthUtc = [toIsoUtc(currencyStrengthRow?.snapshot_utc), toIsoUtc(assetStrengthRow?.snapshot_utc)]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const sentimentLockUtc = toIsoUtc(sentimentLockRow?.snapshot_utc);
  const sentimentAggregateUtc = toIsoUtc(sentimentAggregateRow?.snapshot_utc);
  const canonicalSnapshotUtc = toIsoUtc(normalizedWeekOpenUtc);

  return {
    weekOpenUtc: normalizedWeekOpenUtc,
    cot: {
      label: "COT",
      snapshotUtc: canonicalSnapshotUtc ?? toIsoUtc(cotRow?.snapshot_utc),
      source: "cot_snapshots",
    },
    sentiment: {
      label: "Sentiment",
      snapshotUtc: canonicalSnapshotUtc ?? sentimentLockUtc ?? sentimentAggregateUtc,
      source: sentimentLockUtc
        ? "sentiment_daily_snapshots_asof_week_open"
        : "sentiment_aggregates",
    },
    strength: {
      label: "Strength",
      snapshotUtc: canonicalSnapshotUtc ?? lockedStrengthUtc ?? liveStrengthUtc,
      source: lockedStrengthUtc ? "strength_weekly_snapshots" : "strength_snapshots_asof_week_open",
    },
  };
}

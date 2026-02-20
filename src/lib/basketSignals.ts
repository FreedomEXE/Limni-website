import { DateTime } from "luxon";
import { evaluateFreshness } from "@/lib/cotFreshness";
import { readSnapshot, refreshAllSnapshots, refreshSnapshotForClass } from "@/lib/cotStore";
import { getAssetClass, listAssetClasses, type AssetClass } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { derivePairDirections, derivePairDirectionsByBase, type BiasMode } from "@/lib/cotCompute";
import { buildAntikytheraSignals } from "@/lib/antikythera";
import { ANTIKYTHERA_MAX_SIGNALS } from "@/lib/antikythera";
import { getAggregatesForWeekStartWithBackfill } from "@/lib/sentiment/store";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { getAdaptiveTrailProfile, type AdaptiveTrailProfile } from "@/lib/adaptiveTrailProfile";

export type BasketSignal = {
  symbol: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  model: "antikythera" | "blended" | "dealer" | "commercial" | "sentiment";
  asset_class: AssetClass;
};

type BasketSignalsResponse = {
  report_date: string;
  last_refresh_utc: string;
  asset_class: AssetClass | "all";
  trading_allowed: boolean;
  reason: string;
  expected_report_date?: string;
  weekly_release_utc?: string;
  minutes_since_weekly_release?: number;
  week_open_utc: string;
  pairs: BasketSignal[];
  trail_profile?: AdaptiveTrailProfile;
};

type AvailableSnapshot = {
  snapshot: NonNullable<Awaited<ReturnType<typeof readSnapshot>>>;
  asset: AssetClass;
};

function sentimentDirection(agg?: SentimentAggregate): "LONG" | "SHORT" | null {
  if (!agg) {
    return null;
  }
  if (agg.flip_state === "FLIPPED_UP") {
    return "LONG";
  }
  if (agg.flip_state === "FLIPPED_DOWN") {
    return "SHORT";
  }
  if (agg.flip_state === "FLIPPED_NEUTRAL") {
    return null;
  }
  if (agg.crowding_state === "CROWDED_LONG") {
    return "SHORT";
  }
  if (agg.crowding_state === "CROWDED_SHORT") {
    return "LONG";
  }
  return null;
}

function buildBiasPairs(
  assetClass: AssetClass,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  mode: BiasMode,
): BasketSignal[] {
  if (!snapshot) {
    return [];
  }
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
  const derived =
    assetClass === "fx"
      ? derivePairDirections(snapshot.currencies, pairDefs, mode)
      : derivePairDirectionsByBase(snapshot.currencies, pairDefs, mode);
  return pairDefs
    .map((pairDef) => {
      const info = derived[pairDef.pair];
      if (!info) {
        return null;
      }
      return {
        symbol: pairDef.pair,
        direction: info.direction,
        model: mode,
        asset_class: assetClass,
      } as BasketSignal;
    })
    .filter((row): row is BasketSignal => Boolean(row));
}

function toAvailable(
  snapshots: Awaited<ReturnType<typeof readSnapshot>>[],
  assets: AssetClass[],
): AvailableSnapshot[] {
  return snapshots
    .map((snapshot, index) => ({ snapshot, asset: assets[index] }))
    .filter((row): row is AvailableSnapshot => Boolean(row.snapshot));
}

function pickReferenceSnapshot(rows: AvailableSnapshot[]): AvailableSnapshot {
  let best = rows[0];
  for (let i = 1; i < rows.length; i += 1) {
    const current = rows[i];
    if (current.snapshot.report_date > best.snapshot.report_date) {
      best = current;
      continue;
    }
    if (
      current.snapshot.report_date === best.snapshot.report_date &&
      current.snapshot.last_refresh_utc > best.snapshot.last_refresh_utc
    ) {
      best = current;
    }
  }
  return best;
}

function shouldAutoRefresh(reason: string, lastRefreshUtc: string): boolean {
  const normalized = reason.toLowerCase();
  const autoRefreshReason =
    normalized === "awaiting weekly cftc update" || normalized === "report_date is stale";
  if (!autoRefreshReason) {
    return false;
  }

  const refreshedAt = DateTime.fromISO(lastRefreshUtc, { zone: "utc" });
  if (!refreshedAt.isValid) {
    return true;
  }

  const ageMinutes = DateTime.utc().diff(refreshedAt, "minutes").minutes;
  // Use a short throttle (2 min) so the EA picks up new signals quickly after the
  // Friday 15:30 ET CFTC release without hammering the upstream API unnecessarily.
  return !Number.isFinite(ageMinutes) || ageMinutes >= 2;
}

export async function buildBasketSignals(options?: {
  assetClass?: AssetClass | "all" | null;
}): Promise<BasketSignalsResponse> {
  const assetParam = options?.assetClass ?? "all";
  const assetClasses = assetParam && assetParam !== "all"
    ? [getAssetClass(assetParam)]
    : listAssetClasses().map((asset) => asset.id);

  let snapshots = await Promise.all(
    assetClasses.map((asset) => readSnapshot({ assetClass: asset })),
  );
  let available = toAvailable(snapshots, assetClasses);

  if (available.length === 0) {
    try {
      if (assetParam && assetParam !== "all") {
        await refreshSnapshotForClass(assetClasses[0]);
      } else {
        await refreshAllSnapshots();
      }
      snapshots = await Promise.all(
        assetClasses.map((asset) => readSnapshot({ assetClass: asset })),
      );
      available = toAvailable(snapshots, assetClasses);
    } catch (error) {
      console.warn("Auto-refresh failed while loading basket snapshots:", error);
    }
  }

  if (available.length === 0) {
    return {
      report_date: "",
      last_refresh_utc: "",
      asset_class: assetParam ?? "all",
      trading_allowed: false,
      reason: "no snapshot available",
      week_open_utc: getDisplayWeekOpenUtc(),
      pairs: [],
    };
  }

  let reference = pickReferenceSnapshot(available);
  let freshness = evaluateFreshness(
    reference.snapshot.report_date,
    reference.snapshot.last_refresh_utc,
  );

  if (
    !freshness.trading_allowed &&
    shouldAutoRefresh(freshness.reason, reference.snapshot.last_refresh_utc)
  ) {
    try {
      if (assetParam && assetParam !== "all") {
        await refreshSnapshotForClass(assetClasses[0]);
      } else {
        await refreshAllSnapshots();
      }
      snapshots = await Promise.all(
        assetClasses.map((asset) => readSnapshot({ assetClass: asset })),
      );
      available = toAvailable(snapshots, assetClasses);
      if (available.length > 0) {
        reference = pickReferenceSnapshot(available);
        freshness = evaluateFreshness(
          reference.snapshot.report_date,
          reference.snapshot.last_refresh_utc,
        );
      }
    } catch (error) {
      console.warn("Auto-refresh failed after freshness check:", error);
    }
  }

  // After Friday 15:30 ET release, use the upcoming trading week anchor so
  // all surfaces (UI, API, EA) agree on the "new week" signal set.
  const weekOpen = getDisplayWeekOpenUtc();
  const weekOpenDt = DateTime.fromISO(weekOpen, { zone: "utc" });
  const weekClose = weekOpenDt.isValid ? weekOpenDt.plus({ days: 7 }) : weekOpenDt;
  const sentiment = await getAggregatesForWeekStartWithBackfill(
    weekOpenDt.toUTC().toISO() ?? weekOpen,
    weekClose.toUTC().toISO() ?? weekOpen,
  );
  const sentimentMap = new Map(sentiment.map((agg) => [agg.symbol, agg]));

  const pairs: BasketSignal[] = [];

  for (const entry of available) {
    const snapshot = entry.snapshot;
    const asset = entry.asset;
    pairs.push(...buildBiasPairs(asset, snapshot, "blended"));
    pairs.push(...buildBiasPairs(asset, snapshot, "dealer"));
    pairs.push(...buildBiasPairs(asset, snapshot, "commercial"));

    const antikytheraSignals = buildAntikytheraSignals({
      assetClass: asset,
      snapshot,
      sentiment,
      maxSignals: ANTIKYTHERA_MAX_SIGNALS,
    });
    pairs.push(
      ...antikytheraSignals.map((signal): BasketSignal => ({
        symbol: signal.pair,
        direction: signal.direction,
        model: "antikythera",
        asset_class: asset,
      })),
    );
  }

  for (const asset of assetClasses) {
    const sentimentPairs = PAIRS_BY_ASSET_CLASS[asset]
      .map((pairDef) => {
        const direction = sentimentDirection(sentimentMap.get(pairDef.pair));
        if (!direction) {
          return null;
        }
        return {
          symbol: pairDef.pair,
          direction,
          model: "sentiment",
          asset_class: asset,
        } as BasketSignal;
      })
      .filter((row): row is BasketSignal => Boolean(row));
    pairs.push(...sentimentPairs);
  }

  // Keep universe coverage explicit for dashboards: add non-trading placeholders
  // for symbols missing from all model outputs.
  const seen = new Set(pairs.map((row) => `${row.asset_class}|${row.symbol}`));
  for (const asset of assetClasses) {
    for (const pairDef of PAIRS_BY_ASSET_CLASS[asset]) {
      const key = `${asset}|${pairDef.pair}`;
      if (seen.has(key)) continue;
      pairs.push({
        symbol: pairDef.pair,
        direction: "NEUTRAL",
        model: "blended",
        asset_class: asset,
      });
      seen.add(key);
    }
  }

  const trailProfile = await getAdaptiveTrailProfile();

  return {
    report_date: reference.snapshot.report_date,
    last_refresh_utc: reference.snapshot.last_refresh_utc,
    asset_class: assetParam ?? "all",
    trading_allowed: freshness.trading_allowed,
    reason: freshness.reason,
    expected_report_date: freshness.expected_report_date,
    weekly_release_utc: freshness.weekly_release_utc,
    minutes_since_weekly_release: freshness.minutes_since_weekly_release,
    week_open_utc: weekOpen,
    pairs,
    trail_profile: trailProfile ?? undefined,
  };
}

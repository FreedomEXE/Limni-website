/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: activeBaseline.ts
 *
 * Description:
 * Active closed-week contract for the App Truth Architecture migration. The
 * original verified seed window is immutable, and newer closed weeks are
 * expected to join through lifecycle/materialization receipts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type {
  ActiveBaselineCoverageSnapshot,
  ActiveBaselineManifest,
} from "@/lib/appTruth/types";
import { V203_CLEAN_14W_FREEZE_WEEKS } from "@/lib/sourceFreeze/fridayFreeze";
import type { ReleaseManifest } from "@/lib/version/releaseManifest";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "@/lib/weekAnchor";
import { DateTime } from "luxon";

export const ACTIVE_BASELINE_ID = "v2.0.3-institutional-seed";
export const ACTIVE_BASELINE_LEGACY_IDS = ["v2.0.3-clean14"] as const;
export const ACTIVE_BASELINE_SOURCE_RELEASE_WINDOW = "active-baseline-source-freeze";
export const ACTIVE_BASELINE_SOURCE_LEDGER_VERSION = "friday_close_v1";
export const ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW = "active-baseline";
export const ACTIVE_BASELINE_SEED_HISTORY_WINDOW = "seed-window";

function normalizeBaselineWeek(weekOpenUtc: string) {
  return normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
}

function distinctSorted(values: readonly string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

export function getPreviousClosedActiveWeekOpenUtc(currentWeekOpenUtc = getDisplayWeekOpenUtc()) {
  const currentWeek = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });
  if (!currentWeek.isValid) return null;
  return currentWeek
    .setZone("America/New_York")
    .minus({ weeks: 1 })
    .toUTC()
    .toISO();
}

function nextWeekOpenUtc(weekOpenUtc: string) {
  const current = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!current.isValid) return null;
  return current
    .setZone("America/New_York")
    .plus({ weeks: 1 })
    .toUTC()
    .toISO();
}

export function getActiveBaselineSeedWeeks() {
  return distinctSorted(V203_CLEAN_14W_FREEZE_WEEKS.map(normalizeBaselineWeek));
}

export function getActiveBaselineReceiptBaselineIds() {
  return distinctSorted([ACTIVE_BASELINE_ID, ...ACTIVE_BASELINE_LEGACY_IDS]);
}

export function getActiveBaselineWeeks(currentWeekOpenUtc = getDisplayWeekOpenUtc()) {
  const seedWeeks = getActiveBaselineSeedWeeks();
  const firstSeedWeek = seedWeeks[0];
  const previousClosedWeek = getPreviousClosedActiveWeekOpenUtc(currentWeekOpenUtc);
  if (!firstSeedWeek || !previousClosedWeek) return seedWeeks;

  const previousClosedMs = Date.parse(previousClosedWeek);
  const firstSeedMs = Date.parse(firstSeedWeek);
  if (!Number.isFinite(previousClosedMs) || !Number.isFinite(firstSeedMs)) return seedWeeks;
  if (previousClosedMs < firstSeedMs) return [];

  const weeks: string[] = [];
  let cursor: string | null = firstSeedWeek;
  while (cursor) {
    const normalized = normalizeBaselineWeek(cursor);
    const cursorMs = Date.parse(normalized);
    if (!Number.isFinite(cursorMs) || cursorMs > previousClosedMs) break;
    weeks.push(normalized);
    cursor = nextWeekOpenUtc(normalized);
  }

  return distinctSorted(weeks.length > 0 ? weeks : seedWeeks);
}

export function getActiveBaselineSelectableWeeks(currentWeekOpenUtc = getDisplayWeekOpenUtc()) {
  const currentWeek = normalizeBaselineWeek(currentWeekOpenUtc);
  return [
    currentWeek,
    ...getActiveBaselineWeeks(currentWeek).filter((week) => week !== currentWeek),
  ];
}

export function buildActiveBaselineManifest(options: {
  manifest: ReleaseManifest;
  generatedAtUtc: string;
  activeWeeks?: readonly string[];
  currentWeekOpenUtc?: string;
}): ActiveBaselineManifest {
  const { manifest } = options;
  const activeWeeks = distinctSorted(
    (options.activeWeeks ?? getActiveBaselineWeeks(options.currentWeekOpenUtc))
      .map(normalizeBaselineWeek),
  );
  return {
    baselineId: ACTIVE_BASELINE_ID,
    activeWeeks,
    sourceNamespace: `${ACTIVE_BASELINE_SOURCE_RELEASE_WINDOW}:${ACTIVE_BASELINE_SOURCE_LEDGER_VERSION}`,
    sourceReleaseWindow: ACTIVE_BASELINE_SOURCE_RELEASE_WINDOW,
    performanceNamespace: `${manifest.cacheNamespace}:history=${ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW}`,
    performanceHistoryWindow: ACTIVE_BASELINE_PERFORMANCE_HISTORY_WINDOW,
    engineNamespace: manifest.components.engineVersion,
    executionLedgerNamespace: [
      manifest.components.anchorVersion,
      manifest.components.executionDerivationVersion,
      manifest.components.tradeLedgerVersion,
    ].join(":"),
    generatedAtUtc: options.generatedAtUtc,
    approvalStatus: "under_review",
    archiveAvailable: true,
  };
}

export function compareWeeksToActiveBaseline(options: {
  expectedWeeks: readonly string[];
  actualWeeks: readonly string[];
  missingDetailLabel: string;
  matchedDetailLabel: string;
  allowExtraWeeks?: boolean;
}): ActiveBaselineCoverageSnapshot {
  const expected = distinctSorted(options.expectedWeeks.map(normalizeBaselineWeek));
  const actual = distinctSorted(options.actualWeeks.map(normalizeBaselineWeek));
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missingWeeks = expected.filter((week) => !actualSet.has(week));
  const extraWeeks = actual.filter((week) => !expectedSet.has(week));
  const matchedWeekCount = expected.filter((week) => actualSet.has(week)).length;

  if (actual.length === 0) {
    return {
      status: "missing",
      expectedWeekCount: expected.length,
      matchedWeekCount,
      missingWeeks,
      extraWeeks,
      detail: `${options.missingDetailLabel}; expected ${expected.length} active week(s).`,
    };
  }

  if (missingWeeks.length === 0 && (extraWeeks.length === 0 || options.allowExtraWeeks)) {
    const extraDetail = extraWeeks.length > 0
      ? `; ${extraWeeks.length} extra archive/stale week(s) observed outside the active baseline`
      : "";
    return {
      status: "match",
      expectedWeekCount: expected.length,
      matchedWeekCount,
      missingWeeks,
      extraWeeks,
      detail: `${options.matchedDetailLabel}: ${matchedWeekCount}/${expected.length} active week(s)${extraDetail}.`,
    };
  }

  return {
    status: "partial",
    expectedWeekCount: expected.length,
    matchedWeekCount,
    missingWeeks,
    extraWeeks,
    detail: `${matchedWeekCount}/${expected.length} active week(s) matched; ${missingWeeks.length} missing, ${extraWeeks.length} extra.`,
  };
}

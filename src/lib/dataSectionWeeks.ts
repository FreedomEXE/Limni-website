/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: dataSectionWeeks.ts
 * Description: Shared canonical week helpers for the Data section.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { DateTime } from "luxon";
import { getActiveBaselineWeeks } from "@/lib/appTruth/activeBaseline";
import { query } from "./db";
import { getOrSetRuntimeCache } from "./runtimeCache";
import { getFridayFreezeDisplayWeekOpenUtc } from "@/lib/sourceFreeze/fridayFreeze";
import { normalizeWeekOpenUtc } from "./weekAnchor";

const DATA_SECTION_WEEKS_CACHE_TTL_MS = Number(
  process.env.DATA_SECTION_WEEKS_CACHE_TTL_MS ?? "15000",
);

function getDataSectionWeeksCacheTtlMs() {
  if (
    Number.isFinite(DATA_SECTION_WEEKS_CACHE_TTL_MS)
    && DATA_SECTION_WEEKS_CACHE_TTL_MS >= 0
  ) {
    return Math.floor(DATA_SECTION_WEEKS_CACHE_TTL_MS);
  }
  return 15000;
}

export type DataSectionWeekEntry = {
  weekOpenUtc: string;
  cotReportDate: string;
};

function normalizeDataSectionWeek(weekOpenUtc: string) {
  return normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
}

function entriesFromWeeks(weeks: readonly string[]): DataSectionWeekEntry[] {
  return Array.from(new Set(weeks.map(normalizeDataSectionWeek).filter(Boolean)))
    .map((weekOpenUtc) => ({
      weekOpenUtc,
      cotReportDate: deriveCotReportDate(weekOpenUtc),
    }));
}

export function deriveCotReportDate(weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!weekOpen.isValid) {
    return weekOpenUtc.slice(0, 10);
  }
  // Current canonical weekly dataset maps each trading week to the preceding Tuesday COT report date.
  // That is a fixed -5 day offset from the canonical week-open anchor for this dataset/window.
  return weekOpen
    .setZone("America/New_York")
    .minus({ days: 5 })
    .toISODate() ?? weekOpenUtc.slice(0, 10);
}

export function listActiveDataSectionWeekEntries(
  currentWeekOpenUtc?: string,
): DataSectionWeekEntry[] {
  return entriesFromWeeks(getActiveBaselineWeeks(currentWeekOpenUtc));
}

export function listActiveDataSectionSelectableWeekEntries(options: {
  currentWeekOpenUtc?: string;
  closedCurrentWeekOpenUtc?: string;
} = {}): DataSectionWeekEntry[] {
  const currentWeekOpenUtc = normalizeDataSectionWeek(
    options.currentWeekOpenUtc ?? getFridayFreezeDisplayWeekOpenUtc(),
  );
  return entriesFromWeeks([
    currentWeekOpenUtc,
    ...getActiveBaselineWeeks(options.closedCurrentWeekOpenUtc)
      .filter((weekOpenUtc) => weekOpenUtc !== currentWeekOpenUtc),
  ]);
}

export async function listDataSectionWeekEntries(): Promise<DataSectionWeekEntry[]> {
  const cacheKey = "dataSectionWeeks:list";
  return getOrSetRuntimeCache(cacheKey, getDataSectionWeeksCacheTtlMs(), async () => {
    const rows = await query<{ period_open_utc: Date }>(
      `SELECT DISTINCT period_open_utc
         FROM pair_period_returns
        WHERE period_type = 'weekly'
        ORDER BY period_open_utc DESC`,
      [],
    );

    return rows
      .map((row) => row.period_open_utc.toISOString())
      .map((weekOpenUtc) => normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc)
      .filter((value, index, all) => all.indexOf(value) === index)
      .map((weekOpenUtc) => ({
        weekOpenUtc,
        cotReportDate: deriveCotReportDate(weekOpenUtc),
      }));
  });
}

export async function listDataSectionWeeks(): Promise<string[]> {
  const entries = await listDataSectionWeekEntries();
  return entries.map((entry) => entry.weekOpenUtc);
}

export async function findDataSectionWeekByReportDate(reportDate: string | null | undefined) {
  if (!reportDate) return null;
  const entries = await listDataSectionWeekEntries();
  return entries.find((entry) => entry.cotReportDate === reportDate) ?? null;
}

export async function findDataSectionReportDateByWeek(weekOpenUtc: string | null | undefined) {
  if (!weekOpenUtc) return null;
  const normalized = normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
  const entries = await listDataSectionWeekEntries();
  return entries.find((entry) => entry.weekOpenUtc === normalized)?.cotReportDate ?? null;
}

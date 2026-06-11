/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: dataIntegrityReport.ts
 *
 * Description:
 * Read model for the generated canonical data-integrity audit artifact.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readFile } from "node:fs/promises";
import { appPath } from "@/lib/server/repoPaths";

export type DataIntegrityAuditSummary = {
  signalGapCount: number;
  priceGapCount: number;
  directionNoPriceCount: number;
  priceNeutralSignalCount: number;
  engineShortfalls: number;
};

export type DataIntegrityAuditReport = {
  generatedUtc: string;
  displayWeekOpenUtc: string;
  weeksChecked: number;
  canonicalPairs: number;
  summary: DataIntegrityAuditSummary;
};

const DATA_INTEGRITY_REPORT_PATH = appPath("reports", "data-integrity-audit.json");

function toFinite(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toIso(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : "";
}

function toSummary(value: unknown): DataIntegrityAuditSummary {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    signalGapCount: toFinite(record.signalGapCount),
    priceGapCount: toFinite(record.priceGapCount),
    directionNoPriceCount: toFinite(record.directionNoPriceCount),
    priceNeutralSignalCount: toFinite(record.priceNeutralSignalCount),
    engineShortfalls: toFinite(record.engineShortfalls),
  };
}

function normalizeReport(value: unknown): DataIntegrityAuditReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = value as Record<string, unknown>;
  return {
    generatedUtc: toIso(parsed.generatedUtc),
    displayWeekOpenUtc: toIso(parsed.displayWeekOpenUtc),
    weeksChecked: toFinite(parsed.weeksChecked),
    canonicalPairs: toFinite(parsed.canonicalPairs),
    summary: toSummary(parsed.summary),
  };
}

async function readBundledDataIntegrityAuditReport(): Promise<DataIntegrityAuditReport | null> {
  try {
    const bundled = await import("./embedded/data-integrity-audit.json");
    return normalizeReport((bundled as { default?: unknown }).default ?? bundled);
  } catch (error) {
    console.warn(
      "Bundled data-integrity audit report unavailable:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export async function readDataIntegrityAuditReport(): Promise<DataIntegrityAuditReport | null> {
  try {
    const raw = await readFile(DATA_INTEGRITY_REPORT_PATH, "utf8");
    return normalizeReport(JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return readBundledDataIntegrityAuditReport();
    }
    throw error;
  }
}

export function dataIntegrityAuditPassed(report: DataIntegrityAuditReport | null) {
  if (!report) return false;
  return Object.values(report.summary).every((value) => value === 0);
}

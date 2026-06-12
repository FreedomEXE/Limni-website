/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Freshness-first operational status page for canonical data, live feeds, and workspace health.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
import { DateTime } from "luxon";

import DashboardLayout from "@/components/DashboardLayout";
import StatusPanel from "@/components/StatusPanel";
import { getActiveBaselineWeeks } from "@/lib/appTruth/activeBaseline";
import { readAppTruthRunLedgerSnapshot } from "@/lib/appTruth/runLedger";
import { buildStatusAppTruthProjection } from "@/lib/appTruth/statusProjection";
import type { AppTruthStatus, AppTruthStatusProjection, SchedulerRunStatus } from "@/lib/appTruth/types";
import { buildCanonInventoryManifest } from "@/lib/canon/canonWeekShard.server";
import { getAppDiagnostics } from "@/lib/diagnostics";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import { query, queryOne } from "@/lib/db";
import { readNewsWeeklySnapshot } from "@/lib/news/store";
import { readCanonicalPerformanceReport } from "@/lib/performance/canonicalPerformanceReport";
import {
  dataIntegrityAuditPassed,
  readDataIntegrityAuditReport,
  type DataIntegrityAuditReport,
} from "@/lib/performance/dataIntegrityReport";
import { normalizeFilterSelection, resolveStrategyId } from "@/lib/performance/strategyConfig";
import {
  strategyVariantFromRuntimeSelection,
  type RuntimeStrategySelection,
} from "@/lib/performance/strategySelection";
import { readMarketSnapshot } from "@/lib/priceStore";
import { getPriceSymbolCandidates } from "@/lib/pricePerformance";
import { getLatestAggregatesLocked } from "@/lib/sentiment/store";
import { MyfxbookProvider } from "@/lib/sentiment/providers/myfxbook";
import { ALL_SENTIMENT_SYMBOLS } from "@/lib/sentiment/symbols";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import {
  readFrozenSourceLedgerWeekSummariesForWeeks,
  readRecentFrozenSourceLedgerWeekSummaries,
  type FrozenSourceLedgerWeekSummary,
} from "@/lib/sourceFreeze/sourceLedger";
import type { Mt5AccountSnapshot } from "@/lib/mt5Store";
import { readMt5Accounts } from "@/lib/mt5Store";
import { readBotState } from "@/lib/botState";
import { formatDateET, formatDateTimeET, latestIso } from "@/lib/time";
import { releaseManifest } from "@/lib/version/releaseManifest";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

export const dynamic = "force-dynamic";

type HealthItem = {
  name: string;
  status: "ok" | "warning" | "error";
  detail: string;
  hint?: string;
};

type FreshnessStatus = "fresh" | "stale" | "missing" | "provisional" | "research";

type FreshnessCard = {
  name: string;
  status: FreshnessStatus;
  detail: string;
  lastUpdated: string | null;
  hint?: string;
};

type KernelDiagnostics = {
  status: FreshnessStatus;
  activeStrategyVariant: string;
  appVersion: string;
  cacheNamespace: string;
  canonVersion: string;
  baselineWeeks: number;
  deltaWeeks: number;
  totalWeeks: number;
  latestClosedWeekOpenUtc: string | null;
  currentWeekOpenUtc: string;
  weekOpenUtcs: string[];
  rowCount: number;
  generatedAtUtc: string;
  error: string | null;
};

type StatusPageSearchParams = Record<string, string | string[] | undefined>;

type StatusPageProps = {
  searchParams?: StatusPageSearchParams | Promise<StatusPageSearchParams>;
};

type CanonicalStatsRow = {
  latest_updated_at: string | null;
  total_rows: string | number;
  weekly_rows?: string | number;
  daily_rows?: string | number;
};

type PriceDebugRow = {
  assetLabel: string;
  assetId: string;
  reportDate: string | null;
  missingPairs: Array<{
    pair: string;
    symbols: string[];
  }>;
};

type SourceLedgerDetailRow = {
  week_open_utc: string;
  ledger_version: string;
  source: string;
  source_version: string;
  freeze_target_utc: string;
  first_source_timestamp_utc: string | null;
  latest_source_timestamp_utc: string | null;
  signal_rows: string | number;
  trusted_rows: string | number;
  untrusted_rows: string | number;
  incident_rows: string | number;
  incident_count: string | number;
  raw_evidence_missing_rows: string | number;
  evidence_class: string;
  trust_class: string;
};

const healthToneMap = {
  ok: "bg-emerald-100 text-emerald-700",
  warning: "bg-[var(--accent)]/10 text-[var(--accent-strong)]",
  error: "bg-rose-100 text-rose-700",
};

const freshnessToneMap = {
  fresh: "bg-emerald-100 text-emerald-700",
  stale: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  missing: "bg-rose-100 text-rose-700",
  provisional: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300",
  research: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
};

const botToneMap = {
  ON: "bg-emerald-100 text-emerald-700",
  READY: "bg-sky-100 text-sky-700",
  WAITING: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  OFF: "bg-[var(--panel-border)]/40 text-[var(--foreground)]/70",
};

const appTruthToneMap: Record<AppTruthStatus, string> = {
  ready: "bg-emerald-100 text-emerald-700",
  degraded: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  blocked: "bg-rose-100 text-rose-700",
  missing_contract: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  unknown: "bg-[var(--panel-border)]/40 text-[var(--foreground)]/70",
};

const requirementToneMap = {
  present: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  missing: "bg-rose-100 text-rose-700",
  not_implemented: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  not_required: "bg-[var(--panel-border)]/40 text-[var(--foreground)]/70",
};

const scheduledCronToneMap = {
  scheduled: "bg-emerald-100 text-emerald-700",
  manual_only: "bg-[var(--panel-border)]/40 text-[var(--foreground)]/70",
};

const runStatusToneMap: Record<SchedulerRunStatus, string> = {
  running: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300",
  succeeded: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
  degraded: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  skipped: "bg-[var(--panel-border)]/40 text-[var(--foreground)]/70",
};

const lifecycleStateToneMap: Record<string, string> = {
  closed_ready: "bg-emerald-100 text-emerald-700",
  materialization_receipts_missing: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  source_ready_kernel_missing: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  source_missing_kernel_ready: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  closed_missing: "bg-rose-100 text-rose-700",
  current_live_overlay: "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300",
  archive_or_stale_kernel_extra: "bg-[var(--panel-border)]/40 text-[var(--foreground)]/70",
};

const lifecycleReceiptToneMap = {
  present: "bg-emerald-100 text-emerald-700",
  missing: "bg-rose-100 text-rose-700",
  degraded: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
};

const DEFAULT_KERNEL_STATUS_SELECTION: RuntimeStrategySelection = {
  strategy: "tandem",
  f1: "adr_grid",
  f2: "pair_fill_cap",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hasKernelSelectionParams(params: StatusPageSearchParams) {
  return Boolean(
    firstParam(params.strategy)
      ?? firstParam(params.bias)
      ?? firstParam(params.f1)
      ?? firstParam(params.filter)
      ?? firstParam(params.f2),
  );
}

function resolveKernelStatusSelection(params: StatusPageSearchParams): RuntimeStrategySelection {
  if (!hasKernelSelectionParams(params)) {
    return DEFAULT_KERNEL_STATUS_SELECTION;
  }

  const normalized = normalizeFilterSelection({
    f1: firstParam(params.f1) ?? firstParam(params.filter),
    f2: firstParam(params.f2),
  });

  return {
    strategy: resolveStrategyId(firstParam(params.strategy) ?? firstParam(params.bias)),
    f1: normalized.f1,
    f2: normalized.f2,
  };
}

function isFresh(iso: string | null | undefined, minutes = 15) {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= minutes * 60 * 1000;
}

function resolveFreshnessStatus(
  iso: string | null | undefined,
  freshMinutes: number,
  staleMinutes: number,
): FreshnessStatus {
  if (!iso) return "missing";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "missing";
  const ageMs = Date.now() - ts;
  if (ageMs <= freshMinutes * 60 * 1000) return "fresh";
  if (ageMs <= staleMinutes * 60 * 1000) return "stale";
  return "missing";
}

function formatLedgerSourceSummary(week: FrozenSourceLedgerWeekSummary) {
  if (week.summaries.length === 0) return "No source summaries.";
  return week.summaries
    .map((summary) => {
      const incidentLabel = summary.incidents.length === 0 ? "0 incidents" : `${summary.incidents.length} incident(s)`;
      return `${summary.source}: ${summary.resolvedRows}/${summary.expectedRows} ${summary.trustClass}, ${incidentLabel}`;
    })
    .join(" | ");
}

function formatLedgerLag(targetUtc: string | null | undefined, sourceUtc: string | null | undefined) {
  if (!targetUtc || !sourceUtc) return "No source timestamp";
  const target = Date.parse(targetUtc);
  const source = Date.parse(sourceUtc);
  if (!Number.isFinite(target) || !Number.isFinite(source)) return "Unknown lag";
  const minutes = Math.round((target - source) / 60000);
  if (minutes === 0) return "At freeze";
  if (minutes > 0) return `${minutes}m before freeze`;
  return `${Math.abs(minutes)}m after freeze`;
}

function formatLedgerCaptureRange(row: SourceLedgerDetailRow) {
  const first = row.first_source_timestamp_utc;
  const latest = row.latest_source_timestamp_utc;
  if (!first && !latest) return "No source timestamp";
  if (!first || !latest || first === latest) {
    return formatDateTimeET(latest ?? first ?? "");
  }
  return `${formatDateTimeET(first)} to ${formatDateTimeET(latest)}`;
}

function sourceLedgerWeekKey(value: string | null | undefined) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}(?:\s|$)/.test(text) && !text.includes("T")) {
    return text.slice(0, 10);
  }
  const parsed = DateTime.fromISO(text, { zone: "utc" });
  return parsed.isValid
    ? parsed.setZone("America/New_York").toISODate() ?? text.slice(0, 10)
    : text.slice(0, 10);
}

function formatLastUpdated(iso: string | null | undefined) {
  return iso ? formatDateTimeET(iso) : "No refresh yet";
}

function toCount(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function buildFreshnessCard(options: {
  name: string;
  iso: string | null | undefined;
  detail: string;
  freshMinutes: number;
  staleMinutes: number;
  hint?: string;
}): FreshnessCard {
  return {
    name: options.name,
    status: resolveFreshnessStatus(options.iso, options.freshMinutes, options.staleMinutes),
    detail: options.detail,
    lastUpdated: options.iso ?? null,
    hint: options.hint,
  };
}

function buildWorkspaceHealthCard(options: {
  name: string;
  status: FreshnessStatus;
  detail: string;
  lastUpdated?: string | null;
  hint?: string;
}): FreshnessCard {
  return {
    name: options.name,
    status: options.status,
    detail: options.detail,
    lastUpdated: options.lastUpdated ?? null,
    hint: options.hint,
  };
}

export default async function StatusPage({ searchParams }: StatusPageProps) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  let dbError: string | null = null;
  let priceError: string | null = null;
  let sentimentError: string | null = null;
  let accountsError: string | null = null;
  let canonicalError: string | null = null;
  let newsError: string | null = null;
  let myfxbookDebugError: string | null = null;
  let dataIntegrityError: string | null = null;
  let sourceLedgerError: string | null = null;
  let kernelDiagnostics: KernelDiagnostics | null = null;
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const activeBaselineWeeks = getActiveBaselineWeeks(currentWeekOpenUtc);

  let sentimentAggregates: SentimentAggregate[] = [];
  let accounts: Mt5AccountSnapshot[] = [];
  let canonicalBarsStats: CanonicalStatsRow | null = null;
  let pairReturnStats: CanonicalStatsRow | null = null;
  let canonicalReportGeneratedUtc: string | null = null;
  let canonicalSummaryCount = 0;
  let dataIntegrityReport: DataIntegrityAuditReport | null = null;
  let sourceLedgerWeeks: FrozenSourceLedgerWeekSummary[] = [];
  let activeBaselineSourceLedgerWeeks: FrozenSourceLedgerWeekSummary[] = [];
  let sourceLedgerDetailsByWeek: Record<string, SourceLedgerDetailRow[]> = {};
  let latestNewsSnapshot:
    | {
        fetched_at: string;
        announcements: unknown[];
        calendar: unknown[];
      }
    | null = null;
  let myfxbookDebug: {
    ok: boolean;
    httpStatus: number;
    statusText: string;
    latencyMs: number;
    headers: Record<string, string>;
    parseError: string | null;
    apiError: boolean | null;
    apiMessage: string | null;
    symbolCount: number;
    mappedCount: number;
    droppedCount: number;
    criticalMissing: string[];
    mappings: Array<{
      raw: string;
      mapped: string;
      wasMapped: boolean;
      reason: string;
      included: boolean;
    }>;
    bodyExcerpt: string;
    fetchedAtUtc: string;
  } | null = null;
  let priceSnapshots: Array<{
    assetLabel: string;
    assetId: string;
    lastRefreshUtc: string | null;
    missingPairs: string[];
  }> = [];
  let priceDebug: PriceDebugRow[] = [];

  const kernelActiveSelection = resolveKernelStatusSelection(resolvedSearchParams);
  const kernelActiveStrategyVariant = strategyVariantFromRuntimeSelection(kernelActiveSelection);
  const assetClasses = listAssetClasses();
  const bitgetState = await readBotState("bitget_perp_v2");

  let cotSnapshotsByAsset: Array<{
    assetId: string;
    assetLabel: string;
    reportDate: string | null;
    lastRefreshUtc: string | null;
  }> = [];

  try {
    cotSnapshotsByAsset = await Promise.all(
      assetClasses.map(async (asset) => {
        const snapshot = await readSnapshot({ assetClass: asset.id });
        return {
          assetId: asset.id,
          assetLabel: asset.label,
          reportDate: snapshot?.report_date ?? null,
          lastRefreshUtc: snapshot?.last_refresh_utc ?? null,
        };
      }),
    );
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  try {
    priceSnapshots = await Promise.all(
      assetClasses.map(async (asset) => {
        const snapshot = await readMarketSnapshot(undefined, asset.id);
        const missingPairs = snapshot
          ? Object.entries(snapshot.pairs)
              .filter(([, value]) => value === null)
              .map(([pair]) => pair)
          : [];
        return {
          assetLabel: asset.label,
          assetId: asset.id,
          lastRefreshUtc: snapshot?.last_refresh_utc ?? null,
          missingPairs,
        };
      }),
    );
  } catch (error) {
    priceError = error instanceof Error ? error.message : String(error);
  }

  try {
    sentimentAggregates = await getLatestAggregatesLocked();
  } catch (error) {
    sentimentError = error instanceof Error ? error.message : String(error);
  }

  try {
    accounts = await readMt5Accounts();
  } catch (error) {
    accountsError = error instanceof Error ? error.message : String(error);
  }

  try {
    canonicalBarsStats = await queryOne<CanonicalStatsRow>(
      `SELECT MAX(updated_at)::text AS latest_updated_at,
              COUNT(*)::bigint AS total_rows
       FROM canonical_price_bars`,
    );
    pairReturnStats = await queryOne<CanonicalStatsRow>(
      `SELECT MAX(updated_at)::text AS latest_updated_at,
              COUNT(*)::bigint AS total_rows,
              COUNT(*) FILTER (WHERE period_type = 'weekly')::bigint AS weekly_rows,
              COUNT(*) FILTER (WHERE period_type = 'daily')::bigint AS daily_rows
       FROM pair_period_returns`,
    );
    const canonicalReport = await readCanonicalPerformanceReport();
    canonicalReportGeneratedUtc = canonicalReport?.generatedUtc ?? null;
    canonicalSummaryCount = canonicalReport?.summary.length ?? 0;
    if (!canonicalReport) {
      canonicalError = "Canonical report unavailable in runtime";
    }
  } catch (error) {
    canonicalError = error instanceof Error ? error.message : String(error);
  }

  try {
    dataIntegrityReport = await readDataIntegrityAuditReport();
  } catch (error) {
    dataIntegrityError = error instanceof Error ? error.message : String(error);
  }

  try {
    sourceLedgerWeeks = await readRecentFrozenSourceLedgerWeekSummaries(14);
    activeBaselineSourceLedgerWeeks = await readFrozenSourceLedgerWeekSummariesForWeeks(activeBaselineWeeks);
    const sourceLedgerDetails = await query<SourceLedgerDetailRow>(
      `
        SELECT week_open_utc::text,
               ledger_version,
               source,
               MIN(source_version) AS source_version,
               MAX(freeze_target_utc)::text AS freeze_target_utc,
               MIN(source_timestamp_utc)::text AS first_source_timestamp_utc,
               MAX(source_timestamp_utc)::text AS latest_source_timestamp_utc,
               COUNT(*)::bigint AS signal_rows,
               COUNT(*) FILTER (WHERE trusted_for_freeze)::bigint AS trusted_rows,
               COUNT(*) FILTER (WHERE NOT trusted_for_freeze)::bigint AS untrusted_rows,
               COUNT(*) FILTER (WHERE cardinality(incidents) > 0)::bigint AS incident_rows,
               COALESCE(SUM(cardinality(incidents)), 0)::bigint AS incident_count,
               COUNT(*) FILTER (WHERE metadata->>'rawProviderEvidencePresent' = 'false')::bigint AS raw_evidence_missing_rows,
               MIN(evidence_class) AS evidence_class,
               MIN(trust_class) AS trust_class
          FROM source_freeze_ledger_signals
         WHERE ledger_version = 'friday_close_v1'
         GROUP BY week_open_utc, ledger_version, source
         ORDER BY week_open_utc DESC, source ASC
         LIMIT 56
      `,
    );
    sourceLedgerDetailsByWeek = sourceLedgerDetails.reduce<Record<string, SourceLedgerDetailRow[]>>((acc, row) => {
      const key = sourceLedgerWeekKey(row.week_open_utc);
      acc[key] = [...(acc[key] ?? []), row];
      return acc;
    }, {});
  } catch (error) {
    sourceLedgerError = error instanceof Error ? error.message : String(error);
  }

  try {
    const inventory = await buildCanonInventoryManifest({
      manifest: releaseManifest,
      currentWeekOpenUtc,
      strategyVariants: [kernelActiveStrategyVariant],
    });
    const variant = inventory.variants[kernelActiveStrategyVariant];
    if (!variant) {
      kernelDiagnostics = {
        status: "missing",
        activeStrategyVariant: kernelActiveStrategyVariant,
        appVersion: releaseManifest.liveVersion,
        cacheNamespace: releaseManifest.cacheNamespace,
        canonVersion: releaseManifest.canonVersion,
        baselineWeeks: 0,
        deltaWeeks: 0,
        totalWeeks: 0,
        latestClosedWeekOpenUtc: null,
        currentWeekOpenUtc: inventory.currentWeekOpenUtc,
        weekOpenUtcs: [],
        rowCount: 0,
        generatedAtUtc: inventory.generatedAtUtc,
        error: "Kernel inventory did not include the active Performance variant.",
      };
    } else {
      const weekEntries = [...variant.baselineWeeks, ...variant.deltaWeeks];
      const rowCount = weekEntries.reduce(
        (sum, week) => sum + week.rowCounts.rows,
        0,
      );
      kernelDiagnostics = {
        status: variant.deltaWeeks.length > 0 ? "fresh" : "provisional",
        activeStrategyVariant: kernelActiveStrategyVariant,
        appVersion: releaseManifest.liveVersion,
        cacheNamespace: releaseManifest.cacheNamespace,
        canonVersion: releaseManifest.canonVersion,
        baselineWeeks: variant.baselineWeeks.length,
        deltaWeeks: variant.deltaWeeks.length,
        totalWeeks: variant.baselineWeeks.length + variant.deltaWeeks.length,
        latestClosedWeekOpenUtc: variant.latestClosedWeekOpenUtc,
        currentWeekOpenUtc: inventory.currentWeekOpenUtc,
        weekOpenUtcs: weekEntries.map((week) => week.weekOpenUtc),
        rowCount,
        generatedAtUtc: inventory.generatedAtUtc,
        error: null,
      };
    }
  } catch (error) {
    kernelDiagnostics = {
      status: "missing",
      activeStrategyVariant: kernelActiveStrategyVariant,
      appVersion: releaseManifest.liveVersion,
      cacheNamespace: releaseManifest.cacheNamespace,
      canonVersion: releaseManifest.canonVersion,
      baselineWeeks: 0,
      deltaWeeks: 0,
      totalWeeks: 0,
      latestClosedWeekOpenUtc: null,
      currentWeekOpenUtc,
      weekOpenUtcs: [],
      rowCount: 0,
      generatedAtUtc: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const snapshot = await readNewsWeeklySnapshot();
    if (snapshot) {
      latestNewsSnapshot = {
        fetched_at: snapshot.fetched_at,
        announcements: snapshot.announcements,
        calendar: snapshot.calendar,
      };
    }
  } catch (error) {
    newsError = error instanceof Error ? error.message : String(error);
  }

  try {
    const provider = new MyfxbookProvider();
    const result = await provider.fetchOutlookRaw();
    const symbols = result.parsed?.symbols?.map((symbol) => symbol.name) ?? [];
    const symbolMappings = provider.getSymbolMappingDebug(
      symbols,
      Array.from(ALL_SENTIMENT_SYMBOLS),
    );
    const mappedCount = symbolMappings.filter((item) => item.included).length;
    const droppedCount = symbolMappings.length - mappedCount;
    const criticalSymbols = [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "USDCHF",
      "USDCAD",
      "AUDUSD",
      "NZDUSD",
      "SPXUSD",
      "NDXUSD",
      "NIKKEIUSD",
      "WTIUSD",
      "XAUUSD",
      "XAGUSD",
      "BTCUSD",
      "ETHUSD",
    ];
    const keptSymbols = new Set(
      symbolMappings.filter((item) => item.included).map((item) => item.mapped_symbol),
    );
    const criticalMissing = criticalSymbols.filter((symbol) => !keptSymbols.has(symbol));
    myfxbookDebug = {
      ok: result.http_status === 200 && !result.parsed?.error,
      httpStatus: result.http_status,
      statusText: result.status_text,
      latencyMs: result.latency_ms,
      headers: result.headers,
      parseError: result.parse_error,
      apiError: result.parsed?.error ?? null,
      apiMessage: result.parsed?.message ?? null,
      symbolCount: symbols.length,
      mappedCount,
      droppedCount,
      criticalMissing,
      mappings: symbolMappings.map((item) => ({
        raw: item.raw_symbol,
        mapped: item.mapped_symbol,
        wasMapped: item.was_mapped,
        reason: item.reason,
        included: item.included,
      })),
      bodyExcerpt: result.body_excerpt,
      fetchedAtUtc: new Date().toISOString(),
    };
  } catch (error) {
    myfxbookDebugError = error instanceof Error ? error.message : String(error);
  }

  try {
    priceDebug = await Promise.all(
      assetClasses.map(async (asset) => {
        const snapshot = await readSnapshot({ assetClass: asset.id });
        const pairs = snapshot ? Object.keys(snapshot.pairs) : [];
        return {
          assetLabel: asset.label,
          assetId: asset.id,
          reportDate: snapshot?.report_date ?? null,
          missingPairs: pairs.map((pair) => ({
            pair,
            symbols: getPriceSymbolCandidates(pair, asset.id),
          })),
        };
      }),
    );
  } catch (error) {
    priceError = error instanceof Error ? error.message : String(error);
  }

  const latestSentimentTimestamp = latestIso(
    sentimentAggregates.map((aggregate) => aggregate.timestamp_utc),
  );
  const latestAccountSync = latestIso(accounts.map((account) => account.last_sync_utc));
  const latestCotRefresh = latestIso(cotSnapshotsByAsset.map((asset) => asset.lastRefreshUtc));
  const latestPriceSnapshotRefresh = latestIso(priceSnapshots.map((asset) => asset.lastRefreshUtc));
  const latestCanonicalBars = canonicalBarsStats?.latest_updated_at ?? null;
  const latestPairReturns = pairReturnStats?.latest_updated_at ?? null;
  const canonicalDbHealthy = Boolean(latestCanonicalBars || latestPairReturns);
  const canonicalRuntimeUnavailable = Boolean(canonicalError && canonicalDbHealthy);
  const latestStatusRefresh = latestIso([
    latestCotRefresh,
    latestPriceSnapshotRefresh,
    latestSentimentTimestamp,
    latestAccountSync,
    canonicalReportGeneratedUtc,
    latestCanonicalBars,
    latestPairReturns,
    dataIntegrityReport?.generatedUtc ?? null,
    kernelDiagnostics?.generatedAtUtc ?? null,
    latestNewsSnapshot?.fetched_at ?? null,
  ]);

  let schedulerRuns: Awaited<ReturnType<typeof readAppTruthRunLedgerSnapshot>>["schedulerRuns"] = [];
  let materializationRuns: Awaited<ReturnType<typeof readAppTruthRunLedgerSnapshot>>["materializationRuns"] = [];
  let schedulerLedgerReadError: string | null = null;
  try {
    const runLedgerSnapshot = await readAppTruthRunLedgerSnapshot(50);
    schedulerRuns = runLedgerSnapshot.schedulerRuns;
    materializationRuns = runLedgerSnapshot.materializationRuns;
  } catch (error) {
    schedulerLedgerReadError = error instanceof Error ? error.message : String(error);
  }

  const appTruthProjection = buildStatusAppTruthProjection({
    manifest: releaseManifest,
    kernelDiagnostics,
    sourceLedgerWeeks: activeBaselineSourceLedgerWeeks,
    sourceLedgerError,
    currentWeekOpenUtc,
    canonicalRuntimeError: canonicalRuntimeUnavailable ? canonicalError : null,
    dataIntegrityGeneratedUtc: dataIntegrityReport?.generatedUtc ?? null,
    schedulerRuns,
    materializationRuns,
    schedulerLedgerReadError,
  });

  const issues = getAppDiagnostics({
    dbError,
    priceError: priceError ?? (canonicalRuntimeUnavailable ? null : canonicalError),
    sentimentError,
    accountsError: accountsError ?? newsError,
  });

  const mt5Status =
    accounts.length === 0 ? "OFF" : isFresh(latestAccountSync, 15) ? "ON" : "OFF";
  const bitgetLifecycle = String(
    (bitgetState?.state as { lifecycle?: string } | undefined)?.lifecycle ?? "",
  );
  const bitgetStatus =
    !bitgetState || bitgetLifecycle === "" || bitgetLifecycle === "IDLE" || bitgetLifecycle === "KILLED"
      ? "OFF"
      : ["POSITION_OPEN", "SCALING", "TRAILING"].includes(bitgetLifecycle)
        ? "ON"
      : "WAITING";
  const dataIntegrityPassed = dataIntegrityAuditPassed(dataIntegrityReport);
  const dataIntegrityGapTotal = dataIntegrityReport
    ? Object.values(dataIntegrityReport.summary).reduce((sum, value) => sum + value, 0)
    : 0;

  const health: HealthItem[] = [
    {
      name: "Database",
      status: dbError ? "error" : "ok",
      detail: dbError ? dbError : "Connection OK",
      hint: dbError ? "Check DATABASE_URL on Vercel." : undefined,
    },
    {
      name: "Canonical data",
      status: canonicalRuntimeUnavailable ? "warning" : canonicalError ? "error" : latestPairReturns ? "ok" : "warning",
      detail: canonicalRuntimeUnavailable
        ? "Canonical bars and pair-period returns are available, but the local reconstruction report is unavailable in this runtime."
        : canonicalError
          ? canonicalError
        : latestPairReturns
          ? "Canonical bars, returns, and reconstruction report are available."
          : "Canonical price/performance layers are missing.",
      hint: canonicalRuntimeUnavailable
        ? "Bundle or persist the canonical report for this deployment environment."
        : latestPairReturns
          ? undefined
          : "Run canonical price backfill and reconstruction.",
    },
    {
      name: "Data Integrity",
      status: dataIntegrityError ? "error" : dataIntegrityPassed ? "ok" : "warning",
      detail: dataIntegrityError
        ? dataIntegrityError
        : dataIntegrityReport
          ? dataIntegrityPassed
            ? `Audit clean across ${dataIntegrityReport.weeksChecked} weeks and ${dataIntegrityReport.canonicalPairs} pairs.`
            : `${dataIntegrityGapTotal} gap or engine shortfall count(s) in the latest audit.`
          : "No data-integrity audit artifact yet.",
      hint: dataIntegrityPassed
        ? undefined
        : "Run npx tsx scripts/audit-data-integrity.ts after canonical refreshes.",
    },
    {
      name: "Sentiment",
      status: sentimentError ? "error" : sentimentAggregates.length ? "ok" : "warning",
      detail: sentimentError
        ? sentimentError
        : sentimentAggregates.length
          ? "Aggregates available."
          : "No sentiment data.",
      hint: sentimentAggregates.length ? undefined : "Run sentiment refresh.",
    },
    {
      name: "Accounts",
      status: accountsError ? "error" : accounts.length ? "ok" : "warning",
      detail: accountsError
        ? accountsError
        : accounts.length
          ? `${accounts.length} account(s) reporting.`
          : "No MT5 accounts connected.",
      hint: accounts.length ? undefined : "Check MT5 push URL + token.",
    },
    {
      name: "News",
      status: newsError ? "error" : latestNewsSnapshot ? "ok" : "warning",
      detail: newsError
        ? newsError
        : latestNewsSnapshot
          ? "ForexFactory snapshot cache available."
          : "No news snapshot yet.",
      hint: latestNewsSnapshot ? undefined : "Run news refresh.",
    },
  ];

  const canonicalCards: FreshnessCard[] = [
    buildFreshnessCard({
      name: "Canonical Price Bars",
      iso: latestCanonicalBars,
      detail: `${toCount(canonicalBarsStats?.total_rows)} canonical bars stored.`,
      freshMinutes: 60 * 24 * 7,
      staleMinutes: 60 * 24 * 30,
      hint: "Backfill or refresh canonical bars if this lags.",
    }),
    buildFreshnessCard({
      name: "Pair Period Returns",
      iso: latestPairReturns,
      detail: `${toCount(pairReturnStats?.weekly_rows)} weekly + ${toCount(pairReturnStats?.daily_rows)} daily rows.`,
      freshMinutes: 60 * 24 * 7,
      staleMinutes: 60 * 24 * 30,
      hint: "Refresh derived returns after updating bars.",
    }),
    buildFreshnessCard({
      name: "Weekly Reconstruction",
      iso: canonicalReportGeneratedUtc,
      detail: canonicalRuntimeUnavailable
        ? "Canonical report unavailable in this runtime."
        : `${canonicalSummaryCount} canonical systems in report.`,
      freshMinutes: 60 * 24 * 7,
      staleMinutes: 60 * 24 * 21,
      hint: canonicalRuntimeUnavailable
        ? "Use a deployment-safe canonical report source or graceful fallback."
        : "Re-run reconstruction when the canonical week extends.",
    }),
  ];
  if (canonicalRuntimeUnavailable) {
    canonicalCards[canonicalCards.length - 1] = {
      ...canonicalCards[canonicalCards.length - 1],
      status: "provisional",
    };
  }

  const kernelCards: FreshnessCard[] = kernelDiagnostics
    ? [
        buildWorkspaceHealthCard({
          name: "Kernel Version",
          status: kernelDiagnostics.error ? "missing" : "fresh",
          detail: `${kernelDiagnostics.appVersion} / cache ${kernelDiagnostics.cacheNamespace} / canon ${kernelDiagnostics.canonVersion}.`,
          lastUpdated: kernelDiagnostics.generatedAtUtc,
          hint: kernelDiagnostics.error ?? "Patch cache changes do not re-download unchanged v2 canon shards.",
        }),
        buildWorkspaceHealthCard({
          name: "Active Shard Inventory",
          status: kernelDiagnostics.status,
          detail: `${kernelDiagnostics.totalWeeks} closed week shard(s): ${kernelDiagnostics.baselineWeeks} release + ${kernelDiagnostics.deltaWeeks} delta.`,
          lastUpdated: kernelDiagnostics.generatedAtUtc,
          hint: `${kernelDiagnostics.activeStrategyVariant}; ${kernelDiagnostics.rowCount.toLocaleString()} closed-history rows.`,
        }),
        buildWorkspaceHealthCard({
          name: "Closed / Live Boundary",
          status: kernelDiagnostics.error ? "missing" : "fresh",
          detail: `Latest closed ${kernelDiagnostics.latestClosedWeekOpenUtc ? formatDateET(kernelDiagnostics.latestClosedWeekOpenUtc) : "none"}; live week ${formatDateET(kernelDiagnostics.currentWeekOpenUtc)}.`,
          lastUpdated: kernelDiagnostics.generatedAtUtc,
          hint: "Current/open week remains live-only and never satisfies historical readiness.",
        }),
      ]
    : [];

  const sourceLedgerCards: FreshnessCard[] = sourceLedgerError
    ? [
        buildWorkspaceHealthCard({
          name: "Source Freeze Ledger",
          status: "missing",
          detail: sourceLedgerError,
          lastUpdated: null,
          hint: "Check the source_freeze_ledger tables and migration status.",
        }),
      ]
    : sourceLedgerWeeks.length === 0
      ? [
          buildWorkspaceHealthCard({
            name: "Source Freeze Ledger",
            status: "missing",
            detail: "No frozen source ledger weeks found.",
            lastUpdated: null,
            hint: "Run the current-week source-freeze build or the active baseline certification flow.",
          }),
        ]
      : sourceLedgerWeeks.map((week) =>
          buildWorkspaceHealthCard({
            name: `Freeze ${formatDateET(week.weekOpenUtc)}`,
            status: week.complete && week.trustedForFreeze ? "fresh" : "missing",
            detail: `${week.releaseWindow}; freeze ${formatDateTimeET(week.freezeTargetUtc)}; ${week.ledgerVersion} ${week.sourceHash.slice(0, 12)}.`,
            lastUpdated: week.freezeTargetUtc,
            hint: formatLedgerSourceSummary(week),
          }),
        );

  const liveFeedCards: FreshnessCard[] = [
    buildFreshnessCard({
      name: "COT Snapshots",
      iso: latestCotRefresh,
      detail: `${cotSnapshotsByAsset.filter((asset) => asset.reportDate).length}/${assetClasses.length} asset classes loaded.`,
      freshMinutes: 60 * 24 * 7,
      staleMinutes: 60 * 24 * 21,
      hint: "COT refresh should advance weekly.",
    }),
    buildFreshnessCard({
      name: "Price Snapshots",
      iso: latestPriceSnapshotRefresh,
      detail: `${priceSnapshots.filter((asset) => asset.lastRefreshUtc).length}/${assetClasses.length} live snapshot classes refreshed.`,
      freshMinutes: 60 * 24,
      staleMinutes: 60 * 24 * 7,
      hint: "Refresh live market snapshots if this stalls.",
    }),
    buildFreshnessCard({
      name: "Sentiment Lock",
      iso: latestSentimentTimestamp,
      detail: `${sentimentAggregates.length} locked sentiment aggregates.`,
      freshMinutes: 60 * 24 * 2,
      staleMinutes: 60 * 24 * 7,
      hint: "Refresh sentiment providers if this goes stale.",
    }),
    buildFreshnessCard({
      name: "News Snapshot",
      iso: latestNewsSnapshot?.fetched_at ?? null,
      detail: latestNewsSnapshot
        ? `${latestNewsSnapshot.calendar.length} events cached.`
        : "No news events cached.",
      freshMinutes: 60 * 6,
      staleMinutes: 60 * 24 * 3,
      hint: "Run the news refresh if events stop updating.",
    }),
    buildFreshnessCard({
      name: "Account Sync",
      iso: latestAccountSync,
      detail: `${accounts.length} MT5 account(s) reporting.`,
      freshMinutes: 30,
      staleMinutes: 60 * 24,
      hint: "Check MT5 push script/EA if sync falls behind.",
    }),
  ];

  const workspaceCards: FreshnessCard[] = [
    buildWorkspaceHealthCard({
      name: "Matrix CFD",
      status: "provisional",
      detail: "Matrix is intentionally outside the v2.0.2 kernel gate.",
      lastUpdated: latestIso([latestCotRefresh, latestPriceSnapshotRefresh, latestSentimentTimestamp]),
      hint: "Treat Matrix as degraded until the Performance data kernel and indicator verification are complete.",
    }),
    buildWorkspaceHealthCard({
      name: "Matrix Crypto",
      status: "provisional",
      detail: "Crypto Matrix is intentionally outside the v2.0.2 kernel gate.",
      lastUpdated: latestIso([
        cotSnapshotsByAsset.find((asset) => asset.assetId === "crypto")?.lastRefreshUtc ?? null,
        priceSnapshots.find((asset) => asset.assetId === "crypto")?.lastRefreshUtc ?? null,
      ]),
      hint: "Do not use Matrix readiness to judge v2.0.2 Performance kernel readiness.",
    }),
    buildWorkspaceHealthCard({
      name: "Swing Board",
      status: canonicalReportGeneratedUtc ? "fresh" : "provisional",
      detail: canonicalReportGeneratedUtc
        ? "Weekly flagship metadata is available for forward testing."
        : "Weekly flagship surface is available, but canonical report metadata is provisional in this runtime.",
      lastUpdated: canonicalReportGeneratedUtc,
      hint: canonicalReportGeneratedUtc ? undefined : "Restore deployment-safe canonical report access.",
    }),
    buildWorkspaceHealthCard({
      name: "Intraday Board",
      status: "research",
      detail: "Intraday remains research-only and is not yet promoted.",
      hint: "Lock the intraday flagship before promoting this surface.",
    }),
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">System Status</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Operational health for canonical data, live feeds, account sync, and workspace surfaces.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Last refresh {latestStatusRefresh ? formatDateTimeET(latestStatusRefresh) : "No refresh yet"}
          </div>
        </header>

        <StatusPanel issues={issues} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {health.map((item) => (
            <HealthStatusCard key={item.name} item={item} />
          ))}
        </section>

        <AppTruthStatusSection projection={appTruthProjection} />

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Canonical Freshness</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Core historical truth layers that power weekly analysis and performance reporting.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {canonicalCards.map((card) => (
              <FreshnessStatusCard key={card.name} card={card} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Kernel Data Layer</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Versioned release canon, closed-week delta, and live-week boundary for active Performance verification.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {kernelCards.map((card) => (
              <FreshnessStatusCard key={card.name} card={card} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Source Freeze Ledger</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Friday 5 PM New York source locks, source trust, ledger hashes, and per-source incident coverage.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {sourceLedgerCards.map((card) => (
              <FreshnessStatusCard key={card.name} card={card} />
            ))}
          </div>
          {sourceLedgerWeeks.length > 0 ? (
            <div className="space-y-3">
              {sourceLedgerWeeks.map((week) => {
                const details = sourceLedgerDetailsByWeek[sourceLedgerWeekKey(week.weekOpenUtc)] ?? [];
                return (
                  <details
                    key={`${week.ledgerVersion}-${week.weekOpenUtc}`}
                    className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm"
                  >
                    <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
                      Trading week {formatDateET(week.weekOpenUtc)} source readiness
                    </summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {details.map((row) => (
                        <div
                          key={`${row.week_open_utc}-${row.source}`}
                          className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold capitalize text-[var(--foreground)]">
                                {row.source}
                              </p>
                              <p className="mt-1 text-xs text-[color:var(--muted)]">
                                {row.source_version}
                              </p>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${toCount(row.untrusted_rows) === 0 ? freshnessToneMap.fresh : freshnessToneMap.missing}`}>
                              {toCount(row.trusted_rows)}/{toCount(row.signal_rows)}
                            </span>
                          </div>
                          <dl className="mt-3 space-y-2 text-xs">
                            <div>
                              <dt className="uppercase tracking-[0.16em] text-[color:var(--muted)]">Freeze target</dt>
                              <dd className="mt-1 text-[var(--foreground)]">
                                {formatDateTimeET(row.freeze_target_utc)}
                              </dd>
                            </div>
                            <div>
                              <dt className="uppercase tracking-[0.16em] text-[color:var(--muted)]">Captured</dt>
                              <dd className="mt-1 text-[var(--foreground)]">
                                {formatLedgerCaptureRange(row)}
                              </dd>
                            </div>
                            <div>
                              <dt className="uppercase tracking-[0.16em] text-[color:var(--muted)]">Lag</dt>
                              <dd className="mt-1 text-[var(--foreground)]">
                                {formatLedgerLag(row.freeze_target_utc, row.latest_source_timestamp_utc)}
                              </dd>
                            </div>
                            <div>
                              <dt className="uppercase tracking-[0.16em] text-[color:var(--muted)]">Evidence / Trust</dt>
                              <dd className="mt-1 text-[var(--foreground)]">
                                {row.evidence_class} / {row.trust_class}
                              </dd>
                            </div>
                            <div>
                              <dt className="uppercase tracking-[0.16em] text-[color:var(--muted)]">Incidents</dt>
                              <dd className="mt-1 text-[var(--foreground)]">
                                {toCount(row.incident_count)} incident(s) across {toCount(row.incident_rows)} row(s)
                              </dd>
                            </div>
                            <div>
                              <dt className="uppercase tracking-[0.16em] text-[color:var(--muted)]">Raw Provider Evidence Missing</dt>
                              <dd className="mt-1 text-[var(--foreground)]">
                                {toCount(row.raw_evidence_missing_rows)}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Data Integrity</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Generated audit coverage for signal completeness, price rows, signal/price joins, and engine trade counts.
            </p>
          </div>
          {!dataIntegrityReport ? (
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--foreground)]">No audit artifact</p>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Run npx tsx scripts/audit-data-integrity.ts to generate reports/data-integrity-audit.json.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <FreshnessStatusCard
                card={{
                  name: "Audit Coverage",
                  status: dataIntegrityPassed ? "fresh" : "stale",
                  detail: `${dataIntegrityReport.weeksChecked} weeks x ${dataIntegrityReport.canonicalPairs} canonical pairs.`,
                  lastUpdated: dataIntegrityReport.generatedUtc,
                  hint: `Display week ${formatDateET(dataIntegrityReport.displayWeekOpenUtc)}.`,
                }}
              />
              <FreshnessStatusCard
                card={{
                  name: "Signals",
                  status: dataIntegrityReport.summary.signalGapCount === 0 ? "fresh" : "missing",
                  detail: `${dataIntegrityReport.summary.signalGapCount} neutral or missing source-pair weeks.`,
                  lastUpdated: dataIntegrityReport.generatedUtc,
                }}
              />
              <FreshnessStatusCard
                card={{
                  name: "Prices",
                  status: dataIntegrityReport.summary.priceGapCount === 0 ? "fresh" : "missing",
                  detail: `${dataIntegrityReport.summary.priceGapCount} missing or duplicate canonical price rows.`,
                  lastUpdated: dataIntegrityReport.generatedUtc,
                }}
              />
              <FreshnessStatusCard
                card={{
                  name: "Signal / Price",
                  status:
                    dataIntegrityReport.summary.directionNoPriceCount === 0
                    && dataIntegrityReport.summary.priceNeutralSignalCount === 0
                      ? "fresh"
                      : "missing",
                  detail: `${dataIntegrityReport.summary.directionNoPriceCount} directional without price; ${dataIntegrityReport.summary.priceNeutralSignalCount} priced neutral/missing.`,
                  lastUpdated: dataIntegrityReport.generatedUtc,
                }}
              />
              <FreshnessStatusCard
                card={{
                  name: "Engine Counts",
                  status: dataIntegrityReport.summary.engineShortfalls === 0 ? "fresh" : "missing",
                  detail: `${dataIntegrityReport.summary.engineShortfalls} trade-count shortfalls or errors.`,
                  lastUpdated: dataIntegrityReport.generatedUtc,
                }}
              />
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Feed Freshness</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Ongoing refresh cadence for live data, snapshots, and account reporting.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {liveFeedCards.map((card) => (
              <FreshnessStatusCard key={card.name} card={card} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Workspace Health</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Readiness of the main user-facing boards and flagship surfaces.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workspaceCards.map((card) => (
              <FreshnessStatusCard key={card.name} card={card} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Automation Bots</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Live heartbeat and readiness for currently monitored automation processes.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--foreground)]">MT5 Basket EA</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${botToneMap[mt5Status]}`}>
                  {mt5Status}
                </span>
              </div>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Last sync {latestAccountSync ? formatDateTimeET(latestAccountSync) : "No sync yet"}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Accounts reporting: {accounts.length}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--foreground)]">Bitget Perp Bot v2</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${botToneMap[bitgetStatus]}`}>
                  {bitgetStatus}
                </span>
              </div>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Last heartbeat {bitgetState?.updated_at ? formatDateTimeET(bitgetState.updated_at) : "No heartbeat yet"}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted)]">
                Lifecycle: {bitgetLifecycle || "IDLE"}
              </p>
            </div>
          </div>
        </section>

        <details className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <summary className="cursor-pointer list-none text-lg font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
            Debug
          </summary>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Raw provider diagnostics and symbol-mapping details for deeper troubleshooting.
          </p>

          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Price Snapshot Coverage</h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Missing live price symbols by asset class.
                </p>
              </div>
              {priceSnapshots.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">No price snapshots.</p>
              ) : (
                <div className="space-y-4">
                  {priceSnapshots.map((snapshot) => (
                    <div
                      key={snapshot.assetId}
                      className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {snapshot.assetLabel}
                        </p>
                        <span className="text-xs text-[var(--muted)]">
                          {snapshot.lastRefreshUtc
                            ? formatDateTimeET(snapshot.lastRefreshUtc)
                            : "No refresh yet"}
                        </span>
                      </div>
                      {snapshot.missingPairs.length === 0 ? (
                        <p className="mt-2 text-sm text-emerald-700">No missing prices detected.</p>
                      ) : (
                        <p className="mt-2 text-xs text-rose-700">
                          Missing: {snapshot.missingPairs.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Myfxbook Debug</h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Raw provider response diagnostics for sentiment troubleshooting.
                </p>
              </div>
              {myfxbookDebugError ? (
                <p className="text-sm text-rose-700">{myfxbookDebugError}</p>
              ) : !myfxbookDebug ? (
                <p className="text-sm text-[color:var(--muted)]">No debug data.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <p className="text-[var(--foreground)]">
                    <span className="font-semibold">Status:</span> {myfxbookDebug.ok ? "OK" : "NOT OK"} (
                    {myfxbookDebug.httpStatus} {myfxbookDebug.statusText}) |{" "}
                    <span className="font-semibold">Latency:</span> {myfxbookDebug.latencyMs}ms
                  </p>
                  <p className="text-[color:var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">Fetched:</span>{" "}
                    {formatDateTimeET(myfxbookDebug.fetchedAtUtc)}
                  </p>
                  <p className="text-[color:var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">Mapped:</span>{" "}
                    {myfxbookDebug.mappedCount} |{" "}
                    <span className="font-semibold text-[var(--foreground)]">Dropped:</span>{" "}
                    {myfxbookDebug.droppedCount}
                  </p>
                  <p className="text-[color:var(--muted)]">
                    <span className="font-semibold text-[var(--foreground)]">Critical Missing:</span>{" "}
                    {myfxbookDebug.criticalMissing.length === 0
                      ? "None"
                      : myfxbookDebug.criticalMissing.join(", ")}
                  </p>
                  <div className="rounded-xl border border-[var(--panel-border)]/60 bg-[var(--panel)] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      Symbol Mapping
                    </p>
                    <div className="max-h-56 overflow-auto text-xs text-[var(--muted)]">
                      {myfxbookDebug.mappings.map((item, index) => (
                        <div
                          key={`${item.raw}-${item.mapped}-${index}`}
                          className="border-t border-[var(--panel-border)]/40 py-1"
                        >
                          <span className="font-semibold text-[var(--foreground)]">{item.raw}</span>
                          {" -> "}
                          <span className="font-semibold text-[var(--foreground)]">{item.mapped}</span>
                          {item.wasMapped ? " (alias map)" : ""}
                          {" | "}
                          {item.included ? "kept" : `dropped (${item.reason})`}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--panel-border)]/60 bg-[var(--panel)] p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                      Body Excerpt
                    </p>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-[var(--muted)]">
                      {myfxbookDebug.bodyExcerpt || "(empty)"}
                    </pre>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/60 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Price Symbol Candidates</h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Candidate symbol mappings used in live price debugging.
                </p>
              </div>
              {priceDebug.length === 0 ? (
                <p className="text-sm text-[color:var(--muted)]">No COT snapshots.</p>
              ) : (
                <div className="space-y-4">
                  {priceDebug.map((asset) => (
                    <div
                      key={asset.assetId}
                      className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {asset.assetLabel}
                        </p>
                        <span className="text-xs text-[var(--muted)]">
                          {asset.reportDate ? formatDateET(asset.reportDate) : "No report date"}
                        </span>
                      </div>
                      <div className="mt-3 max-h-64 overflow-y-auto text-xs text-[var(--muted)]">
                        {asset.missingPairs.map((pair) => (
                          <div
                            key={`${asset.assetId}-${pair.pair}`}
                            className="border-t border-[var(--panel-border)]/40 py-2"
                          >
                            <span className="font-semibold text-[var(--foreground)]">
                              {pair.pair}
                            </span>
                            <span className="ml-2 text-[var(--muted)]">
                              {pair.symbols.join(", ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </details>
      </div>
    </DashboardLayout>
  );
}

function AppTruthStatusSection({ projection }: { projection: AppTruthStatusProjection }) {
  const activeBaseline = projection.activeBaseline;
  const scheduler = projection.schedulerMaterialization;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">App Truth Control Plane</h2>
        <p className="text-sm text-[color:var(--muted)]">
          Phase 1 read-only route truth projection. This reports current evidence and missing contracts without changing route behavior.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">Release Identity</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${appTruthToneMap.ready}`}>
              READY
            </span>
          </div>
          <dl className="mt-3 space-y-2 text-xs text-[color:var(--muted)]">
            <div>
              <dt className="uppercase tracking-[0.16em]">Live</dt>
              <dd className="mt-1 font-semibold text-[var(--foreground)]">{projection.release.liveReleaseId}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.16em]">Dev</dt>
              <dd className="mt-1 font-semibold text-[var(--foreground)]">
                {projection.release.devReleaseId}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.16em]">Cache namespace</dt>
              <dd className="mt-1 break-words text-[var(--foreground)]">{projection.release.cacheNamespace}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">Active Baseline</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${appTruthToneMap[activeBaseline.status]}`}>
              {activeBaseline.status.replace(/_/g, " ").toUpperCase()}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">{activeBaseline.id}</p>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {activeBaseline.closedWeekCount} closed week(s); latest closed {activeBaseline.latestClosedWeekOpenUtc ? formatDateET(activeBaseline.latestClosedWeekOpenUtc) : "unknown"}; live week {activeBaseline.currentWeekOpenUtc ? formatDateET(activeBaseline.currentWeekOpenUtc) : "unknown"}.
          </p>
          <dl className="mt-3 space-y-2 text-xs text-[color:var(--muted)]">
            <div>
              <dt className="uppercase tracking-[0.16em]">Approval</dt>
              <dd className="mt-1 font-semibold text-[var(--foreground)]">
                {activeBaseline.approvalStatus.replace(/_/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.16em]">Source window</dt>
              <dd className="mt-1 break-words text-[var(--foreground)]">
                {activeBaseline.sourceReleaseWindow ?? "unknown"}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.16em]">Performance window</dt>
              <dd className="mt-1 break-words text-[var(--foreground)]">
                {activeBaseline.performanceHistoryWindow ?? "unknown"}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.16em]">Archive mode</dt>
              <dd className="mt-1 font-semibold text-[var(--foreground)]">
                {activeBaseline.archiveMode.replace(/_/g, " ")}
              </dd>
            </div>
          </dl>
          <div className="mt-3 space-y-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3 text-xs">
            <p className="font-semibold text-[var(--foreground)]">
              Source ledger: {activeBaseline.sourceLedgerCoverage.status.replace(/_/g, " ")}
            </p>
            <p className="text-[color:var(--muted)]">{activeBaseline.sourceLedgerCoverage.detail}</p>
            <p className="font-semibold text-[var(--foreground)]">
              Performance kernel: {activeBaseline.performanceCoverage.status.replace(/_/g, " ")}
            </p>
            <p className="text-[color:var(--muted)]">{activeBaseline.performanceCoverage.detail}</p>
          </div>
          <details className="mt-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3 text-xs">
            <summary className="cursor-pointer list-none font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
              Active weeks ({activeBaseline.activeWeeks.length})
            </summary>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {activeBaseline.activeWeeks.map((week) => (
                <span key={week} className="font-mono text-[color:var(--muted)]">
                  {formatDateET(week)}
                </span>
              ))}
            </div>
          </details>
        </div>

        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">Weekly Lifecycle</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${appTruthToneMap[projection.weeklyLifecycle.status]}`}>
              {projection.weeklyLifecycle.status.replace(/_/g, " ").toUpperCase()}
            </span>
          </div>
          <p className="mt-3 text-sm text-[color:var(--muted)]">{projection.weeklyLifecycle.detail}</p>
          <dl className="mt-3 space-y-2 text-xs text-[color:var(--muted)]">
            <div className="flex items-center justify-between gap-3">
              <dt className="uppercase tracking-[0.16em]">Ledger state</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {projection.weeklyLifecycle.ledgerState.replace(/_/g, " ")}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="uppercase tracking-[0.16em]">Closed ready</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {projection.weeklyLifecycle.closedReadyWeekCount}/{projection.weeklyLifecycle.closedExpectedWeekCount}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="uppercase tracking-[0.16em]">Legacy evidence</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {projection.weeklyLifecycle.evidenceReadyWeekCount}/{projection.weeklyLifecycle.closedExpectedWeekCount}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="uppercase tracking-[0.16em]">Receipt-backed</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {projection.weeklyLifecycle.receiptReadyWeekCount}/{projection.weeklyLifecycle.closedExpectedWeekCount}
              </dd>
            </div>
          </dl>
          {projection.weeklyLifecycle.currentWeekState ? (
            <div className="mt-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--foreground)]">
                  Current/open week {formatDateET(projection.weeklyLifecycle.currentWeekState.weekOpenUtc)}
                </p>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${lifecycleStateToneMap[projection.weeklyLifecycle.currentWeekState.state]}`}>
                  {projection.weeklyLifecycle.currentWeekState.state.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              <p className="mt-2 text-[color:var(--muted)]">{projection.weeklyLifecycle.currentWeekState.detail}</p>
            </div>
          ) : null}
          <details className="mt-3 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3 text-xs">
            <summary className="cursor-pointer list-none font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
              Closed week lifecycle ({projection.weeklyLifecycle.weekStates.length})
            </summary>
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {projection.weeklyLifecycle.weekStates.map((week) => (
                <div key={week.weekOpenUtc} className="rounded-lg border border-[var(--panel-border)]/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[color:var(--muted)]">{formatDateET(week.weekOpenUtc)}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${lifecycleStateToneMap[week.state]}`}>
                      {week.state.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-[color:var(--muted)]">{week.detail}</p>
                  <p className="mt-1 font-mono text-[10px] text-[color:var(--muted)]">
                    Source {week.sourceReady ? "ready" : "missing"} | Performance {week.performanceReady ? "ready" : "missing"}
                    {week.freezeTargetUtc ? ` | Freeze ${formatDateTimeET(week.freezeTargetUtc)}` : ""}
                  </p>
                  <div className="mt-2 grid gap-2">
                    {[
                      week.sourceFreezeReceipt,
                      week.dataMaterializationReceipt,
                      week.performanceMaterializationReceipt,
                    ].map((receipt) => (
                      <div
                        key={`${week.weekOpenUtc}-${receipt.label}`}
                        className="rounded-md border border-[var(--panel-border)]/60 px-2 py-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold text-[var(--foreground)]">
                            {receipt.label}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${lifecycleReceiptToneMap[receipt.status]}`}>
                            {receipt.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-1 break-words font-mono text-[9px] text-[color:var(--muted)]">
                          {receipt.runId ?? "no receipt"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
          {projection.weeklyLifecycle.extraPerformanceWeeks.length > 0 ? (
            <details className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <summary className="cursor-pointer list-none font-semibold text-amber-700 dark:text-amber-300 [&::-webkit-details-marker]:hidden">
                Extra Performance kernel weeks ({projection.weeklyLifecycle.extraPerformanceWeeks.length})
              </summary>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {projection.weeklyLifecycle.extraPerformanceWeeks.map((week) => (
                  <span key={week} className="font-mono text-amber-700 dark:text-amber-300">
                    {formatDateET(week)}
                  </span>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">Scheduler Receipts</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${appTruthToneMap[scheduler.status]}`}>
              {scheduler.status.replace(/_/g, " ").toUpperCase()}
            </span>
          </div>
          <p className="mt-3 text-sm text-[color:var(--muted)]">{scheduler.detail}</p>
          <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">{scheduler.requiredContract}</p>
          <dl className="mt-3 space-y-2 text-xs text-[color:var(--muted)]">
            <div className="flex items-center justify-between gap-3">
              <dt className="uppercase tracking-[0.16em]">Scheduler</dt>
              <dd className="font-semibold text-[var(--foreground)]">{scheduler.schedulerRunCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="uppercase tracking-[0.16em]">Materialization</dt>
              <dd className="font-semibold text-[var(--foreground)]">{scheduler.materializationRunCount}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-[0.16em]">Latest receipt</dt>
              <dd className="mt-1 break-words font-mono text-[var(--foreground)]">
                {scheduler.latestRunId ?? "No receipt yet"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {projection.routes.map((route) => (
          <div key={route.route} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{route.label}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">{route.path}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${appTruthToneMap[route.status]}`}>
                {route.status.replace(/_/g, " ").toUpperCase()}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {route.requirements.map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-[var(--foreground)]">{item.label}</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${requirementToneMap[item.status]}`}>
                      {item.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--muted)]">{item.detail}</p>
                </div>
              ))}
            </div>
            {route.blockers.length > 0 ? (
              <div className="mt-3 text-xs text-[color:var(--muted)]">
                Blockers: {route.blockers.join(" | ")}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <details className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
        <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
          Scheduled cron register ({projection.scheduledCrons.filter((item) => item.status === "scheduled").length} scheduled, {projection.scheduledCrons.filter((item) => item.status === "manual_only").length} manual)
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--panel-border)] text-xs">
            <thead>
              <tr className="text-left uppercase tracking-[0.12em] text-[color:var(--muted)]">
                <th className="px-3 py-2">Cron</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Schedules</th>
                <th className="px-3 py-2">Why kept</th>
                <th className="px-3 py-2">Next gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--panel-border)]">
              {projection.scheduledCrons.map((item) => (
                <tr key={item.id}>
                  <td className="max-w-[260px] px-3 py-3">
                    <p className="font-semibold text-[var(--foreground)]">{item.label}</p>
                    <p className="mt-1 break-words font-mono text-[color:var(--muted)]">{item.path}</p>
                    <p className="mt-1 text-[color:var(--muted)]">{item.currentRole}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${scheduledCronToneMap[item.status]}`}>
                      {item.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <p className="mt-2 text-[color:var(--muted)]">{item.sourceClass.replace(/_/g, " ")}</p>
                  </td>
                  <td className="px-3 py-3 text-[var(--foreground)]">{item.owner}</td>
                  <td className="max-w-[160px] px-3 py-3">
                    {item.schedules.length > 0 ? (
                      <div className="space-y-1">
                        {item.schedules.map((schedule) => (
                          <p key={`${item.id}-${schedule}`} className="font-mono text-[var(--foreground)]">
                            {schedule}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[color:var(--muted)]">Manual only</span>
                    )}
                  </td>
                  <td className="max-w-[360px] px-3 py-3 text-[color:var(--muted)]">
                    {item.whyNeeded}
                    <p className="mt-2 font-semibold text-[var(--foreground)]">Risk: {item.risk}</p>
                  </td>
                  <td className="max-w-[360px] px-3 py-3 text-[color:var(--muted)]">{item.nextGate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm" open>
        <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
          Scheduler and materialization run receipts ({scheduler.schedulerRunCount} scheduler, {scheduler.materializationRunCount} materialization)
        </summary>
        {scheduler.ledgerReadError ? (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            {scheduler.ledgerReadError}
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              SchedulerRunLedger
            </p>
            {scheduler.schedulerRuns.length > 0 ? (
              <table className="min-w-full divide-y divide-[var(--panel-border)] text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-[0.12em] text-[color:var(--muted)]">
                    <th className="px-3 py-2">Job</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Completed</th>
                    <th className="px-3 py-2">Outputs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--panel-border)]">
                  {scheduler.schedulerRuns.map((run) => (
                    <tr key={run.runId}>
                      <td className="max-w-[260px] px-3 py-3">
                        <p className="font-semibold text-[var(--foreground)]">{run.jobId}</p>
                        <p className="mt-1 break-words font-mono text-[color:var(--muted)]">{run.runId}</p>
                        <p className="mt-1 text-[color:var(--muted)]">{run.routePath}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${runStatusToneMap[run.status]}`}>
                          {run.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                        {run.errorMessage ? (
                          <p className="mt-2 max-w-[240px] text-rose-700">{run.errorMessage}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-[color:var(--muted)]">
                        {run.completedAtUtc ? formatDateTimeET(run.completedAtUtc) : "Running"}
                      </td>
                      <td className="max-w-[260px] px-3 py-3 text-[color:var(--muted)]">
                        {run.outputArtifacts.length > 0 ? run.outputArtifacts.join(" | ") : "None declared"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3 text-xs text-[color:var(--muted)]">
                No scheduler run receipts have been written yet.
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              MaterializationRunLedger
            </p>
            {scheduler.materializationRuns.length > 0 ? (
              <table className="min-w-full divide-y divide-[var(--panel-border)] text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-[0.12em] text-[color:var(--muted)]">
                    <th className="px-3 py-2">Materialization</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Rows</th>
                    <th className="px-3 py-2">Window</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--panel-border)]">
                  {scheduler.materializationRuns.map((run) => (
                    <tr key={run.runId}>
                      <td className="max-w-[260px] px-3 py-3">
                        <p className="font-semibold text-[var(--foreground)]">{run.materializationType}</p>
                        <p className="mt-1 break-words font-mono text-[color:var(--muted)]">{run.runId}</p>
                        <p className="mt-1 text-[color:var(--muted)]">{run.domain}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${runStatusToneMap[run.status]}`}>
                          {run.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                        {run.errorMessage ? (
                          <p className="mt-2 max-w-[240px] text-rose-700">{run.errorMessage}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-[color:var(--muted)]">
                        {run.rowsTouched === null ? "Unknown" : run.rowsTouched.toLocaleString()}
                      </td>
                      <td className="max-w-[260px] px-3 py-3 text-[color:var(--muted)]">
                        {run.weekWindow.length > 0 ? run.weekWindow.map((week) => formatDateET(week)).join(" | ") : "No week window"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-3 text-xs text-[color:var(--muted)]">
                No materialization run receipts have been written yet.
              </p>
            )}
          </div>
        </div>
      </details>

      <details className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
        <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
          Legacy path register ({projection.legacyPaths.length})
        </summary>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--panel-border)] text-xs">
            <thead>
              <tr className="text-left uppercase tracking-[0.12em] text-[color:var(--muted)]">
                <th className="px-3 py-2">Path</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Observed</th>
                <th className="px-3 py-2">Deletion gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--panel-border)]">
              {projection.legacyPaths.map((item) => (
                <tr key={item.id}>
                  <td className="max-w-[260px] px-3 py-3">
                    <p className="font-semibold text-[var(--foreground)]">{item.label}</p>
                    <p className="mt-1 text-[color:var(--muted)]">{item.currentSurface}</p>
                  </td>
                  <td className="px-3 py-3 text-[var(--foreground)]">{item.status.replace(/_/g, " ")}</td>
                  <td className="px-3 py-3 text-[var(--foreground)]">{item.replacementOwner}</td>
                  <td className="px-3 py-3 text-[var(--foreground)]">{item.observedInCurrentSession.replace(/_/g, " ")}</td>
                  <td className="max-w-[360px] px-3 py-3 text-[color:var(--muted)]">{item.deletionGate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function HealthStatusCard({ item }: { item: HealthItem }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">{item.name}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${healthToneMap[item.status]}`}>
          {item.status.toUpperCase()}
        </span>
      </div>
      <p className="mt-3 text-sm text-[color:var(--muted)]">{item.detail}</p>
      {item.hint ? (
        <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">Fix: {item.hint}</p>
      ) : null}
    </div>
  );
}

function FreshnessStatusCard({ card }: { card: FreshnessCard }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">{card.name}</p>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${freshnessToneMap[card.status]}`}
        >
          {card.status.toUpperCase()}
        </span>
      </div>
      <p className="mt-3 text-sm text-[color:var(--muted)]">{card.detail}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Last update {formatLastUpdated(card.lastUpdated)}
      </p>
      {card.hint ? (
        <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">{card.hint}</p>
      ) : null}
    </div>
  );
}

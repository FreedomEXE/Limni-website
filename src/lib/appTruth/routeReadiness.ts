/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: routeReadiness.ts
 *
 * Description:
 * Receipt-backed route readiness for the active app-truth baseline. Route pages
 * use this as a small gate so trusted app surfaces do not silently outgrow the
 * materialization receipts that certified them.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import {
  buildActiveBaselineManifest,
  getActiveBaselineReceiptBaselineIds,
} from "@/lib/appTruth/activeBaseline";
import { readMaterializationRunReceiptsForBaselineIds } from "@/lib/appTruth/runLedger";
import type {
  AppTruthRouteId,
  AppTruthStatus,
  MaterializationRunLedgerRecord,
  SchedulerRunStatus,
} from "@/lib/appTruth/types";
import { releaseManifest } from "@/lib/version/releaseManifest";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export type ActiveBaselineMaterializationType =
  | "source_freeze_ledger"
  | "canonical_price_and_weekly_returns"
  | "strategy_week_shards";

export type AppTruthRouteReadinessReceipt = {
  materializationType: ActiveBaselineMaterializationType;
  status: "present" | "missing" | "degraded";
  runStatus: SchedulerRunStatus | null;
  runId: string | null;
  completedAtUtc: string | null;
  detail: string;
};

export type AppTruthRouteReadinessWeek = {
  weekOpenUtc: string;
  sourceFreezeReceipt: AppTruthRouteReadinessReceipt;
  dataMaterializationReceipt: AppTruthRouteReadinessReceipt;
  performanceMaterializationReceipt: AppTruthRouteReadinessReceipt;
  dataReady: boolean;
  performanceReady: boolean;
};

export type AppTruthRouteReadinessSlice = {
  route: Extract<AppTruthRouteId, "data" | "performance">;
  ready: boolean;
  status: AppTruthStatus;
  detail: string;
  blockers: string[];
  requiredMaterializationTypes: ActiveBaselineMaterializationType[];
};

export type AppTruthActiveBaselineRouteReadiness = {
  baselineId: string;
  generatedAtUtc: string;
  activeWeeks: string[];
  closedExpectedWeekCount: number;
  dataReadyWeekCount: number;
  performanceReadyWeekCount: number;
  data: AppTruthRouteReadinessSlice;
  performance: AppTruthRouteReadinessSlice;
  weekStates: AppTruthRouteReadinessWeek[];
};

const DATA_REQUIRED_TYPES = [
  "source_freeze_ledger",
  "canonical_price_and_weekly_returns",
] as const satisfies readonly ActiveBaselineMaterializationType[];

const PERFORMANCE_REQUIRED_TYPES = [
  "source_freeze_ledger",
  "canonical_price_and_weekly_returns",
  "strategy_week_shards",
] as const satisfies readonly ActiveBaselineMaterializationType[];

const ALL_REQUIRED_TYPES = Array.from(new Set([
  ...DATA_REQUIRED_TYPES,
  ...PERFORMANCE_REQUIRED_TYPES,
]));

function normalizeWeek(weekOpenUtc: string) {
  return normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
}

function receiptKey(materializationType: string, weekOpenUtc: string) {
  return `${materializationType}::${weekOpenUtc}`;
}

function buildLatestReceiptMap(
  receipts: readonly MaterializationRunLedgerRecord[],
  activeWeeks: readonly string[],
) {
  const activeWeekSet = new Set(activeWeeks.map(normalizeWeek));
  const latest = new Map<string, MaterializationRunLedgerRecord>();

  for (const receipt of receipts) {
    for (const rawWeek of receipt.weekWindow) {
      const weekOpenUtc = normalizeWeek(rawWeek);
      if (!activeWeekSet.has(weekOpenUtc)) continue;

      const key = receiptKey(receipt.materializationType, weekOpenUtc);
      if (!latest.has(key)) {
        latest.set(key, receipt);
      }
    }
  }

  return latest;
}

function readReceipt(
  latestReceipts: ReadonlyMap<string, MaterializationRunLedgerRecord>,
  materializationType: ActiveBaselineMaterializationType,
  weekOpenUtc: string,
): AppTruthRouteReadinessReceipt {
  const receipt = latestReceipts.get(receiptKey(materializationType, weekOpenUtc));
  if (!receipt) {
    return {
      materializationType,
      status: "missing",
      runStatus: null,
      runId: null,
      completedAtUtc: null,
      detail: `${materializationType} receipt is missing for ${weekOpenUtc}.`,
    };
  }

  const weekIssueText = [
    ...receipt.missingInputs,
    ...receipt.degradedReasons,
    receipt.errorMessage,
  ].filter((value): value is string => Boolean(value)).join(" | ");
  const issueMentionsWeek =
    weekIssueText.includes(weekOpenUtc) ||
    weekIssueText.includes(weekOpenUtc.slice(0, 10));

  if (receipt.status !== "succeeded") {
    if (receipt.status === "degraded" && !issueMentionsWeek) {
      return {
        materializationType,
        status: "present",
        runStatus: receipt.status,
        runId: receipt.runId,
        completedAtUtc: receipt.completedAtUtc,
        detail: `${materializationType} receipt is present for ${weekOpenUtc}; latest degraded receipt does not identify this week as degraded.`,
      };
    }

    return {
      materializationType,
      status: "degraded",
      runStatus: receipt.status,
      runId: receipt.runId,
      completedAtUtc: receipt.completedAtUtc,
      detail: `${materializationType} latest receipt is ${receipt.status} for ${weekOpenUtc}.`,
    };
  }

  return {
    materializationType,
    status: "present",
    runStatus: receipt.status,
    runId: receipt.runId,
    completedAtUtc: receipt.completedAtUtc,
    detail: `${materializationType} receipt is present for ${weekOpenUtc}.`,
  };
}

function missingOrDegradedBlockers(
  weekStates: readonly AppTruthRouteReadinessWeek[],
  materializationTypes: readonly ActiveBaselineMaterializationType[],
) {
  const blockers: string[] = [];
  const receiptByType = (week: AppTruthRouteReadinessWeek, type: ActiveBaselineMaterializationType) => {
    if (type === "source_freeze_ledger") return week.sourceFreezeReceipt;
    if (type === "canonical_price_and_weekly_returns") return week.dataMaterializationReceipt;
    return week.performanceMaterializationReceipt;
  };

  for (const week of weekStates) {
    for (const materializationType of materializationTypes) {
      const receipt = receiptByType(week, materializationType);
      if (receipt.status === "missing") {
        blockers.push(`${materializationType} missing for ${week.weekOpenUtc}`);
      } else if (receipt.status === "degraded") {
        blockers.push(`${materializationType} ${receipt.runStatus ?? "degraded"} for ${week.weekOpenUtc}`);
      }
    }
  }

  return blockers;
}

function routeSlice(options: {
  route: Extract<AppTruthRouteId, "data" | "performance">;
  expectedWeekCount: number;
  readyWeekCount: number;
  weekStates: readonly AppTruthRouteReadinessWeek[];
  requiredMaterializationTypes: readonly ActiveBaselineMaterializationType[];
}): AppTruthRouteReadinessSlice {
  const blockers = missingOrDegradedBlockers(options.weekStates, options.requiredMaterializationTypes);
  const ready = options.expectedWeekCount > 0 && blockers.length === 0;
  const label = options.route === "data" ? "Data" : "Performance";

  return {
    route: options.route,
    ready,
    status: ready ? "ready" : "blocked",
    detail: ready
      ? `${label} route active baseline receipts are ready: ${options.readyWeekCount}/${options.expectedWeekCount} week(s).`
      : `${label} route active baseline receipts are blocked: ${options.readyWeekCount}/${options.expectedWeekCount} week(s) ready.`,
    blockers,
    requiredMaterializationTypes: [...options.requiredMaterializationTypes],
  };
}

export async function readActiveBaselineRouteReadiness(
  generatedAtUtc = new Date().toISOString(),
): Promise<AppTruthActiveBaselineRouteReadiness> {
  const baseline = buildActiveBaselineManifest({
    manifest: releaseManifest,
    generatedAtUtc,
  });
  const activeWeeks = baseline.activeWeeks.map(normalizeWeek).sort();
  const receipts = await readMaterializationRunReceiptsForBaselineIds({
    baselineIds: getActiveBaselineReceiptBaselineIds(),
    materializationTypes: ALL_REQUIRED_TYPES,
    limit: 500,
  });
  const latestReceipts = buildLatestReceiptMap(receipts, activeWeeks);

  const weekStates = activeWeeks.map((weekOpenUtc) => {
    const sourceFreezeReceipt = readReceipt(latestReceipts, "source_freeze_ledger", weekOpenUtc);
    const dataMaterializationReceipt = readReceipt(
      latestReceipts,
      "canonical_price_and_weekly_returns",
      weekOpenUtc,
    );
    const performanceMaterializationReceipt = readReceipt(
      latestReceipts,
      "strategy_week_shards",
      weekOpenUtc,
    );
    const dataReady = sourceFreezeReceipt.status === "present"
      && dataMaterializationReceipt.status === "present";
    const performanceReady = dataReady
      && performanceMaterializationReceipt.status === "present";

    return {
      weekOpenUtc,
      sourceFreezeReceipt,
      dataMaterializationReceipt,
      performanceMaterializationReceipt,
      dataReady,
      performanceReady,
    };
  });

  const dataReadyWeekCount = weekStates.filter((week) => week.dataReady).length;
  const performanceReadyWeekCount = weekStates.filter((week) => week.performanceReady).length;

  return {
    baselineId: baseline.baselineId,
    generatedAtUtc,
    activeWeeks,
    closedExpectedWeekCount: activeWeeks.length,
    dataReadyWeekCount,
    performanceReadyWeekCount,
    data: routeSlice({
      route: "data",
      expectedWeekCount: activeWeeks.length,
      readyWeekCount: dataReadyWeekCount,
      weekStates,
      requiredMaterializationTypes: DATA_REQUIRED_TYPES,
    }),
    performance: routeSlice({
      route: "performance",
      expectedWeekCount: activeWeeks.length,
      readyWeekCount: performanceReadyWeekCount,
      weekStates,
      requiredMaterializationTypes: PERFORMANCE_REQUIRED_TYPES,
    }),
    weekStates,
  };
}

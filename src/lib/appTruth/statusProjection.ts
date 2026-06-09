/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: statusProjection.ts
 *
 * Description:
 * Boot-safe Status projection for the first App Truth Architecture gate.
 * This reports current evidence and missing contracts without changing route
 * behavior or declaring Data/Performance migrated.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { APP_TRUTH_LEGACY_PATH_REGISTER } from "@/lib/appTruth/legacyPathRegister";
import { APP_TRUTH_SCHEDULED_CRON_REGISTER } from "@/lib/appTruth/scheduledCronRegister";
import {
  buildActiveBaselineManifest,
  compareWeeksToActiveBaseline,
} from "@/lib/appTruth/activeBaseline";
import type {
  ActiveBaselineSnapshot,
  AppTruthRequirementSnapshot,
  AppTruthStatus,
  AppTruthStatusProjection,
  DomainReadinessSnapshot,
  MaterializationRunLedgerRecord,
  RouteTruthContract,
  RouteTruthSnapshot,
  SchedulerRunLedgerRecord,
  SchedulerMaterializationSnapshot,
  WeeklyLifecycleReceiptState,
  WeeklyLifecycleWeekState,
  WeeklyLifecycleSnapshot,
} from "@/lib/appTruth/types";
import type { FrozenSourceLedgerWeekSummary } from "@/lib/sourceFreeze/sourceLedger";
import type { ReleaseManifest } from "@/lib/version/releaseManifest";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export const APP_TRUTH_ROUTE_CONTRACTS: RouteTruthContract[] = [
  {
    route: "data",
    label: "Data",
    requiredRecords: [
      "ActiveBaselineManifest",
      "Data DomainManifest",
      "FrozenSourceLedger for closed active weeks",
      "WeeklyLifecycleLedger",
    ],
    allowedDegradedRecords: ["Live/current overlay"],
  },
  {
    route: "performance",
    label: "Performance",
    requiredRecords: [
      "ActiveBaselineManifest",
      "Performance DomainManifest",
      "Selected ExecutionLedger",
      "Selected TradeRowLedger",
      "WeeklyLifecycleLedger",
    ],
    allowedDegradedRecords: ["Live/current overlay"],
  },
  {
    route: "status",
    label: "Status",
    requiredRecords: ["Boot-safe diagnostics"],
    allowedDegradedRecords: ["Data route failure", "Performance route failure"],
  },
];

type KernelProjectionInput = {
  status: string;
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
} | null;

type BuildStatusAppTruthProjectionOptions = {
  manifest: ReleaseManifest;
  kernelDiagnostics: KernelProjectionInput;
  sourceLedgerWeeks: FrozenSourceLedgerWeekSummary[];
  sourceLedgerError: string | null;
  currentWeekOpenUtc: string;
  canonicalRuntimeError: string | null;
  dataIntegrityGeneratedUtc: string | null;
  schedulerRuns: SchedulerRunLedgerRecord[];
  materializationRuns: MaterializationRunLedgerRecord[];
  schedulerLedgerReadError: string | null;
};

function requirement(
  id: string,
  label: string,
  status: AppTruthRequirementSnapshot["status"],
  detail: string,
): AppTruthRequirementSnapshot {
  return { id, label, status, detail };
}

function contractFor(route: RouteTruthContract["route"]) {
  const contract = APP_TRUTH_ROUTE_CONTRACTS.find((entry) => entry.route === route);
  if (!contract) {
    throw new Error(`Missing app truth route contract for ${route}`);
  }
  return contract;
}

function summarizeSourceLedger(options: {
  sourceLedgerWeeks: FrozenSourceLedgerWeekSummary[];
  sourceLedgerError: string | null;
}) {
  if (options.sourceLedgerError) {
    return requirement(
      "frozen-source-ledger",
      "FrozenSourceLedger",
      "missing",
      options.sourceLedgerError,
    );
  }

  if (options.sourceLedgerWeeks.length === 0) {
    return requirement(
      "frozen-source-ledger",
      "FrozenSourceLedger",
      "missing",
      "No frozen source ledger weeks found in the audited Status path.",
    );
  }

  const trusted = options.sourceLedgerWeeks.filter((week) => week.complete && week.trustedForFreeze);
  const status = trusted.length === options.sourceLedgerWeeks.length ? "present" : "partial";
  return requirement(
    "frozen-source-ledger",
    "FrozenSourceLedger",
    status,
    `${trusted.length}/${options.sourceLedgerWeeks.length} active baseline source-freeze week(s) complete and trusted.`,
  );
}

function summarizeKernel(kernel: KernelProjectionInput) {
  if (!kernel) {
    return requirement(
      "kernel-inventory",
      "Kernel inventory",
      "missing",
      "No active Performance kernel inventory was available to Status.",
    );
  }
  if (kernel.error) {
    return requirement(
      "kernel-inventory",
      "Kernel inventory",
      "partial",
      kernel.error,
    );
  }
  return requirement(
    "kernel-inventory",
    "Kernel inventory",
    "present",
    `${kernel.totalWeeks} closed week shard(s), ${kernel.rowCount.toLocaleString()} row(s), ${kernel.activeStrategyVariant}.`,
  );
}

function routeSnapshot(options: {
  route: RouteTruthContract["route"];
  path: string;
  status: AppTruthStatus;
  requirements: AppTruthRequirementSnapshot[];
  blockers?: string[];
  degradedReasons?: string[];
}): RouteTruthSnapshot {
  const contract = contractFor(options.route);
  return {
    route: options.route,
    label: contract.label,
    path: options.path,
    status: options.status,
    contract,
    requirements: options.requirements,
    blockers: options.blockers ?? [],
    degradedReasons: options.degradedReasons ?? [],
  };
}

function buildActiveBaselineSnapshot(options: {
  manifest: ReleaseManifest;
  generatedAtUtc: string;
  kernelDiagnostics: KernelProjectionInput;
  sourceLedgerWeeks: FrozenSourceLedgerWeekSummary[];
  currentWeekOpenUtc: string;
}): ActiveBaselineSnapshot {
  const baselineManifest = buildActiveBaselineManifest({
    manifest: options.manifest,
    generatedAtUtc: options.generatedAtUtc,
    currentWeekOpenUtc: options.currentWeekOpenUtc,
  });
  const sourceLedgerCoverage = compareWeeksToActiveBaseline({
    expectedWeeks: baselineManifest.activeWeeks,
    actualWeeks: options.sourceLedgerWeeks
      .filter((week) => week.complete && week.trustedForFreeze)
      .map((week) => week.weekOpenUtc),
    missingDetailLabel: "No trusted source-freeze ledger weeks found for the active baseline",
    matchedDetailLabel: "Source-freeze ledger matches the active baseline",
    allowExtraWeeks: true,
  });
  const performanceCoverage = compareWeeksToActiveBaseline({
    expectedWeeks: baselineManifest.activeWeeks,
    actualWeeks: options.kernelDiagnostics?.weekOpenUtcs ?? [],
    missingDetailLabel: "No Performance kernel weeks found for the active baseline",
    matchedDetailLabel: "Performance kernel coverage matches the active baseline",
    allowExtraWeeks: true,
  });
  const latestBaselineWeek = baselineManifest.activeWeeks.at(-1) ?? null;
  const blockers = [];
  if (sourceLedgerCoverage.status !== "match") {
    blockers.push("Source-freeze ledger does not match the active baseline week set.");
  }
  if (performanceCoverage.status !== "match") {
    blockers.push("Performance kernel coverage does not match the active baseline week set.");
  }
  if (baselineManifest.approvalStatus === "blocked") {
    blockers.push("Active baseline approval is blocked.");
  } else if (baselineManifest.approvalStatus === "draft") {
    blockers.push("Active baseline contract is still a draft.");
  }

  return {
    id: baselineManifest.baselineId,
    status: sourceLedgerCoverage.status === "match" && performanceCoverage.status === "match"
      ? "ready"
      : "blocked",
    source: "static_contract",
    approvalStatus: baselineManifest.approvalStatus,
    activeWeeks: baselineManifest.activeWeeks,
    sourceNamespace: baselineManifest.sourceNamespace,
    sourceReleaseWindow: baselineManifest.sourceReleaseWindow,
    performanceNamespace: baselineManifest.performanceNamespace,
    performanceHistoryWindow: baselineManifest.performanceHistoryWindow,
    engineNamespace: baselineManifest.engineNamespace,
    executionLedgerNamespace: baselineManifest.executionLedgerNamespace,
    closedWeekCount: baselineManifest.activeWeeks.length,
    currentWeekOpenUtc: options.kernelDiagnostics?.currentWeekOpenUtc ?? options.currentWeekOpenUtc,
    latestClosedWeekOpenUtc: latestBaselineWeek,
    archiveMode: baselineManifest.archiveAvailable ? "separate" : "not_implemented",
    archiveAvailable: baselineManifest.archiveAvailable,
    sourceLedgerCoverage,
    performanceCoverage,
    blockers,
  };
}

function buildWeeklyLifecycleSnapshot(options: {
  activeBaseline: ActiveBaselineSnapshot;
  sourceLedgerRequirement: AppTruthRequirementSnapshot;
  sourceLedgerWeeks: FrozenSourceLedgerWeekSummary[];
  kernelDiagnostics: KernelProjectionInput;
  materializationRuns: MaterializationRunLedgerRecord[];
}): WeeklyLifecycleSnapshot {
  const normalizeWeek = (weekOpenUtc: string | null | undefined) => (
    weekOpenUtc ? normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc : ""
  );
  const sourceWeeks = new Map(
    options.sourceLedgerWeeks.map((week) => [normalizeWeek(week.weekOpenUtc), week]),
  );
  const performanceWeeks = new Set(
    (options.kernelDiagnostics?.weekOpenUtcs ?? []).map(normalizeWeek),
  );
  const normalizedRunWeekSet = (run: MaterializationRunLedgerRecord) => new Set(
    run.weekWindow.map(normalizeWeek).filter(Boolean),
  );
  const receiptForWeek = (
    materializationType: string,
    weekOpenUtc: string,
  ) => options.materializationRuns.find((run) => (
    run.materializationType === materializationType &&
    normalizedRunWeekSet(run).has(weekOpenUtc)
  ));
  const receiptState = (
    label: string,
    materializationType: string,
    weekOpenUtc: string,
  ): WeeklyLifecycleReceiptState => {
    const run = receiptForWeek(materializationType, weekOpenUtc);
    if (!run) {
      return {
        label,
        status: "missing",
        runId: null,
        completedAtUtc: null,
        detail: `${label} receipt is missing for this week.`,
      };
    }
    if (run.status !== "succeeded") {
      return {
        label,
        status: "degraded",
        runId: run.runId,
        completedAtUtc: run.completedAtUtc,
        detail: run.errorMessage ?? (run.degradedReasons.join(" | ") || `${label} receipt status is ${run.status}.`),
      };
    }
    return {
      label,
      status: "present",
      runId: run.runId,
      completedAtUtc: run.completedAtUtc,
      detail: `${label} receipt is present and succeeded.`,
    };
  };

  const weekStates: WeeklyLifecycleWeekState[] = options.activeBaseline.activeWeeks.map((weekOpenUtc) => {
    const normalizedWeek = normalizeWeek(weekOpenUtc);
    const sourceWeek = sourceWeeks.get(normalizedWeek) ?? null;
    const sourceReady = Boolean(sourceWeek?.complete && sourceWeek.trustedForFreeze);
    const performanceReady = performanceWeeks.has(normalizedWeek);
    const sourceFreezeReceipt = receiptState("Source freeze", "source_freeze_ledger", normalizedWeek);
    const dataMaterializationReceipt = receiptState("Data materialization", "canonical_price_and_weekly_returns", normalizedWeek);
    const performanceMaterializationReceipt = receiptState("Performance materialization", "strategy_week_shards", normalizedWeek);
    const evidenceReady = sourceReady && performanceReady;
    const receiptReady = [
      sourceFreezeReceipt,
      dataMaterializationReceipt,
      performanceMaterializationReceipt,
    ].every((receipt) => receipt.status === "present");
    const state: WeeklyLifecycleWeekState["state"] = evidenceReady && receiptReady
      ? "closed_ready"
      : evidenceReady
        ? "materialization_receipts_missing"
        : sourceReady
        ? "source_ready_kernel_missing"
        : performanceReady
          ? "source_missing_kernel_ready"
          : "closed_missing";
    const detail = state === "closed_ready"
      ? "Closed week has trusted source-freeze evidence, Performance coverage, and required materialization receipts."
      : state === "materialization_receipts_missing"
        ? "Legacy evidence is ready, but source-freeze/data/performance materialization receipts are missing or degraded."
      : state === "source_ready_kernel_missing"
        ? "Source-freeze evidence exists, but Performance kernel coverage is missing."
        : state === "source_missing_kernel_ready"
          ? "Performance kernel coverage exists, but trusted source-freeze evidence is missing."
          : "Closed week is missing both trusted source-freeze evidence and Performance kernel coverage.";

    return {
      weekOpenUtc: normalizedWeek,
      role: "closed_active",
      state,
      sourceReady,
      performanceReady,
      evidenceReady,
      receiptReady,
      sourceFreezeReceipt,
      dataMaterializationReceipt,
      performanceMaterializationReceipt,
      freezeTargetUtc: sourceWeek?.freezeTargetUtc ?? null,
      sourceHash: sourceWeek?.sourceHash ?? null,
      detail,
    };
  });

  const expectedWeeks = new Set(options.activeBaseline.activeWeeks.map(normalizeWeek));
  const extraPerformanceWeeks = Array.from(performanceWeeks)
    .filter((week) => week && !expectedWeeks.has(week))
    .sort();
  const currentWeek = normalizeWeek(options.activeBaseline.currentWeekOpenUtc);
  const currentWeekState: WeeklyLifecycleWeekState | null = currentWeek
    ? {
        weekOpenUtc: currentWeek,
        role: "current_open",
        state: "current_live_overlay",
        sourceReady: false,
        performanceReady: false,
        evidenceReady: false,
        receiptReady: false,
        sourceFreezeReceipt: {
          label: "Source freeze",
          status: "missing",
          runId: null,
          completedAtUtc: null,
          detail: "Current/open week is not source-frozen.",
        },
        dataMaterializationReceipt: {
          label: "Data materialization",
          status: "missing",
          runId: null,
          completedAtUtc: null,
          detail: "Current/open week does not satisfy closed-week data materialization.",
        },
        performanceMaterializationReceipt: {
          label: "Performance materialization",
          status: "missing",
          runId: null,
          completedAtUtc: null,
          detail: "Current/open week does not satisfy closed-week Performance materialization.",
        },
        freezeTargetUtc: null,
        sourceHash: null,
        detail: "Current/open week is a live overlay candidate and does not satisfy closed-week readiness.",
      }
    : null;
  const evidenceReadyWeekCount = weekStates.filter((week) => week.evidenceReady).length;
  const receiptReadyWeekCount = weekStates.filter((week) => week.receiptReady).length;
  const closedReadyWeekCount = weekStates.filter((week) => week.state === "closed_ready").length;
  const allClosedReady = closedReadyWeekCount === weekStates.length && weekStates.length > 0;
  const hasAnyReceipt = weekStates.some((week) => (
    week.sourceFreezeReceipt.status !== "missing" ||
    week.dataMaterializationReceipt.status !== "missing" ||
    week.performanceMaterializationReceipt.status !== "missing"
  ));

  return {
    status: allClosedReady ? "ready" : evidenceReadyWeekCount === weekStates.length ? "degraded" : "blocked",
    currentWeekOpenUtc: options.activeBaseline.currentWeekOpenUtc,
    latestClosedWeekOpenUtc: options.activeBaseline.latestClosedWeekOpenUtc,
    ledgerState: allClosedReady
      ? "visible"
      : hasAnyReceipt || options.sourceLedgerRequirement.status === "present"
        ? "partial"
        : "missing_contract",
    closedExpectedWeekCount: weekStates.length,
    evidenceReadyWeekCount,
    receiptReadyWeekCount,
    closedReadyWeekCount,
    currentWeekState,
    weekStates,
    extraPerformanceWeeks,
    detail: allClosedReady
      ? "Receipt-backed lifecycle projection shows all active closed weeks ready and current week isolated as live overlay."
      : evidenceReadyWeekCount === weekStates.length
        ? `Legacy evidence is ready for ${evidenceReadyWeekCount}/${weekStates.length} active closed week(s), but receipt-backed closed readiness is ${closedReadyWeekCount}/${weekStates.length}.`
        : `Receipt-backed lifecycle projection shows ${closedReadyWeekCount}/${weekStates.length} closed-ready week(s); legacy evidence is ready for ${evidenceReadyWeekCount}/${weekStates.length}.`,
  };
}

function hasBadRunStatus(run: SchedulerRunLedgerRecord | MaterializationRunLedgerRecord) {
  return run.status === "failed" || run.status === "degraded";
}

function buildSchedulerSnapshot(options: {
  schedulerRuns: SchedulerRunLedgerRecord[];
  materializationRuns: MaterializationRunLedgerRecord[];
  ledgerReadError: string | null;
}): SchedulerMaterializationSnapshot {
  const latestSchedulerRun = options.schedulerRuns[0] ?? null;
  const latestMaterializationRun = options.materializationRuns[0] ?? null;
  const latestRunId = latestMaterializationRun?.runId ?? latestSchedulerRun?.runId ?? null;

  if (options.ledgerReadError) {
    return {
      status: "degraded",
      latestRunId,
      detail: `SchedulerRunLedger / MaterializationRunLedger tables are defined, but Status could not read receipts: ${options.ledgerReadError}`,
      requiredContract: "Jobs must publish run receipts before cron success can be treated as app truth.",
      schedulerRunCount: options.schedulerRuns.length,
      materializationRunCount: options.materializationRuns.length,
      latestSchedulerRun,
      latestMaterializationRun,
      schedulerRuns: options.schedulerRuns,
      materializationRuns: options.materializationRuns,
      ledgerReadError: options.ledgerReadError,
    };
  }

  const hasReceipts = options.schedulerRuns.length > 0 || options.materializationRuns.length > 0;
  const latestBadRun = [latestSchedulerRun, latestMaterializationRun].filter(Boolean).some((run) => (
    run ? hasBadRunStatus(run) : false
  ));

  return {
    status: !hasReceipts ? "degraded" : latestBadRun ? "degraded" : "ready",
    latestRunId,
    detail: !hasReceipts
      ? "Durable scheduler/materialization receipt tables exist, but no run receipts have been written yet."
      : `Durable receipts visible: ${options.schedulerRuns.length} scheduler run(s), ${options.materializationRuns.length} materialization run(s).`,
    requiredContract: "Cron/materialization output must be represented by durable run receipts before it can advance app truth.",
    schedulerRunCount: options.schedulerRuns.length,
    materializationRunCount: options.materializationRuns.length,
    latestSchedulerRun,
    latestMaterializationRun,
    schedulerRuns: options.schedulerRuns,
    materializationRuns: options.materializationRuns,
    ledgerReadError: null,
  };
}

function schedulerRequirementStatus(snapshot: SchedulerMaterializationSnapshot): AppTruthRequirementSnapshot["status"] {
  if (snapshot.ledgerReadError) return "partial";
  if (snapshot.schedulerRunCount === 0 && snapshot.materializationRunCount === 0) return "partial";
  return snapshot.status === "ready" ? "present" : "partial";
}

function schedulerBlockers(snapshot: SchedulerMaterializationSnapshot) {
  const blockers = [];
  if (snapshot.ledgerReadError) {
    blockers.push("Scheduler/materialization run receipt read failed.");
  }
  if (snapshot.schedulerRunCount === 0) {
    blockers.push("No durable SchedulerRunLedger receipts are visible yet.");
  }
  if (snapshot.materializationRunCount === 0) {
    blockers.push("No durable MaterializationRunLedger receipts are visible yet.");
  }
  return blockers;
}

export function buildStatusAppTruthProjection(
  options: BuildStatusAppTruthProjectionOptions,
): AppTruthStatusProjection {
  const generatedAtUtc = new Date().toISOString();
  const activeBaseline = buildActiveBaselineSnapshot({
    manifest: options.manifest,
    generatedAtUtc,
    kernelDiagnostics: options.kernelDiagnostics,
    sourceLedgerWeeks: options.sourceLedgerWeeks,
    currentWeekOpenUtc: options.currentWeekOpenUtc,
  });
  const sourceLedgerRequirement = summarizeSourceLedger({
    sourceLedgerWeeks: options.sourceLedgerWeeks,
    sourceLedgerError: options.sourceLedgerError,
  });
  const kernelRequirement = summarizeKernel(options.kernelDiagnostics);
  const schedulerMaterialization = buildSchedulerSnapshot({
    schedulerRuns: options.schedulerRuns,
    materializationRuns: options.materializationRuns,
    ledgerReadError: options.schedulerLedgerReadError,
  });
  const weeklyLifecycle = buildWeeklyLifecycleSnapshot({
    activeBaseline,
    sourceLedgerRequirement,
    sourceLedgerWeeks: options.sourceLedgerWeeks,
    kernelDiagnostics: options.kernelDiagnostics,
    materializationRuns: options.materializationRuns,
  });

  const activeBaselineRequirement = requirement(
    "active-baseline-manifest",
    "ActiveBaselineManifest",
    "present",
    `Read-only ${activeBaseline.id} contract is defined with ${activeBaseline.activeWeeks.length} active week(s); approval ${activeBaseline.approvalStatus.replace(/_/g, " ")}.`,
  );
  const lifecycleRequirement = requirement(
    "weekly-lifecycle-ledger",
    "WeeklyLifecycleLedger",
    weeklyLifecycle.ledgerState === "visible"
      ? "present"
      : weeklyLifecycle.ledgerState === "partial"
        ? "partial"
        : "missing",
    weeklyLifecycle.detail,
  );
  const dataDomainRequirement = requirement(
    "data-domain-manifest",
    "Data DomainManifest",
    "not_implemented",
    "Data still uses route/page payload ownership.",
  );
  const performanceDomainRequirement = requirement(
    "performance-domain-manifest",
    "Performance DomainManifest",
    "not_implemented",
    "Performance still has split kernel/session/payload ownership.",
  );
  const executionLedgerRequirement = requirement(
    "selected-execution-ledger",
    "Selected ExecutionLedger",
    "not_implemented",
    "Selected execution ledger identity is not exposed as route truth yet.",
  );
  const tradeRowLedgerRequirement = requirement(
    "selected-trade-row-ledger",
    "Selected TradeRowLedger",
    "not_implemented",
    "Summary, Basket, export, and drilldown do not share an exposed selected trade-row ledger id yet.",
  );
  const statusDiagnosticsRequirement = requirement(
    "boot-safe-diagnostics",
    "Boot-safe diagnostics",
    "present",
    "Status bypasses the preload gate and renders from server diagnostics.",
  );

  const dataBlockers = [
    "Data DomainManifest missing.",
  ];
  if (lifecycleRequirement.status === "missing") {
    dataBlockers.push("WeeklyLifecycleLedger missing.");
  } else if (lifecycleRequirement.status === "partial") {
    dataBlockers.push("WeeklyLifecycleLedger is partial.");
  }
  if (activeBaseline.status === "blocked") {
    dataBlockers.push("Active baseline evidence does not fully match the active closed-week contract.");
  }
  if (sourceLedgerRequirement.status === "missing") {
    dataBlockers.push("FrozenSourceLedger evidence missing or failed.");
  }

  const performanceBlockers = [
    "Performance DomainManifest missing.",
    "Selected ExecutionLedger missing.",
    "Selected TradeRowLedger missing.",
  ];
  if (lifecycleRequirement.status === "missing") {
    performanceBlockers.push("WeeklyLifecycleLedger missing.");
  } else if (lifecycleRequirement.status === "partial") {
    performanceBlockers.push("WeeklyLifecycleLedger is partial.");
  }
  if (activeBaseline.status === "blocked") {
    performanceBlockers.push("Active baseline evidence does not fully match the active closed-week contract.");
  }
  if (kernelRequirement.status === "missing") {
    performanceBlockers.push("Kernel inventory missing.");
  }

  const domains: DomainReadinessSnapshot[] = [
    {
      domain: "data",
      label: "Data",
      status: sourceLedgerRequirement.status === "missing" || lifecycleRequirement.status === "missing"
        ? "blocked"
        : "missing_contract",
      requirements: [
        activeBaselineRequirement,
        dataDomainRequirement,
        sourceLedgerRequirement,
        lifecycleRequirement,
      ],
      namespaceComparisons: [
        {
          namespace: "data-domain",
          expected: options.manifest.cacheNamespace,
          actual: null,
          status: "not_implemented",
          detail: "Data domain namespace comparison is not implemented yet.",
        },
      ],
      blockers: dataBlockers,
      degradedReasons: [],
    },
    {
      domain: "performance",
      label: "Performance",
      status: kernelRequirement.status === "missing" || lifecycleRequirement.status === "missing"
        ? "blocked"
        : "missing_contract",
      requirements: [
        activeBaselineRequirement,
        performanceDomainRequirement,
        kernelRequirement,
        executionLedgerRequirement,
        tradeRowLedgerRequirement,
        lifecycleRequirement,
      ],
      namespaceComparisons: [
        {
          namespace: "performance-cache",
          expected: options.manifest.cacheNamespace,
          actual: options.kernelDiagnostics?.cacheNamespace ?? null,
          status: options.kernelDiagnostics
            ? options.kernelDiagnostics.cacheNamespace === options.manifest.cacheNamespace
              ? "match"
              : "mismatch"
            : "missing",
          detail: "Kernel cache namespace compared against release manifest.",
        },
      ],
      blockers: performanceBlockers,
      degradedReasons: options.canonicalRuntimeError ? [options.canonicalRuntimeError] : [],
    },
    {
      domain: "status",
      label: "Status",
      status: "ready",
      requirements: [statusDiagnosticsRequirement],
      namespaceComparisons: [],
      blockers: [],
      degradedReasons: [],
    },
    {
      domain: "scheduler",
      label: "Scheduler / Materialization",
      status: schedulerMaterialization.status,
      requirements: [
        requirement(
          "scheduler-materialization-ledgers",
          "SchedulerRunLedger / MaterializationRunLedger",
          schedulerRequirementStatus(schedulerMaterialization),
          schedulerMaterialization.detail,
        ),
      ],
      namespaceComparisons: [],
      blockers: schedulerBlockers(schedulerMaterialization),
      degradedReasons: schedulerMaterialization.ledgerReadError ? [schedulerMaterialization.ledgerReadError] : [],
    },
  ];

  const routes: RouteTruthSnapshot[] = [
    routeSnapshot({
      route: "data",
      path: "/dashboard",
      status: domains[0]?.status ?? "unknown",
      requirements: domains[0]?.requirements ?? [],
      blockers: domains[0]?.blockers ?? [],
    }),
    routeSnapshot({
      route: "performance",
      path: "/performance",
      status: domains[1]?.status ?? "unknown",
      requirements: domains[1]?.requirements ?? [],
      blockers: domains[1]?.blockers ?? [],
      degradedReasons: domains[1]?.degradedReasons ?? [],
    }),
    routeSnapshot({
      route: "status",
      path: "/status",
      status: "ready",
      requirements: [statusDiagnosticsRequirement],
    }),
  ];

  return {
    generatedAtUtc,
    release: {
      liveReleaseId: options.manifest.appVersion,
      candidateReleaseId: options.manifest.pendingRelease?.appVersion ?? null,
      cacheNamespace: options.manifest.cacheNamespace,
      canonVersion: options.manifest.canonVersion,
      engineVersion: options.manifest.components.engineVersion,
      preparedAt: options.manifest.preparedAt,
      releasedAt: options.manifest.releasedAt,
    },
    activeBaseline,
    weeklyLifecycle,
    domains,
    routes,
    legacyPaths: APP_TRUTH_LEGACY_PATH_REGISTER,
    scheduledCrons: APP_TRUTH_SCHEDULED_CRON_REGISTER,
    schedulerMaterialization,
  };
}

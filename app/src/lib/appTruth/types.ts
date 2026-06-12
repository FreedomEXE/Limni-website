/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: types.ts
 *
 * Description:
 * Shared app-truth contracts for route readiness, domain readiness,
 * baseline visibility, namespace comparison, and legacy path reporting.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type AppTruthStatus =
  | "ready"
  | "degraded"
  | "blocked"
  | "missing_contract"
  | "unknown";

export type AppTruthRouteId =
  | "data"
  | "performance"
  | "status"
  | "accounts"
  | "automation"
  | "research"
  | "documents"
  | "agents"
  | "news";

export type AppTruthDomainId =
  | "data"
  | "performance"
  | "status"
  | "accounts"
  | "automation"
  | "research"
  | "documents"
  | "agents"
  | "news"
  | "scheduler";

export type AppTruthRequirementStatus =
  | "present"
  | "partial"
  | "missing"
  | "not_implemented"
  | "not_required";

export type AppTruthRequirementSnapshot = {
  id: string;
  label: string;
  status: AppTruthRequirementStatus;
  detail: string;
};

export type RouteTruthContract = {
  route: AppTruthRouteId;
  label: string;
  requiredRecords: string[];
  allowedDegradedRecords: string[];
};

export type NamespaceComparison = {
  namespace: string;
  expected: string | null;
  actual: string | null;
  status: "match" | "mismatch" | "missing" | "not_implemented";
  detail: string;
};

export type ActiveBaselineApprovalStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "blocked";

export type ActiveBaselineCoverageStatus =
  | "match"
  | "partial"
  | "missing"
  | "not_checked";

export type ActiveBaselineCoverageSnapshot = {
  status: ActiveBaselineCoverageStatus;
  expectedWeekCount: number;
  matchedWeekCount: number;
  missingWeeks: string[];
  extraWeeks: string[];
  detail: string;
};

export type ActiveBaselineManifest = {
  baselineId: string;
  activeWeeks: string[];
  sourceNamespace: string;
  sourceReleaseWindow: string;
  performanceNamespace: string;
  performanceHistoryWindow: string;
  engineNamespace: string;
  executionLedgerNamespace: string;
  generatedAtUtc: string;
  approvalStatus: ActiveBaselineApprovalStatus;
  archiveAvailable: boolean;
};

export type ActiveBaselineSnapshot = {
  id: string;
  status: AppTruthStatus;
  source: "formal_manifest" | "static_contract" | "inferred" | "missing_contract";
  approvalStatus: ActiveBaselineApprovalStatus;
  activeWeeks: string[];
  sourceNamespace: string | null;
  sourceReleaseWindow: string | null;
  performanceNamespace: string | null;
  performanceHistoryWindow: string | null;
  engineNamespace: string | null;
  executionLedgerNamespace: string | null;
  closedWeekCount: number;
  currentWeekOpenUtc: string | null;
  latestClosedWeekOpenUtc: string | null;
  archiveMode: "separate" | "not_implemented" | "unknown";
  archiveAvailable: boolean;
  sourceLedgerCoverage: ActiveBaselineCoverageSnapshot;
  performanceCoverage: ActiveBaselineCoverageSnapshot;
  blockers: string[];
};

export type WeeklyLifecycleSnapshot = {
  status: AppTruthStatus;
  currentWeekOpenUtc: string | null;
  latestClosedWeekOpenUtc: string | null;
  ledgerState: "visible" | "partial" | "missing_contract";
  closedExpectedWeekCount: number;
  evidenceReadyWeekCount: number;
  receiptReadyWeekCount: number;
  closedReadyWeekCount: number;
  currentWeekState: WeeklyLifecycleWeekState | null;
  weekStates: WeeklyLifecycleWeekState[];
  extraPerformanceWeeks: string[];
  detail: string;
};

export type WeeklyLifecycleWeekRole =
  | "closed_active"
  | "current_open"
  | "archive_extra";

export type WeeklyLifecycleState =
  | "closed_ready"
  | "materialization_receipts_missing"
  | "source_ready_kernel_missing"
  | "source_missing_kernel_ready"
  | "closed_missing"
  | "current_live_overlay"
  | "archive_or_stale_kernel_extra";

export type WeeklyLifecycleReceiptStatus =
  | "present"
  | "missing"
  | "degraded";

export type WeeklyLifecycleReceiptState = {
  label: string;
  status: WeeklyLifecycleReceiptStatus;
  runId: string | null;
  completedAtUtc: string | null;
  detail: string;
};

export type WeeklyLifecycleWeekState = {
  weekOpenUtc: string;
  role: WeeklyLifecycleWeekRole;
  state: WeeklyLifecycleState;
  sourceReady: boolean;
  performanceReady: boolean;
  evidenceReady: boolean;
  receiptReady: boolean;
  sourceFreezeReceipt: WeeklyLifecycleReceiptState;
  dataMaterializationReceipt: WeeklyLifecycleReceiptState;
  performanceMaterializationReceipt: WeeklyLifecycleReceiptState;
  freezeTargetUtc: string | null;
  sourceHash: string | null;
  detail: string;
};

export type DomainReadinessSnapshot = {
  domain: AppTruthDomainId;
  label: string;
  status: AppTruthStatus;
  requirements: AppTruthRequirementSnapshot[];
  namespaceComparisons: NamespaceComparison[];
  blockers: string[];
  degradedReasons: string[];
};

export type RouteTruthSnapshot = {
  route: AppTruthRouteId;
  label: string;
  path: string;
  status: AppTruthStatus;
  contract: RouteTruthContract;
  requirements: AppTruthRequirementSnapshot[];
  blockers: string[];
  degradedReasons: string[];
};

export type LegacyPathUsage = {
  id: string;
  label: string;
  category: "fetch" | "cache" | "preload" | "fallback" | "scheduler" | "ui";
  status: "known_legacy" | "quarantined" | "temporarily_allowed" | "not_instrumented";
  replacementOwner: AppTruthDomainId;
  currentSurface: string;
  risk: string;
  observedInCurrentSession: "yes" | "no" | "unknown" | "not_instrumented";
  deletionGate: string;
};

export type ScheduledCronStatus = "scheduled" | "manual_only";

export type ScheduledCronSourceClass =
  | "source_collection"
  | "source_materialization"
  | "price_materialization"
  | "strategy_materialization"
  | "baseline_certification"
  | "runtime_automation"
  | "manual_import"
  | "one_shot_backfill";

export type ScheduledCronRegisterEntry = {
  id: string;
  label: string;
  path: string;
  schedules: string[];
  status: ScheduledCronStatus;
  owner: AppTruthDomainId;
  sourceClass: ScheduledCronSourceClass;
  currentRole: string;
  whyNeeded: string;
  risk: string;
  nextGate: string;
};

export type SchedulerRunStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "degraded"
  | "skipped";

export type SchedulerRunTriggerType =
  | "schedule"
  | "manual"
  | "dependency-ready"
  | "retry"
  | "backfill";

export type SchedulerRunLedgerRecord = {
  runId: string;
  jobId: string;
  jobType: string;
  triggerType: SchedulerRunTriggerType;
  routePath: string;
  schedule: string | null;
  scheduledAtUtc: string | null;
  startedAtUtc: string;
  completedAtUtc: string | null;
  inputArtifacts: string[];
  requiredInputs: string[];
  missingInputs: string[];
  outputArtifacts: string[];
  namespaceProduced: string | null;
  status: SchedulerRunStatus;
  retryPolicy: string | null;
  backfillStatus: string | null;
  degradedReasons: string[];
  errorMessage: string | null;
  metadata: Record<string, unknown>;
};

export type MaterializationRunLedgerRecord = {
  runId: string;
  schedulerRunId: string | null;
  materializationType: string;
  domain: AppTruthDomainId;
  baselineId: string | null;
  weekWindow: string[];
  rowsTouched: number | null;
  inputArtifacts: string[];
  outputArtifacts: string[];
  namespaceProduced: string | null;
  status: SchedulerRunStatus;
  missingInputs: string[];
  degradedReasons: string[];
  evidenceHash: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  startedAtUtc: string;
  completedAtUtc: string;
};

export type SchedulerMaterializationSnapshot = {
  status: AppTruthStatus;
  latestRunId: string | null;
  detail: string;
  requiredContract: string;
  schedulerRunCount: number;
  materializationRunCount: number;
  latestSchedulerRun: SchedulerRunLedgerRecord | null;
  latestMaterializationRun: MaterializationRunLedgerRecord | null;
  schedulerRuns: SchedulerRunLedgerRecord[];
  materializationRuns: MaterializationRunLedgerRecord[];
  ledgerReadError: string | null;
};

export type AppTruthReleaseSnapshot = {
  liveReleaseId: string;
  devReleaseId: string;
  cacheNamespace: string;
  canonVersion: string;
  engineVersion: string;
  preparedAt: string;
  releasedAt: string | null;
};

export type AppTruthStatusProjection = {
  generatedAtUtc: string;
  release: AppTruthReleaseSnapshot;
  activeBaseline: ActiveBaselineSnapshot;
  weeklyLifecycle: WeeklyLifecycleSnapshot;
  domains: DomainReadinessSnapshot[];
  routes: RouteTruthSnapshot[];
  legacyPaths: LegacyPathUsage[];
  scheduledCrons: ScheduledCronRegisterEntry[];
  schedulerMaterialization: SchedulerMaterializationSnapshot;
};

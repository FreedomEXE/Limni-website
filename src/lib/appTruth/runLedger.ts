/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: runLedger.ts
 *
 * Description:
 * Durable app-truth run receipts for scheduled jobs and materialization
 * producers. These receipts make cron output inspectable by Status without
 * changing cron cadence or page truth ownership.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { randomUUID } from "node:crypto";

import { query, queryOne } from "@/lib/db";
import { dbTimestampValueToIsoUtc } from "@/lib/dbUtcTimestamp";
import type {
  AppTruthDomainId,
  MaterializationRunLedgerRecord,
  SchedulerRunLedgerRecord,
  SchedulerRunStatus,
  SchedulerRunTriggerType,
} from "@/lib/appTruth/types";

let ensureRunLedgerSchemaPromise: Promise<void> | null = null;

type SchedulerRunDbRow = {
  run_id: string;
  job_id: string;
  job_type: string;
  trigger_type: SchedulerRunTriggerType;
  route_path: string;
  schedule: string | null;
  scheduled_at_utc: Date | string | null;
  started_at_utc: Date | string;
  completed_at_utc: Date | string | null;
  input_artifacts: unknown;
  required_inputs: unknown;
  missing_inputs: unknown;
  output_artifacts: unknown;
  namespace_produced: string | null;
  status: SchedulerRunStatus;
  retry_policy: string | null;
  backfill_status: string | null;
  degraded_reasons: unknown;
  error_message: string | null;
  metadata: unknown;
};

type MaterializationRunDbRow = {
  run_id: string;
  scheduler_run_id: string | null;
  materialization_type: string;
  domain: AppTruthDomainId;
  baseline_id: string | null;
  week_window: unknown;
  rows_touched: number | string | null;
  input_artifacts: unknown;
  output_artifacts: unknown;
  namespace_produced: string | null;
  status: SchedulerRunStatus;
  missing_inputs: unknown;
  degraded_reasons: unknown;
  evidence_hash: string | null;
  error_message: string | null;
  metadata: unknown;
  started_at_utc: Date | string;
  completed_at_utc: Date | string;
};

export type StartSchedulerRunReceiptInput = {
  runId?: string;
  jobId: string;
  jobType: string;
  triggerType: SchedulerRunTriggerType;
  routePath: string;
  schedule?: string | null;
  scheduledAtUtc?: string | null;
  startedAtUtc?: string;
  inputArtifacts?: string[];
  requiredInputs?: string[];
  missingInputs?: string[];
  retryPolicy?: string | null;
  backfillStatus?: string | null;
  metadata?: Record<string, unknown>;
};

export type FinishSchedulerRunReceiptInput = {
  runId: string;
  completedAtUtc?: string;
  outputArtifacts?: string[];
  missingInputs?: string[];
  namespaceProduced?: string | null;
  status: SchedulerRunStatus;
  retryPolicy?: string | null;
  backfillStatus?: string | null;
  degradedReasons?: string[];
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export type MaterializationRunReceiptInput = {
  runId?: string;
  schedulerRunId?: string | null;
  materializationType: string;
  domain: AppTruthDomainId;
  baselineId?: string | null;
  weekWindow?: string[];
  rowsTouched?: number | null;
  inputArtifacts?: string[];
  outputArtifacts?: string[];
  namespaceProduced?: string | null;
  status: SchedulerRunStatus;
  missingInputs?: string[];
  degradedReasons?: string[];
  evidenceHash?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  startedAtUtc?: string;
  completedAtUtc?: string;
};

export type AppTruthRunLedgerSnapshot = {
  schedulerRuns: SchedulerRunLedgerRecord[];
  materializationRuns: MaterializationRunLedgerRecord[];
};

export type ReadMaterializationRunReceiptsForBaselineInput = {
  baselineId: string;
  materializationTypes?: string[];
  limit?: number;
};

export type ReadMaterializationRunReceiptsForBaselineIdsInput = {
  baselineIds: string[];
  materializationTypes?: string[];
  limit?: number;
};

function nowIso() {
  return new Date().toISOString();
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return dbTimestampValueToIsoUtc(value);
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      return normalizeStringArray(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      return normalizeMetadata(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeRowsTouched(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSchedulerRun(row: SchedulerRunDbRow): SchedulerRunLedgerRecord {
  return {
    runId: row.run_id,
    jobId: row.job_id,
    jobType: row.job_type,
    triggerType: row.trigger_type,
    routePath: row.route_path,
    schedule: row.schedule,
    scheduledAtUtc: toIso(row.scheduled_at_utc),
    startedAtUtc: toIso(row.started_at_utc) ?? nowIso(),
    completedAtUtc: toIso(row.completed_at_utc),
    inputArtifacts: normalizeStringArray(row.input_artifacts),
    requiredInputs: normalizeStringArray(row.required_inputs),
    missingInputs: normalizeStringArray(row.missing_inputs),
    outputArtifacts: normalizeStringArray(row.output_artifacts),
    namespaceProduced: row.namespace_produced,
    status: row.status,
    retryPolicy: row.retry_policy,
    backfillStatus: row.backfill_status,
    degradedReasons: normalizeStringArray(row.degraded_reasons),
    errorMessage: row.error_message,
    metadata: normalizeMetadata(row.metadata),
  };
}

function mapMaterializationRun(row: MaterializationRunDbRow): MaterializationRunLedgerRecord {
  return {
    runId: row.run_id,
    schedulerRunId: row.scheduler_run_id,
    materializationType: row.materialization_type,
    domain: row.domain,
    baselineId: row.baseline_id,
    weekWindow: normalizeStringArray(row.week_window),
    rowsTouched: normalizeRowsTouched(row.rows_touched),
    inputArtifacts: normalizeStringArray(row.input_artifacts),
    outputArtifacts: normalizeStringArray(row.output_artifacts),
    namespaceProduced: row.namespace_produced,
    status: row.status,
    missingInputs: normalizeStringArray(row.missing_inputs),
    degradedReasons: normalizeStringArray(row.degraded_reasons),
    evidenceHash: row.evidence_hash,
    errorMessage: row.error_message,
    metadata: normalizeMetadata(row.metadata),
    startedAtUtc: toIso(row.started_at_utc) ?? nowIso(),
    completedAtUtc: toIso(row.completed_at_utc) ?? nowIso(),
  };
}

export function createAppTruthRunId(jobId: string, startedAtUtc = nowIso()) {
  const safeJobId = jobId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const safeTimestamp = startedAtUtc.replace(/[^0-9]/g, "").slice(0, 14);
  return `${safeJobId || "job"}-${safeTimestamp}-${randomUUID().slice(0, 8)}`;
}

export async function ensureAppTruthRunLedgerSchema(): Promise<void> {
  ensureRunLedgerSchemaPromise ??= (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS app_truth_scheduler_run_ledger (
        run_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        job_type TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        route_path TEXT NOT NULL,
        schedule TEXT,
        scheduled_at_utc TIMESTAMPTZ,
        started_at_utc TIMESTAMPTZ NOT NULL,
        completed_at_utc TIMESTAMPTZ,
        input_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
        required_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
        missing_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
        output_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
        namespace_produced TEXT,
        status TEXT NOT NULL,
        retry_policy TEXT,
        backfill_status TEXT,
        degraded_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
        error_message TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_app_truth_scheduler_run_ledger_started
        ON app_truth_scheduler_run_ledger (started_at_utc DESC)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_app_truth_scheduler_run_ledger_job
        ON app_truth_scheduler_run_ledger (job_id, started_at_utc DESC)
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS app_truth_materialization_run_ledger (
        run_id TEXT PRIMARY KEY,
        scheduler_run_id TEXT,
        materialization_type TEXT NOT NULL,
        domain TEXT NOT NULL,
        baseline_id TEXT,
        week_window JSONB NOT NULL DEFAULT '[]'::jsonb,
        rows_touched INTEGER,
        input_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
        output_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
        namespace_produced TEXT,
        status TEXT NOT NULL,
        missing_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
        degraded_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
        evidence_hash TEXT,
        error_message TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        started_at_utc TIMESTAMPTZ NOT NULL,
        completed_at_utc TIMESTAMPTZ NOT NULL,
        created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_app_truth_materialization_run_ledger_completed
        ON app_truth_materialization_run_ledger (completed_at_utc DESC)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_app_truth_materialization_run_ledger_type
        ON app_truth_materialization_run_ledger (materialization_type, completed_at_utc DESC)
    `);
  })().catch((error) => {
    ensureRunLedgerSchemaPromise = null;
    throw error;
  });

  return ensureRunLedgerSchemaPromise;
}

export async function startSchedulerRunReceipt(
  input: StartSchedulerRunReceiptInput,
): Promise<SchedulerRunLedgerRecord> {
  await ensureAppTruthRunLedgerSchema();
  const startedAtUtc = input.startedAtUtc ?? nowIso();
  const runId = input.runId ?? createAppTruthRunId(input.jobId, startedAtUtc);
  const row = await queryOne<SchedulerRunDbRow>(
    `INSERT INTO app_truth_scheduler_run_ledger (
       run_id,
       job_id,
       job_type,
       trigger_type,
       route_path,
       schedule,
       scheduled_at_utc,
       started_at_utc,
       input_artifacts,
       required_inputs,
       missing_inputs,
       status,
       retry_policy,
       backfill_status,
       metadata,
       updated_at_utc
     )
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       $7::timestamptz,
       $8::timestamptz,
       $9::jsonb,
       $10::jsonb,
       $11::jsonb,
       'running',
       $12,
       $13,
       $14::jsonb,
       NOW()
     )
     ON CONFLICT (run_id)
     DO UPDATE SET
       status = 'running',
       started_at_utc = EXCLUDED.started_at_utc,
       input_artifacts = EXCLUDED.input_artifacts,
       required_inputs = EXCLUDED.required_inputs,
       missing_inputs = EXCLUDED.missing_inputs,
       metadata = EXCLUDED.metadata,
       updated_at_utc = NOW()
     RETURNING *`,
    [
      runId,
      input.jobId,
      input.jobType,
      input.triggerType,
      input.routePath,
      input.schedule ?? null,
      input.scheduledAtUtc ?? null,
      startedAtUtc,
      JSON.stringify(input.inputArtifacts ?? []),
      JSON.stringify(input.requiredInputs ?? []),
      JSON.stringify(input.missingInputs ?? []),
      input.retryPolicy ?? null,
      input.backfillStatus ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  if (!row) {
    throw new Error("Scheduler run receipt insert did not return a row.");
  }
  return mapSchedulerRun(row);
}

export async function finishSchedulerRunReceipt(
  input: FinishSchedulerRunReceiptInput,
): Promise<SchedulerRunLedgerRecord> {
  await ensureAppTruthRunLedgerSchema();
  const row = await queryOne<SchedulerRunDbRow>(
    `UPDATE app_truth_scheduler_run_ledger
        SET completed_at_utc = $2::timestamptz,
            output_artifacts = $3::jsonb,
            missing_inputs = $4::jsonb,
            namespace_produced = $5,
            status = $6,
            retry_policy = COALESCE($7, retry_policy),
            backfill_status = COALESCE($8, backfill_status),
            degraded_reasons = $9::jsonb,
            error_message = $10,
            metadata = metadata || $11::jsonb,
            updated_at_utc = NOW()
      WHERE run_id = $1
      RETURNING *`,
    [
      input.runId,
      input.completedAtUtc ?? nowIso(),
      JSON.stringify(input.outputArtifacts ?? []),
      JSON.stringify(input.missingInputs ?? []),
      input.namespaceProduced ?? null,
      input.status,
      input.retryPolicy ?? null,
      input.backfillStatus ?? null,
      JSON.stringify(input.degradedReasons ?? []),
      input.errorMessage ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  if (!row) {
    throw new Error(`Scheduler run receipt not found for ${input.runId}.`);
  }
  return mapSchedulerRun(row);
}

export async function recordMaterializationRunReceipt(
  input: MaterializationRunReceiptInput,
): Promise<MaterializationRunLedgerRecord> {
  await ensureAppTruthRunLedgerSchema();
  const startedAtUtc = input.startedAtUtc ?? nowIso();
  const completedAtUtc = input.completedAtUtc ?? nowIso();
  const runId = input.runId ?? createAppTruthRunId(input.materializationType, startedAtUtc);
  const row = await queryOne<MaterializationRunDbRow>(
    `INSERT INTO app_truth_materialization_run_ledger (
       run_id,
       scheduler_run_id,
       materialization_type,
       domain,
       baseline_id,
       week_window,
       rows_touched,
       input_artifacts,
       output_artifacts,
       namespace_produced,
       status,
       missing_inputs,
       degraded_reasons,
       evidence_hash,
       error_message,
       metadata,
       started_at_utc,
       completed_at_utc
     )
     VALUES (
       $1,
       $2,
       $3,
       $4,
       $5,
       $6::jsonb,
       $7,
       $8::jsonb,
       $9::jsonb,
       $10,
       $11,
       $12::jsonb,
       $13::jsonb,
       $14,
       $15,
       $16::jsonb,
       $17::timestamptz,
       $18::timestamptz
     )
     ON CONFLICT (run_id)
     DO UPDATE SET
       scheduler_run_id = EXCLUDED.scheduler_run_id,
       materialization_type = EXCLUDED.materialization_type,
       domain = EXCLUDED.domain,
       baseline_id = EXCLUDED.baseline_id,
       week_window = EXCLUDED.week_window,
       rows_touched = EXCLUDED.rows_touched,
       input_artifacts = EXCLUDED.input_artifacts,
       output_artifacts = EXCLUDED.output_artifacts,
       namespace_produced = EXCLUDED.namespace_produced,
       status = EXCLUDED.status,
       missing_inputs = EXCLUDED.missing_inputs,
       degraded_reasons = EXCLUDED.degraded_reasons,
       evidence_hash = EXCLUDED.evidence_hash,
       error_message = EXCLUDED.error_message,
       metadata = EXCLUDED.metadata,
       started_at_utc = EXCLUDED.started_at_utc,
       completed_at_utc = EXCLUDED.completed_at_utc
     RETURNING *`,
    [
      runId,
      input.schedulerRunId ?? null,
      input.materializationType,
      input.domain,
      input.baselineId ?? null,
      JSON.stringify(input.weekWindow ?? []),
      input.rowsTouched ?? null,
      JSON.stringify(input.inputArtifacts ?? []),
      JSON.stringify(input.outputArtifacts ?? []),
      input.namespaceProduced ?? null,
      input.status,
      JSON.stringify(input.missingInputs ?? []),
      JSON.stringify(input.degradedReasons ?? []),
      input.evidenceHash ?? null,
      input.errorMessage ?? null,
      JSON.stringify(input.metadata ?? {}),
      startedAtUtc,
      completedAtUtc,
    ],
  );

  if (!row) {
    throw new Error("Materialization run receipt insert did not return a row.");
  }
  return mapMaterializationRun(row);
}

export async function readAppTruthRunLedgerSnapshot(limit = 8): Promise<AppTruthRunLedgerSnapshot> {
  await ensureAppTruthRunLedgerSchema();
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const [schedulerRows, materializationRows] = await Promise.all([
    query<SchedulerRunDbRow>(
      `SELECT *
         FROM app_truth_scheduler_run_ledger
        ORDER BY started_at_utc DESC
        LIMIT $1`,
      [safeLimit],
    ),
    query<MaterializationRunDbRow>(
      `SELECT *
         FROM app_truth_materialization_run_ledger
        ORDER BY completed_at_utc DESC
        LIMIT $1`,
      [safeLimit],
    ),
  ]);

  return {
    schedulerRuns: schedulerRows.map(mapSchedulerRun),
    materializationRuns: materializationRows.map(mapMaterializationRun),
  };
}

export async function readMaterializationRunReceiptsForBaseline(
  input: ReadMaterializationRunReceiptsForBaselineInput,
): Promise<MaterializationRunLedgerRecord[]> {
  return readMaterializationRunReceiptsForBaselineIds({
    baselineIds: [input.baselineId],
    materializationTypes: input.materializationTypes,
    limit: input.limit,
  });
}

export async function readMaterializationRunReceiptsForBaselineIds(
  input: ReadMaterializationRunReceiptsForBaselineIdsInput,
): Promise<MaterializationRunLedgerRecord[]> {
  await ensureAppTruthRunLedgerSchema();
  const materializationTypes = Array.from(
    new Set((input.materializationTypes ?? []).filter(Boolean)),
  );
  const baselineIds = Array.from(new Set(input.baselineIds.filter(Boolean)));
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(input.limit ?? 300)));
  if (baselineIds.length === 0) return [];

  const rows = materializationTypes.length > 0
    ? await query<MaterializationRunDbRow>(
      `SELECT *
         FROM app_truth_materialization_run_ledger
        WHERE baseline_id = ANY($1::text[])
          AND materialization_type = ANY($2::text[])
        ORDER BY completed_at_utc DESC
        LIMIT $3`,
      [baselineIds, materializationTypes, safeLimit],
    )
    : await query<MaterializationRunDbRow>(
      `SELECT *
         FROM app_truth_materialization_run_ledger
        WHERE baseline_id = ANY($1::text[])
        ORDER BY completed_at_utc DESC
        LIMIT $2`,
      [baselineIds, safeLimit],
    );

  return rows.map(mapMaterializationRun);
}

import { createHash } from "node:crypto";

import { DateTime } from "luxon";

import { buildActiveBaselineManifest } from "@/lib/appTruth/activeBaseline";
import {
  finishSchedulerRunReceipt,
  recordMaterializationRunReceipt,
  startSchedulerRunReceipt,
} from "@/lib/appTruth/runLedger";
import type { SchedulerRunTriggerType } from "@/lib/appTruth/types";
import { CANONICAL_INSTRUMENTS } from "@/lib/canonicalInstruments";
import { query } from "@/lib/db";
import { EXECUTION_ANCHOR_VERSION } from "@/lib/executionPriceWindows";
import {
  getExpectedStrategyArtifactEngineVersion,
} from "@/lib/performance/strategyArtifactReadiness";
import {
  buildStrategySelectionKey,
  listVisibleStrategyBootstrapSelections,
} from "@/lib/performance/strategySelection";
import { CANONICAL_ANCHOR_VERSION } from "@/lib/pairReturns";
import { releaseManifest } from "@/lib/version/releaseManifest";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

type CertificationResult = {
  materializationType: "source_freeze_ledger" | "canonical_price_and_weekly_returns" | "strategy_week_shards";
  ok: boolean;
  expectedRows: number;
  actualRows: number;
  extraRows: number;
  missingInputs: string[];
  outputArtifacts: string[];
};

type PairReturnRow = {
  symbol: string;
  asset_class: string;
  period_open_utc: string;
  anchor_type: "canonical" | "execution";
  anchor_version: string;
};

type WeekShardRow = {
  selection_key: string;
  engine_version: string;
  week_open_utc: string;
};

type SourceFreezeWeekRow = {
  week_open_utc: string;
  complete: boolean;
  trusted_for_freeze: boolean;
};

export type ActiveBaselineCertificationPayload = {
  schema: "app-truth-active-baseline-certification-v1";
  ok: boolean;
  baselineId: string;
  weeks: string[];
  schedulerRunId: string;
  evidenceHash: string;
  results: CertificationResult[];
};

type CertifyActiveBaselineOptions = {
  triggerType?: SchedulerRunTriggerType;
  routePath?: string;
  schedule?: string | null;
};

function normalizeWeek(weekOpenUtc: string) {
  const direct = normalizeWeekOpenUtc(weekOpenUtc);
  if (direct) return direct;

  const sqlTimestamp = DateTime.fromSQL(weekOpenUtc, { zone: "utc" });
  if (sqlTimestamp.isValid) {
    return normalizeWeekOpenUtc(sqlTimestamp.toUTC().toISO() ?? weekOpenUtc) ?? weekOpenUtc;
  }

  const sqlTimestampWithOffset = DateTime.fromSQL(weekOpenUtc.replace(/([+-]\d{2})$/, "$1:00"), {
    setZone: true,
  });
  if (sqlTimestampWithOffset.isValid) {
    return normalizeWeekOpenUtc(sqlTimestampWithOffset.toUTC().toISO() ?? weekOpenUtc) ?? weekOpenUtc;
  }

  return weekOpenUtc;
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function certifySourceFreeze(weeks: string[]): Promise<CertificationResult> {
  const rows = await query<SourceFreezeWeekRow>(
    `SELECT week_open_utc::text AS week_open_utc,
            complete,
            trusted_for_freeze
       FROM source_freeze_ledger_weeks
      WHERE week_open_utc = ANY($1::timestamptz[])`,
    [weeks],
  );
  const readyWeeks = new Set(
    rows
      .filter((row) => row.complete && row.trusted_for_freeze)
      .map((row) => normalizeWeek(row.week_open_utc)),
  );
  const matchedWeeks = weeks.filter((week) => readyWeeks.has(normalizeWeek(week)));
  const missingInputs = weeks
    .filter((week) => !readyWeeks.has(normalizeWeek(week)))
    .map((week) => `source_freeze_ledger:${week}`);

  return {
    materializationType: "source_freeze_ledger",
    ok: missingInputs.length === 0,
    expectedRows: weeks.length,
    actualRows: matchedWeeks.length,
    extraRows: 0,
    missingInputs,
    outputArtifacts: [
      `source_freeze_ledger_weeks:${matchedWeeks.length}`,
      "source_freeze_ledger_contract:trusted-week-ledger",
    ],
  };
}

async function certifyCanonicalReturns(weeks: string[]): Promise<CertificationResult> {
  const instruments = CANONICAL_INSTRUMENTS.filter((instrument) => instrument.isActive);
  const rows = await query<PairReturnRow>(
    `SELECT symbol,
            asset_class,
            period_open_utc::text AS period_open_utc,
            anchor_type,
            anchor_version
       FROM pair_period_returns
      WHERE period_type = 'weekly'
        AND period_open_utc = ANY($1::timestamptz[])
        AND (
          (anchor_type = 'canonical' AND anchor_version = $2)
          OR
          (anchor_type = 'execution' AND anchor_version = $3)
        )`,
    [weeks, CANONICAL_ANCHOR_VERSION, EXECUTION_ANCHOR_VERSION],
  );
  const actual = new Set(rows.map((row) => [
    normalizeWeek(row.period_open_utc),
    row.anchor_type,
    row.anchor_version,
    row.asset_class,
    row.symbol.toUpperCase(),
  ].join(":")));
  const expected: string[] = [];
  for (const week of weeks) {
    for (const instrument of instruments) {
      expected.push([
        normalizeWeek(week),
        "canonical",
        CANONICAL_ANCHOR_VERSION,
        instrument.assetClass,
        instrument.symbol.toUpperCase(),
      ].join(":"));
      expected.push([
        normalizeWeek(week),
        "execution",
        EXECUTION_ANCHOR_VERSION,
        instrument.assetClass,
        instrument.symbol.toUpperCase(),
      ].join(":"));
    }
  }
  const expectedSet = new Set(expected);
  const missingInputs = expected
    .filter((key) => !actual.has(key))
    .map((key) => `pair_period_returns:${key}`);
  const matchedRows = expected.filter((key) => actual.has(key)).length;
  const extraRows = Array.from(actual).filter((key) => !expectedSet.has(key)).length;

  return {
    materializationType: "canonical_price_and_weekly_returns",
    ok: missingInputs.length === 0,
    expectedRows: expected.length,
    actualRows: matchedRows,
    extraRows,
    missingInputs,
    outputArtifacts: [
      `pair_period_returns:${matchedRows}`,
      `canonical_anchor:${CANONICAL_ANCHOR_VERSION}`,
      `execution_anchor:${EXECUTION_ANCHOR_VERSION}`,
    ],
  };
}

async function certifyStrategyWeekShards(weeks: string[]): Promise<CertificationResult> {
  const selections = listVisibleStrategyBootstrapSelections();
  const expectedSelectionKeys = selections.map((selection) => ({
    selectionKey: buildStrategySelectionKey(selection),
    engineVersion: getExpectedStrategyArtifactEngineVersion(selection),
  }));
  const selectionKeys = Array.from(new Set(expectedSelectionKeys.map((selection) => selection.selectionKey)));
  const engineVersions = Array.from(new Set(expectedSelectionKeys.map((selection) => selection.engineVersion)));
  const rows = await query<WeekShardRow>(
    `SELECT selection_key,
            engine_version,
            week_open_utc::text AS week_open_utc
       FROM strategy_week_shards
      WHERE week_open_utc = ANY($1::timestamptz[])
        AND selection_key = ANY($2::text[])
        AND engine_version = ANY($3::text[])`,
    [weeks, selectionKeys, engineVersions],
  );
  const actual = new Set(rows.map((row) => [
    row.selection_key,
    row.engine_version,
    normalizeWeek(row.week_open_utc),
  ].join(":")));
  const expected = weeks.flatMap((week) => (
    expectedSelectionKeys.map(({ selectionKey, engineVersion }) => [
      selectionKey,
      engineVersion,
      normalizeWeek(week),
    ].join(":"))
  ));
  const expectedSet = new Set(expected);
  const missingInputs = expected
    .filter((key) => !actual.has(key))
    .map((key) => `strategy_week_shards:${key}`);
  const matchedRows = expected.filter((key) => actual.has(key)).length;
  const extraRows = Array.from(actual).filter((key) => !expectedSet.has(key)).length;

  return {
    materializationType: "strategy_week_shards",
    ok: missingInputs.length === 0,
    expectedRows: expected.length,
    actualRows: matchedRows,
    extraRows,
    missingInputs,
    outputArtifacts: [
      `strategy_week_shards:${matchedRows}`,
      `visible_selections:${expectedSelectionKeys.length}`,
    ],
  };
}

export async function certifyActiveBaseline(
  options: CertifyActiveBaselineOptions = {},
): Promise<ActiveBaselineCertificationPayload> {
  const startedAtUtc = new Date().toISOString();
  const baseline = buildActiveBaselineManifest({
    manifest: releaseManifest,
    generatedAtUtc: startedAtUtc,
  });
  const weeks = baseline.activeWeeks.map(normalizeWeek);
  const schedulerReceipt = await startSchedulerRunReceipt({
    jobId: "active-baseline-certification",
    jobType: "baseline_certification",
    triggerType: options.triggerType ?? "backfill",
    routePath: options.routePath ?? "app/scripts/app-truth-certify-active-baseline.ts",
    schedule: options.schedule ?? null,
    startedAtUtc,
    inputArtifacts: [
      "source_freeze_ledger_weeks",
      "pair_period_returns",
      "strategy_week_shards",
    ],
    requiredInputs: [
      "trusted source-freeze ledger weeks",
      "canonical and execution weekly returns",
      "visible strategy week shards",
    ],
    metadata: {
      baselineId: baseline.baselineId,
      sourceReleaseWindow: baseline.sourceReleaseWindow,
      performanceHistoryWindow: baseline.performanceHistoryWindow,
      weeks,
    },
  });

  const results = await Promise.all([
    certifySourceFreeze(weeks),
    certifyCanonicalReturns(weeks),
    certifyStrategyWeekShards(weeks),
  ]);
  const missingInputs = results.flatMap((result) => result.missingInputs);
  const ok = missingInputs.length === 0;
  const evidenceHash = stableHash({
    baseline: {
      ...baseline,
      generatedAtUtc: null,
    },
    results,
  });
  const completedAtUtc = new Date().toISOString();

  for (const result of results) {
    await recordMaterializationRunReceipt({
      schedulerRunId: schedulerReceipt.runId,
      materializationType: result.materializationType,
      domain: result.materializationType === "strategy_week_shards" ? "performance" : "data",
      baselineId: baseline.baselineId,
      weekWindow: weeks,
      rowsTouched: result.actualRows,
      inputArtifacts: result.materializationType === "source_freeze_ledger"
        ? ["source_freeze_ledger_weeks", "source_freeze_ledger_signals"]
        : result.materializationType === "canonical_price_and_weekly_returns"
          ? ["canonical_price_bars", "pair_period_returns"]
          : ["strategy_week_shards"],
      outputArtifacts: result.outputArtifacts,
      namespaceProduced: result.materializationType === "source_freeze_ledger"
        ? baseline.sourceNamespace
        : result.materializationType === "canonical_price_and_weekly_returns"
          ? baseline.executionLedgerNamespace
          : baseline.performanceNamespace,
      status: result.ok ? "succeeded" : "degraded",
      missingInputs: result.missingInputs,
      degradedReasons: result.missingInputs,
      evidenceHash,
      startedAtUtc,
      completedAtUtc,
      metadata: {
        certificationMode: "existing_materialization_audit",
        baselineId: baseline.baselineId,
        expectedRows: result.expectedRows,
        actualRows: result.actualRows,
      },
    });
  }

  await finishSchedulerRunReceipt({
    runId: schedulerReceipt.runId,
    completedAtUtc,
    outputArtifacts: results.flatMap((result) => result.outputArtifacts),
    missingInputs,
    namespaceProduced: baseline.baselineId,
    status: ok ? "succeeded" : "degraded",
    degradedReasons: missingInputs,
    metadata: {
      certificationMode: "existing_materialization_audit",
      baselineId: baseline.baselineId,
      evidenceHash,
      results,
    },
  });

  return {
    schema: "app-truth-active-baseline-certification-v1",
    ok,
    baselineId: baseline.baselineId,
    weeks,
    schedulerRunId: schedulerReceipt.runId,
    evidenceHash,
    results,
  };
}

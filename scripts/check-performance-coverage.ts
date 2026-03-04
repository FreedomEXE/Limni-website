/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: check-performance-coverage.ts
 *
 * Description:
 * Nightly coverage checker for performance/research data health.
 * Audits /api/performance/coverage and /api/research/strategies
 * and exits non-zero when required entries are missing or on fallback.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { GET as getPerformanceCoverage } from "../src/app/api/performance/coverage/route";
import { GET as getResearchStrategies } from "../src/app/api/research/strategies/route";

type CoverageTarget = {
  key?: string;
  label?: string;
  pipeline?: string;
  present?: boolean;
};

type KataraktiSnapshotSummary = {
  fallbackLabel?: string | null;
};

type PerformanceCoverageResponse = {
  status?: string;
  strategyBacktests?: {
    expectedTargets?: CoverageTarget[];
  };
  kataraktiSnapshots?: {
    core?: Record<string, KataraktiSnapshotSummary>;
    lite?: Record<string, KataraktiSnapshotSummary>;
    v3?: Record<string, KataraktiSnapshotSummary>;
  };
};

type StrategyEntry = {
  entryId?: string;
  label?: string;
  dataMode?: string;
  pending?: boolean;
  hasDbRun?: boolean;
};

type StrategiesResponse = {
  ok?: boolean;
  entries?: StrategyEntry[];
};

function annotateError(message: string) {
  console.error(`::error::${message}`);
}

function annotateWarning(message: string) {
  console.warn(`::warning::${message}`);
}

async function maybeSendWebhookAlert(issues: string[]) {
  const webhookUrl = process.env.PERFORMANCE_COVERAGE_ALERT_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.trim()) {
    return;
  }
  const body = {
    source: "nightly-performance-coverage",
    generatedUtc: new Date().toISOString(),
    issues,
  };
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      annotateWarning(`Coverage alert webhook returned HTTP ${response.status}.`);
    }
  } catch (error) {
    annotateWarning(
      `Coverage alert webhook failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function flattenFallbacks(
  snapshots: PerformanceCoverageResponse["kataraktiSnapshots"],
): string[] {
  if (!snapshots) return [];
  const out: string[] = [];
  const buckets: Array<[string, Record<string, KataraktiSnapshotSummary> | undefined]> = [
    ["core", snapshots.core],
    ["lite", snapshots.lite],
    ["v3", snapshots.v3],
  ];
  for (const [variant, rows] of buckets) {
    if (!rows) continue;
    for (const [market, summary] of Object.entries(rows)) {
      const fallbackLabel = summary.fallbackLabel?.trim() ?? "";
      if (!fallbackLabel) continue;
      out.push(`${variant}.${market}: ${fallbackLabel}`);
    }
  }
  return out;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for nightly coverage check.");
  }

  const [coverageResponse, strategiesResponse] = await Promise.all([
    getPerformanceCoverage(),
    getResearchStrategies(),
  ]);
  const coverage = (await coverageResponse.json()) as PerformanceCoverageResponse;
  const strategies = (await strategiesResponse.json()) as StrategiesResponse;

  const issues: string[] = [];

  if (coverage.status !== "ok") {
    issues.push("Performance coverage endpoint returned non-ok status.");
  }
  if (!strategies.ok) {
    issues.push("Research strategies endpoint returned non-ok status.");
  }

  const expectedTargets = coverage.strategyBacktests?.expectedTargets ?? [];
  const missingBacktestTargets = expectedTargets.filter(
    (target) => target.pipeline === "backtest_store" && !target.present,
  );
  for (const target of missingBacktestTargets) {
    issues.push(
      `Missing backtest_store target: ${target.key ?? target.label ?? "unknown_target"}`,
    );
  }

  const fallbackSnapshots = flattenFallbacks(coverage.kataraktiSnapshots);
  for (const fallback of fallbackSnapshots) {
    issues.push(`Fallback snapshot active: ${fallback}`);
  }

  const entries = strategies.entries ?? [];
  const requiredEntries = entries.filter((entry) => {
    const mode = entry.dataMode ?? "";
    const id = entry.entryId ?? "";
    if (entry.pending) return false;
    if (mode === "strategy_backtest_db") return true;
    if (id.startsWith("katarakti_lite_") || id.startsWith("katarakti_v3_")) return true;
    return false;
  });
  for (const entry of requiredEntries) {
    if (entry.hasDbRun) continue;
    issues.push(`Missing DB run for required strategy entry: ${entry.entryId ?? entry.label ?? "unknown_entry"}`);
  }

  if (issues.length > 0) {
    for (const issue of issues) {
      annotateError(issue);
    }
    await maybeSendWebhookAlert(issues);
    throw new Error(`Coverage check failed with ${issues.length} issue(s).`);
  }

  console.log("Coverage check passed: no missing targets/fallbacks detected.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  annotateError(message);
  process.exitCode = 1;
});

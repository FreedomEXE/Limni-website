/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: audit-performance-data-architecture.ts
 *
 * Description:
 * Phase 0 Performance data architecture audit. Pulls production
 * Performance payloads, validates week/shard integrity, checks scoped
 * all-time consistency, and flags semantically invalid ready artifacts.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

const DEFAULT_BASE_URL = "https://limni-website-nine.vercel.app";
const BASE_URL = (process.env.PRODUCTION_BASE_URL || process.env.PROD_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const REQUEST_DELAY_MS = Number(process.env.AUDIT_REQUEST_DELAY_MS ?? 750);

const STRATEGIES = ["tandem", "tiered_4w", "agree_3of4", "selector"] as const;
const EXECUTIONS = [
  { f1: "weekly_hold", overlays: ["none"] },
  { f1: "adr_grid", overlays: ["none", "pair_fill_cap"] },
] as const;
const ASSET_SCOPES = ["fx", "indices", "commodities", "crypto"] as const;

type Selection = {
  strategy: string;
  f1: string;
  f2: string;
  key: string;
};

type ArtifactStatusRow = {
  key: string;
  label: string;
  ready: boolean;
  expectedEngineVersion: string;
  actualEngineVersion?: string | null;
  reason: string;
  missingWeeks?: string[];
  staleWeeks?: string[];
  cachedAtUtc?: string | null;
};

type ArtifactStatusPayload = {
  readyCount: number;
  totalCount: number;
  artifacts: ArtifactStatusRow[];
};

type SimulationPoint = {
  ts_utc: string;
  equity_pct: number;
  drawdown_pct?: number | null;
};

type SimulationSeries = {
  id: string;
  label?: string;
  trades?: number;
  points?: SimulationPoint[];
};

type EngineSimulationGroup = {
  metrics?: {
    returnPct?: number | null;
    maxDrawdownPct?: number | null;
    trades?: number | null;
  };
  series?: SimulationSeries[];
};

type WeeklyTrade = {
  symbol: string;
  assetClass: string;
  returnPct: number;
};

type WeeklyResult = {
  weekOpenUtc: string;
  totalReturnPct: number;
  tradeCount: number;
  trades?: WeeklyTrade[];
  isRealized?: boolean;
};

type StrategyPayload = {
  engineWeekMap: Record<string, any> | null;
  engineSimMap: Record<string, EngineSimulationGroup> | null;
  engineWeekResults: Record<string, WeeklyResult> | null;
  weekOptions?: string[];
  artifactMeta?: {
    status?: string;
    selectionKey?: string;
    cachedAtUtc?: string | null;
    engineVersion?: string;
    missingWeeks?: string[];
    staleWeeks?: string[];
  };
  sidebarStats?: {
    allTime?: {
      totalReturnPct?: number;
      totalTrades?: number;
      maxDrawdownPct?: number;
      weeklyWinRate?: number;
    };
  } | null;
};

type WeekIssue = {
  selection: Selection;
  week: string;
  issue: string;
  detail: string;
};

type ScopeIssue = {
  selection: Selection;
  scope: string;
  issue: string;
  detail: string;
};

type EmptyOverlayIssue = {
  selection: Selection;
  week: string;
  baselineTrades: number;
  overlayTrades: number;
  baselineReturn: number;
  overlayReturn: number;
  engineVersion: string;
};

function selectionKey(strategy: string, f1: string, f2: string) {
  return `${strategy}:${f1}:${f2}`;
}

function buildSelections(): Selection[] {
  return STRATEGIES.flatMap((strategy) =>
    EXECUTIONS.flatMap((execution) =>
      execution.overlays.map((f2) => ({
        strategy,
        f1: execution.f1,
        f2,
        key: selectionKey(strategy, execution.f1, f2),
      })),
    ),
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null; raw: string }> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { accept: "application/json" },
    });
    const raw = await response.text();
    let data: T | null = null;
    try {
      data = raw ? JSON.parse(raw) as T : null;
    } catch {
      data = null;
    }
    return { ok: response.ok, status: response.status, data, raw };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      raw: error instanceof Error ? error.message : String(error),
    };
  }
}

function table(headers: string[], rows: string[][]) {
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => row[index]?.length ?? 0),
  ));
  const render = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ");
  console.log(render(headers));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) console.log(render(row));
}

function fmtNum(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

function fmtReturn(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function weekOptions(payload: StrategyPayload) {
  return (payload.weekOptions ?? []).filter((week) => week !== "all");
}

function weekResult(payload: StrategyPayload, week: string) {
  return payload.engineWeekResults?.[week] ?? null;
}

function simGroup(payload: StrategyPayload, week: string) {
  return payload.engineSimMap?.[week] ?? null;
}

function weekMap(payload: StrategyPayload, week: string) {
  return payload.engineWeekMap?.[week] ?? null;
}

function assetSeries(payload: StrategyPayload, scope: string) {
  return payload.engineSimMap?.all?.series?.find((series) => series.id === `asset:${scope}`) ?? null;
}

function seriesSummary(series: SimulationSeries | null) {
  const points = series?.points ?? [];
  const last = points.at(-1);
  const drawdowns = points
    .map((point) => point.drawdown_pct)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    trades: series?.trades ?? 0,
    points: points.length,
    returnPct: last?.equity_pct ?? null,
    maxDrawdownPct: drawdowns.length > 0 ? Math.abs(Math.min(...drawdowns)) : null,
  };
}

function scopedTradesFromWeeks(payload: StrategyPayload, scope: string) {
  return Object.values(payload.engineWeekResults ?? {})
    .filter((week) => week.isRealized !== false)
    .flatMap((week) => week.trades ?? [])
    .filter((trade) => trade.assetClass === scope);
}

function scopedReturnFromWeeks(payload: StrategyPayload, scope: string) {
  return scopedTradesFromWeeks(payload, scope)
    .reduce((sum, trade) => sum + (Number.isFinite(trade.returnPct) ? trade.returnPct : 0), 0);
}

function hasAllTimePerAsset(payload: StrategyPayload, scope: string) {
  const perAsset = payload.engineWeekMap?.all?.allTime?.perAsset;
  if (!perAsset || typeof perAsset !== "object") return false;
  return Object.prototype.hasOwnProperty.call(perAsset, scope);
}

function auditWeekIntegrity(selection: Selection, payload: StrategyPayload): WeekIssue[] {
  const issues: WeekIssue[] = [];
  for (const week of weekOptions(payload)) {
    const result = weekResult(payload, week);
    const sim = simGroup(payload, week);
    const map = weekMap(payload, week);
    if (!result) {
      issues.push({ selection, week, issue: "missing_week_result", detail: "weekOptions includes week but engineWeekResults has no entry" });
    }
    if (!sim) {
      issues.push({ selection, week, issue: "missing_sim_group", detail: "weekOptions includes week but engineSimMap has no entry" });
    }
    if (!map) {
      issues.push({ selection, week, issue: "missing_week_map", detail: "weekOptions includes week but engineWeekMap has no entry" });
    }
    if (result && sim) {
      const resultTrades = result.tradeCount ?? 0;
      const simTrades = sim.metrics?.trades ?? 0;
      if (resultTrades !== simTrades) {
        issues.push({
          selection,
          week,
          issue: "trade_count_mismatch",
          detail: `weekResult=${resultTrades}, sim=${simTrades}`,
        });
      }
      const totalSeries = sim.series?.find((series) => series.id === "equity" || series.id === "total") ?? null;
      const totalPoints = totalSeries?.points?.length ?? 0;
      if (resultTrades > 0 && totalPoints <= 1) {
        issues.push({
          selection,
          week,
          issue: "nonzero_trades_one_point_path",
          detail: `trades=${resultTrades}, totalSeriesPoints=${totalPoints}`,
        });
      }
    }
  }
  return issues;
}

function auditAssetScopes(selection: Selection, payload: StrategyPayload): ScopeIssue[] {
  const issues: ScopeIssue[] = [];
  for (const scope of ASSET_SCOPES) {
    const trades = scopedTradesFromWeeks(payload, scope);
    const weeklyReturn = scopedReturnFromWeeks(payload, scope);
    const summary = seriesSummary(assetSeries(payload, scope));
    const perAssetExists = hasAllTimePerAsset(payload, scope);

    if (trades.length > 0 && summary.trades === 0) {
      issues.push({
        selection,
        scope,
        issue: "missing_asset_sim_series_trades",
        detail: `weekTrades=${trades.length}, simSeriesTrades=${summary.trades}`,
      });
    }
    if (trades.length > 0 && summary.points <= 1) {
      issues.push({
        selection,
        scope,
        issue: "asset_series_one_point_path",
        detail: `weekTrades=${trades.length}, simSeriesPoints=${summary.points}`,
      });
    }
    if (trades.length > 0 && !perAssetExists) {
      issues.push({
        selection,
        scope,
        issue: "missing_all_time_per_asset_summary",
        detail: `weekTrades=${trades.length}, scopedReturn=${fmtReturn(weeklyReturn)}; Summary/Basket/Research need client aggregation`,
      });
    }
    if (
      trades.length > 0 &&
      typeof summary.returnPct === "number" &&
      Math.abs(summary.returnPct - weeklyReturn) > 0.25
    ) {
      issues.push({
        selection,
        scope,
        issue: "scope_return_gap",
        detail: `series=${fmtReturn(summary.returnPct)}, weeklyTrades=${fmtReturn(weeklyReturn)}`,
      });
    }
  }
  return issues;
}

function auditEmptyOverlayWeeks(
  selection: Selection,
  payload: StrategyPayload,
  baseline: StrategyPayload | undefined,
): EmptyOverlayIssue[] {
  if (selection.f2 !== "pair_fill_cap" || !baseline) return [];
  const issues: EmptyOverlayIssue[] = [];
  for (const week of weekOptions(payload)) {
    const overlayResult = weekResult(payload, week);
    const baselineResult = weekResult(baseline, week);
    if (!overlayResult || !baselineResult) continue;
    const overlayTrades = overlayResult.tradeCount ?? 0;
    const baselineTrades = baselineResult.tradeCount ?? 0;
    if (baselineTrades > 0 && overlayTrades === 0) {
      issues.push({
        selection,
        week,
        baselineTrades,
        overlayTrades,
        baselineReturn: baselineResult.totalReturnPct ?? 0,
        overlayReturn: overlayResult.totalReturnPct ?? 0,
        engineVersion: payload.artifactMeta?.engineVersion ?? "(missing)",
      });
    }
  }
  return issues;
}

async function loadPayload(selection: Selection) {
  const path =
    `/api/performance/strategy-page-data?strategy=${encodeURIComponent(selection.strategy)}` +
    `&f1=${encodeURIComponent(selection.f1)}` +
    `&f2=${encodeURIComponent(selection.f2)}` +
    "&scope=full";
  return getJson<StrategyPayload>(path);
}

async function main() {
  console.log("Performance Data Architecture Audit");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("");

  const selections = buildSelections();
  const statusResponse = await getJson<ArtifactStatusPayload>("/api/performance/strategy-artifacts/status");
  if (!statusResponse.ok || !statusResponse.data) {
    console.error(`Failed to load artifact status (${statusResponse.status})`);
    console.error(statusResponse.raw);
    process.exitCode = 1;
    return;
  }

  const status = statusResponse.data;
  console.log(`Artifact readiness: ${status.readyCount}/${status.totalCount}`);
  const notReady = status.artifacts.filter((artifact) => !artifact.ready);
  if (notReady.length > 0) {
    table(
      ["Selection", "Reason", "Missing", "Stale"],
      notReady.map((artifact) => [
        artifact.key,
        artifact.reason,
        String(artifact.missingWeeks?.length ?? 0),
        String(artifact.staleWeeks?.length ?? 0),
      ]),
    );
  }
  console.log("");

  const payloads = new Map<string, StrategyPayload>();
  const loadFailures: string[][] = [];
  for (const selection of selections) {
    const response = await loadPayload(selection);
    if (!response.ok || !response.data) {
      loadFailures.push([selection.key, String(response.status), response.raw.slice(0, 180)]);
    } else {
      payloads.set(selection.key, response.data);
    }
    await wait(REQUEST_DELAY_MS);
  }

  if (loadFailures.length > 0) {
    console.log("Payload Load Failures");
    table(["Selection", "Status", "Error"], loadFailures);
    console.log("");
  }

  const weekIssues = Array.from(payloads.entries()).flatMap(([key, payload]) => {
    const selection = selections.find((candidate) => candidate.key === key)!;
    return auditWeekIntegrity(selection, payload);
  });

  const scopeIssues = Array.from(payloads.entries()).flatMap(([key, payload]) => {
    const selection = selections.find((candidate) => candidate.key === key)!;
    return auditAssetScopes(selection, payload);
  });

  const emptyOverlayIssues = Array.from(payloads.entries()).flatMap(([key, payload]) => {
    const selection = selections.find((candidate) => candidate.key === key)!;
    const baselineKey = selectionKey(selection.strategy, selection.f1, "none");
    return auditEmptyOverlayWeeks(selection, payload, payloads.get(baselineKey));
  });

  console.log("Week Integrity Issues");
  if (weekIssues.length === 0) {
    console.log("None");
  } else {
    table(
      ["Selection", "Week", "Issue", "Detail"],
      weekIssues.map((issue) => [issue.selection.key, issue.week, issue.issue, issue.detail]),
    );
  }
  console.log("");

  console.log("Ready Overlay Empty-Week Issues");
  if (emptyOverlayIssues.length === 0) {
    console.log("None");
  } else {
    table(
      ["Selection", "Week", "Baseline", "Overlay", "Base Ret", "Overlay Ret", "Engine Version"],
      emptyOverlayIssues.map((issue) => [
        issue.selection.key,
        issue.week,
        String(issue.baselineTrades),
        String(issue.overlayTrades),
        fmtReturn(issue.baselineReturn),
        fmtReturn(issue.overlayReturn),
        issue.engineVersion,
      ]),
    );
  }
  console.log("");

  console.log("Scoped All-Time Issues");
  if (scopeIssues.length === 0) {
    console.log("None");
  } else {
    table(
      ["Selection", "Scope", "Issue", "Detail"],
      scopeIssues.map((issue) => [issue.selection.key, issue.scope, issue.issue, issue.detail]),
    );
  }
  console.log("");

  console.log("Scoped All-Time Expected Values");
  table(
    ["Selection", "Scope", "Series Ret", "Series DD", "Series Trades", "Week Trade Ret", "Week Trades", "Summary perAsset"],
    Array.from(payloads.entries()).flatMap(([key, payload]) => {
      const selection = selections.find((candidate) => candidate.key === key)!;
      return ASSET_SCOPES.map((scope) => {
        const summary = seriesSummary(assetSeries(payload, scope));
        const trades = scopedTradesFromWeeks(payload, scope);
        return [
          selection.key,
          scope,
          fmtReturn(summary.returnPct),
          fmtReturn(summary.maxDrawdownPct),
          String(summary.trades),
          fmtReturn(scopedReturnFromWeeks(payload, scope)),
          String(trades.length),
          hasAllTimePerAsset(payload, scope) ? "yes" : "no",
        ];
      });
    }),
  );
  console.log("");

  const criticalCount = emptyOverlayIssues.length + weekIssues.length;
  const scopeMismatchCount = scopeIssues.length;
  console.log("Audit Summary");
  table(
    ["Metric", "Count"],
    [
      ["payloads loaded", String(payloads.size)],
      ["payload load failures", String(loadFailures.length)],
      ["week integrity issues", String(weekIssues.length)],
      ["ready overlay empty-week issues", String(emptyOverlayIssues.length)],
      ["scoped all-time issues", String(scopeIssues.length)],
    ],
  );

  if (criticalCount > 0 || scopeMismatchCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

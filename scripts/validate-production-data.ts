/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: validate-production-data.ts
 *
 * Description:
 * Production data validation audit. Hits the visible strategy API endpoints,
 * compares sidebar vs simulation metrics, and outputs a comparison table
 * for strategy elimination decisions.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

const DEFAULT_BASE_URL = "https://limni-website-nine.vercel.app";
const BASE_URL = (process.env.PRODUCTION_BASE_URL || process.env.PROD_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const REQUEST_DELAY_MS = 2_000;

const STRATEGIES = ["tandem", "tiered_4w", "agree_3of4", "selector"] as const;
const ENTRY_STYLES = ["weekly_hold", "adr_grid"] as const;
const OVERLAYS = ["none", "exposure_cap"] as const;

type Selection = {
  strategy: string;
  f1: string;
  f2: string;
  key: string;
};

type ArtifactStatusRow = {
  key?: string;
  selectionKey?: string;
  ready?: boolean;
  reason?: string;
  missingWeeks?: string[];
  staleWeeks?: string[];
};

type ArtifactStatusPayload = {
  generatedAtUtc?: string;
  readyCount?: number;
  totalCount?: number;
  artifacts?: ArtifactStatusRow[];
  error?: string;
};

type SimulationPoint = {
  ts_utc: string;
  equity_pct: number;
  lock_pct: number | null;
  peak_pct?: number;
  drawdown_pct?: number;
  active_positions?: number;
};

type SimulationSeries = {
  id: string;
  label: string;
  color?: string;
  trades?: number;
  points: SimulationPoint[];
};

type EngineSimulationGroup = {
  title: string;
  description: string;
  metrics: {
    returnPct: number | null;
    maxDrawdownPct: number | null;
    trades: number | null;
  };
  series: SimulationSeries[];
};

type SidebarAllTimeStats = {
  totalReturnPct: number;
  totalTrades: number;
  weeklyWinRate: number;
  maxDrawdownPct: number;
  weeks: number;
  avgWeeklyReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  profitFactor: number | null;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
};

type StrategyClientPayload = {
  engineWeekMap: Record<string, unknown> | null;
  engineSimMap: Record<string, EngineSimulationGroup> | null;
  engineWeekResults: Record<string, unknown> | null;
  sidebarStats: {
    allTime: SidebarAllTimeStats | null;
  } | null;
  weekOptions?: string[];
  currentWeekOpenUtc?: string;
  artifactMeta?: {
    status?: string;
    selectionKey?: string;
    cachedAtUtc?: string | null;
    refreshedWeeks?: string[];
    removedWeeks?: string[];
    missingWeeks?: string[];
  };
  error?: string;
};

type ClientMetrics = {
  returnPct: number | null;
  maxDrawdownPct: number | null;
  trades: number | null;
};

type AuditRow = {
  selection: Selection;
  ready: boolean;
  reason: string;
  weeks: number;
  missing: number;
  sidebarReturn: number | null;
  sidebarDD: number | null;
  sidebarTrades: number | null;
  sidebarWinRate: number | null;
  serverSimReturn: number | null;
  serverSimDD: number | null;
  serverSimTrades: number | null;
  clientSimReturn: number | null;
  clientSimDD: number | null;
  clientSimTrades: number | null;
  returnGap: number | null;
  ddGap: number | null;
  allTime: SidebarAllTimeStats | null;
};

function selectionKey(strategy: string, f1: string, f2: string) {
  return `${strategy}:${f1}:${f2}`;
}

function buildSelections(): Selection[] {
  return STRATEGIES.flatMap((strategy) =>
    ENTRY_STYLES.flatMap((f1) =>
      OVERLAYS.map((f2) => ({
        strategy,
        f1,
        f2,
        key: selectionKey(strategy, f1, f2),
      })),
    ),
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null; raw: string }> {
  const url = `${BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
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

function isWeekend(tsUtc: string): boolean {
  const date = new Date(tsUtc);
  const day = date.getUTCDay();
  if (day === 6) return true;
  if (day === 0 && date.getUTCHours() < 21) return true;
  return false;
}

function filterMarketHours(points: SimulationPoint[], includeWeekends: boolean): SimulationPoint[] {
  const now = Date.now();
  const filtered = points.filter((point) => (
    (includeWeekends || !isWeekend(point.ts_utc)) &&
    new Date(point.ts_utc).getTime() <= now
  ));
  if (filtered.length > 0) return filtered;
  const pastPoints = points.filter((point) => new Date(point.ts_utc).getTime() <= now);
  if (pastPoints.length > 0) return pastPoints;
  return points.length > 0 ? [points[0]!] : [];
}

function computeMixedSeries(series: SimulationSeries[]): SimulationSeries {
  const timestamps = Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.ts_utc))))
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  const pointMaps = series.map((item) => new Map(item.points.map((point) => [point.ts_utc, point])));
  const lastEquityBySeries = new Array<number>(series.length).fill(0);
  const lastActiveBySeries = new Array<number>(series.length).fill(0);
  let runningPeakPct = 0;
  const points = timestamps.map((tsUtc) => {
    for (let index = 0; index < pointMaps.length; index += 1) {
      const point = pointMaps[index]?.get(tsUtc);
      if (point) {
        lastEquityBySeries[index] = point.equity_pct;
        lastActiveBySeries[index] = point.active_positions ?? 0;
      }
    }
    const equityPct = lastEquityBySeries.reduce((sum, value) => sum + value, 0);
    const activePositions = lastActiveBySeries.reduce((sum, value) => sum + value, 0);
    runningPeakPct = Math.max(runningPeakPct, equityPct);
    const drawdownPct = (100 + runningPeakPct) <= 0
      ? -100
      : (((100 + equityPct) / (100 + runningPeakPct)) - 1) * 100;
    return {
      ts_utc: tsUtc,
      equity_pct: equityPct,
      lock_pct: null,
      peak_pct: runningPeakPct,
      drawdown_pct: drawdownPct,
      active_positions: activePositions,
    };
  });

  return {
    id: "active-mix",
    label: series.length === 1 ? series[0]?.label ?? "Active Mix" : "Active Mix",
    points,
  };
}

function computeClientMetrics(group: EngineSimulationGroup | null | undefined): ClientMetrics {
  if (!group?.series?.length) {
    return { returnPct: null, maxDrawdownPct: null, trades: null };
  }

  const totalSeries = group.series.find((series) => series.id === "equity" || series.id === "total") ?? null;
  const assetSleeves = group.series.filter((series) => series.id.startsWith("asset:"));
  const fallbackSleeves = group.series.filter((series) => series.id !== "equity" && series.id !== "total");
  const activeSleeves = assetSleeves.length > 0 ? assetSleeves : fallbackSleeves;
  const includeWeekends = activeSleeves.some((series) => series.id === "asset:crypto");
  const mixedSeries = totalSeries ?? computeMixedSeries(activeSleeves);
  const points = filterMarketHours(mixedSeries.points, includeWeekends);
  const lastPoint = points.at(-1);
  const drawdowns = points
    .map((point) => point.drawdown_pct)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return {
    returnPct: lastPoint?.equity_pct ?? null,
    maxDrawdownPct: drawdowns.length > 0 ? Math.abs(Math.min(...drawdowns)) : null,
    trades: totalSeries ? group.metrics.trades : activeSleeves.reduce((sum, series) => sum + (series.trades ?? 0), 0),
  };
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function gap(left: number | null, right: number | null) {
  return left === null || right === null ? null : Math.abs(left - right);
}

function formatReturn(value: number | null) {
  if (value === null) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPct(value: number | null) {
  if (value === null) return "-";
  return `${value.toFixed(2)}%`;
}

function formatNum(value: number | null, digits = 2) {
  if (value === null) return "-";
  return value.toFixed(digits);
}

function formatInt(value: number | null) {
  if (value === null) return "-";
  return String(value);
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

function artifactKey(artifact: ArtifactStatusRow) {
  return artifact.key ?? artifact.selectionKey ?? "";
}

function familyLabel(strategy: string) {
  if (strategy === "agree_3of4") return "Agreement";
  if (strategy === "tiered_4w") return "Tiered";
  if (strategy === "selector") return "Selector";
  return "Tandem";
}

async function main() {
  console.log(`Production data validation audit`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log("");

  const statusResponse = await getJson<ArtifactStatusPayload>("/api/performance/strategy-artifacts/status");
  if (!statusResponse.ok || !statusResponse.data) {
    console.error(`Artifact readiness request failed: HTTP ${statusResponse.status}`);
    console.error(statusResponse.raw);
    process.exitCode = 1;
    return;
  }

  const status = statusResponse.data;
  const artifacts = status.artifacts ?? [];
  const artifactByKey = new Map(artifacts.map((artifact) => [artifactKey(artifact), artifact]));
  const readyCount = status.readyCount ?? artifacts.filter((artifact) => artifact.ready).length;
  const totalCount = status.totalCount ?? artifacts.length;
  const notReady = artifacts.filter((artifact) => !artifact.ready);

  console.log(`Readiness: ${readyCount}/${totalCount} ready`);
  if (notReady.length > 0) {
    console.log("Not ready:");
    for (const artifact of notReady) {
      console.log(`  - ${artifactKey(artifact)} (${artifact.reason ?? "unknown"}) missing=${artifact.missingWeeks?.length ?? 0} stale=${artifact.staleWeeks?.length ?? 0}`);
    }
  }
  console.log("");

  const rows: AuditRow[] = [];
  const selections = buildSelections();
  for (let index = 0; index < selections.length; index += 1) {
    const selection = selections[index]!;
    const path =
      `/api/performance/strategy-page-data?strategy=${encodeURIComponent(selection.strategy)}` +
      `&f1=${encodeURIComponent(selection.f1)}` +
      `&f2=${encodeURIComponent(selection.f2)}` +
      `&scope=full`;
    console.log(`[${index + 1}/${selections.length}] Fetching ${selection.key}`);
    const response = await getJson<StrategyClientPayload>(path);
    const payload = response.data;
    const artifact = artifactByKey.get(selection.key);

    if (!response.ok || !payload || payload.error) {
      console.error(`  Request failed for ${selection.key}: HTTP ${response.status}`);
      console.error(`  ${response.raw.slice(0, 1_000)}`);
      rows.push({
        selection,
        ready: artifact?.ready === true,
        reason: artifact?.reason ?? "request_failed",
        weeks: 0,
        missing: artifact?.missingWeeks?.length ?? 0,
        sidebarReturn: null,
        sidebarDD: null,
        sidebarTrades: null,
        sidebarWinRate: null,
        serverSimReturn: null,
        serverSimDD: null,
        serverSimTrades: null,
        clientSimReturn: null,
        clientSimDD: null,
        clientSimTrades: null,
        returnGap: null,
        ddGap: null,
        allTime: null,
      });
    } else {
      if (!payload.sidebarStats || !payload.engineSimMap) {
        console.log(`Raw payload for ${selection.key} because sidebarStats or engineSimMap is null:`);
        console.log(JSON.stringify(payload, null, 2).slice(0, 10_000));
      }

      const allTime = payload.sidebarStats?.allTime ?? null;
      const allSim = payload.engineSimMap?.all ?? null;
      const clientMetrics = computeClientMetrics(allSim);
      const sidebarReturn = num(allTime?.totalReturnPct);
      const sidebarDD = num(allTime?.maxDrawdownPct);
      const clientReturn = num(clientMetrics.returnPct);
      const clientDD = num(clientMetrics.maxDrawdownPct);
      rows.push({
        selection,
        ready: artifact?.ready === true,
        reason: artifact?.reason ?? "unknown",
        weeks: (payload.weekOptions ?? []).filter((week) => week !== "all").length,
        missing: payload.artifactMeta?.missingWeeks?.length ?? artifact?.missingWeeks?.length ?? 0,
        sidebarReturn,
        sidebarDD,
        sidebarTrades: num(allTime?.totalTrades),
        sidebarWinRate: num(allTime?.weeklyWinRate),
        serverSimReturn: num(allSim?.metrics.returnPct),
        serverSimDD: num(allSim?.metrics.maxDrawdownPct),
        serverSimTrades: num(allSim?.metrics.trades),
        clientSimReturn: clientReturn,
        clientSimDD: clientDD,
        clientSimTrades: num(clientMetrics.trades),
        returnGap: gap(sidebarReturn, clientReturn),
        ddGap: gap(sidebarDD, clientDD),
        allTime,
      });
    }

    if (index < selections.length - 1) await wait(REQUEST_DELAY_MS);
  }

  console.log("");
  console.log("Comparison Table");
  table(
    [
      "Strategy",
      "F1",
      "F2",
      "Weeks",
      "Missing",
      "Sidebar Ret",
      "Sidebar DD",
      "Sidebar Trades",
      "Sidebar WR",
      "Server Ret",
      "Server DD",
      "Server Trades",
      "Client Ret",
      "Client DD",
      "Client Trades",
      "Return Gap",
      "DD Gap",
    ],
    rows.map((row) => [
      row.selection.strategy,
      row.selection.f1,
      row.selection.f2,
      String(row.weeks),
      String(row.missing),
      formatReturn(row.sidebarReturn),
      formatPct(row.sidebarDD),
      formatInt(row.sidebarTrades),
      formatPct(row.sidebarWinRate),
      formatReturn(row.serverSimReturn),
      formatPct(row.serverSimDD),
      formatInt(row.serverSimTrades),
      formatReturn(row.clientSimReturn),
      formatPct(row.clientSimDD),
      formatInt(row.clientSimTrades),
      formatPct(row.returnGap),
      formatPct(row.ddGap),
    ]),
  );

  const totalMissingWeeks = rows.reduce((sum, row) => sum + row.missing, 0);
  const discrepancies = rows.filter((row) =>
    (row.returnGap !== null && row.returnGap > 2.0) ||
    (row.ddGap !== null && row.ddGap > 1.0)
  );
  const unhealthyShards = rows.filter((row) => row.missing > 0);

  console.log("");
  console.log(`Summary`);
  console.log(`Readiness: ${readyCount}/${totalCount} ready, ${totalMissingWeeks} total missing weeks`);
  console.log(`Discrepancies: ${discrepancies.length}`);
  for (const row of discrepancies) {
    console.log(`  - ${row.selection.key}: return gap ${formatPct(row.returnGap)}, DD gap ${formatPct(row.ddGap)}`);
  }
  console.log(`Shard health flags: ${unhealthyShards.length}`);
  for (const row of unhealthyShards) {
    console.log(`  - ${row.selection.key}: missing ${row.missing}`);
  }

  const leaderboard = rows
    .filter((row) => row.allTime)
    .sort((left, right) => (right.sidebarReturn ?? -Infinity) - (left.sidebarReturn ?? -Infinity));

  console.log("");
  console.log("Elimination Leaderboard");
  table(
    ["Rank", "Family", "Strategy", "F1", "F2", "Return%", "DD%", "Trades", "WinRate%", "R/DD", "Sharpe", "Calmar"],
    leaderboard.map((row, index) => {
      const rdd = row.sidebarReturn !== null && row.sidebarDD !== null && row.sidebarDD !== 0
        ? row.sidebarReturn / row.sidebarDD
        : null;
      return [
        String(index + 1),
        familyLabel(row.selection.strategy),
        row.selection.strategy,
        row.selection.f1,
        row.selection.f2,
        formatReturn(row.sidebarReturn),
        formatPct(row.sidebarDD),
        formatInt(row.sidebarTrades),
        formatPct(row.sidebarWinRate),
        formatNum(rdd),
        formatNum(row.allTime?.sharpe ?? null),
        formatNum(row.allTime?.calmar ?? null),
      ];
    }),
  );

  console.log("");
  console.log("Secondary Stats");
  table(
    ["Strategy", "F1", "F2", "Sharpe", "Sortino", "Calmar", "Profit Factor", "Expectancy", "Avg Win", "Avg Loss"],
    rows.map((row) => [
      row.selection.strategy,
      row.selection.f1,
      row.selection.f2,
      formatNum(row.allTime?.sharpe ?? null),
      row.allTime?.sortino !== null && row.allTime?.sortino !== undefined && row.allTime.sortino >= 99
        ? "inf"
        : formatNum(row.allTime?.sortino ?? null),
      formatNum(row.allTime?.calmar ?? null),
      row.allTime?.profitFactor === null || row.allTime?.profitFactor === undefined
        ? "inf"
        : formatNum(row.allTime.profitFactor),
      formatReturn(row.allTime?.expectancy ?? null),
      formatReturn(row.allTime?.avgWin ?? null),
      formatReturn(row.allTime?.avgLoss ?? null),
    ]),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

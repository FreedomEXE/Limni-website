# Canonical App Session Store Design

## 1. Canonical Session Payload Shape

The session store is an in-memory browser store seeded by SSR and patched by background refreshes. It is grouped by domain, not by page. Performance, Matrix, Data, sidebar, charts, and cards select from this object; they do not fetch or derive competing copies of the same strategy data.

```ts
import type { DashboardCotPayload, DashboardSentimentPayload, DashboardStrengthPayload } from "@/components/dashboard/DashboardViewSection";
import type { EngineGridProps, EngineSidebarStats, EngineSimulationGroup } from "@/lib/performance/engineAdapter";
import type { BasketPathResult, BasketPathSummary } from "@/lib/performance/basketPathEngine";
import type { RuntimeStrategySelection } from "@/lib/performance/strategySelection";
import type { WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";

export type SessionCurrentWeekStatus =
  | "historical-only"
  | "current-loading"
  | "current-ready"
  | "current-empty"
  | "current-error";

export type SessionCacheKey = {
  appBuildVersion: string;
  strategyEngineVersion: string;
  strategyAssemblyVersion: string;
  sourceWatermark: string;
  currentWeekWatermark: string;
};

export type SessionArtifactMeta = {
  selectionKey: string;
  cachedAtUtc: string | null;
  stale: boolean;
  staleReason: string | null;
  refreshedWeeks: string[];
  removedWeeks: string[];
  missingWeeks: string[];
  engineVersion: string;
  assemblyVersion: string;
  sourceWatermark: string;
};

export type SessionWeekMeta = {
  weekOpenUtc: string;
  label: string;
  isCurrent: boolean;
  isHistorical: boolean;
  isReady: boolean;
};

export type SessionStrategyData = {
  selection: RuntimeStrategySelection;
  selectionKey: string;
  artifactMeta: SessionArtifactMeta;
  weekOptions: string[];
  weeks: Record<string, SessionWeekMeta>;
  historical: {
    weekResults: Record<string, WeeklyHoldResult>;
    pathResults: Record<string, BasketPathResult>;
    pathSummaries: Record<string, BasketPathSummary>;
    gridByWeek: Record<string, EngineGridProps>;
    simulationByWeek: Record<string, EngineSimulationGroup>;
    sidebarStats: EngineSidebarStats;
  };
  currentWeek: {
    status: SessionCurrentWeekStatus;
    weekOpenUtc: string;
    result: WeeklyHoldResult | null;
    pathResult: BasketPathResult | null;
    pathSummary: BasketPathSummary | null;
    grid: EngineGridProps | null;
    simulation: EngineSimulationGroup | null;
    sidebarStats: EngineSidebarStats | null;
    emptyReason: string | null;
    error: string | null;
    fetchedAtUtc: string | null;
    watermark: string;
  };
  allTime: {
    result: WeeklyHoldResult | null;
    path: { points: BasketPathResult["points"]; summary: BasketPathSummary } | null;
    grid: EngineGridProps | null;
    simulation: EngineSimulationGroup | null;
    sidebarStats: EngineSidebarStats | null;
  };
};

export type SessionSourceData = {
  status: "not-loaded" | "ready" | "stale" | "error";
  currentWeekOpenUtc: string;
  reportDates: string[];
  reportToWeek: Record<string, string>;
  cotDataByReport: Record<string, { dealer: DashboardCotPayload; commercial: DashboardCotPayload }>;
  sentimentDataByReport: Record<string, DashboardSentimentPayload>;
  strengthDataByReport: Record<string, DashboardStrengthPayload>;
  loadedAtUtc: string | null;
  watermark: string;
  error: string | null;
};

export type LimniAppSession = {
  schemaVersion: "limni-session-v1";
  cacheKey: SessionCacheKey;
  bootedAtUtc: string;
  lastValidatedAtUtc: string | null;
  visibleSelections: RuntimeStrategySelection[];
  activeSelectionKey: string;
  activeWeek: string | "all";
  currentWeekOpenUtc: string;
  strategyByKey: Record<string, SessionStrategyData>;
  sourceData: SessionSourceData | null;
  preload: {
    status: "idle" | "loading" | "ready" | "partial" | "error";
    queuedSelectionKeys: string[];
    loadingSelectionKeys: string[];
    readySelectionKeys: string[];
    failedSelectionKeys: Record<string, string>;
    concurrency: number;
  };
};
```

Deletion target: once this shape exists in code, `PerformanceStrategyViewSection.tsx` local `entryCache`/`stableEntry` state at lines 66-69 and `MatrixViewSection.tsx` local `strategyDataCache`/`stableStrategyData` state at lines 94-112 become page-local copies and must be removed or delegated to session selectors.

## 2. Cache Key And Invalidation Rules

The canonical key is `SessionCacheKey`. It replaces page-specific cache identity.

| Key Component | Current Source | Invalidates When | Notes |
| --- | --- | --- | --- |
| `appBuildVersion` | new `NEXT_PUBLIC_BUILD_ID` or deployment hash | app deploys | Full session refresh. |
| `strategyEngineVersion` | `buildStrategyArtifactEngineVersion()` in `strategyArtifactVersions.ts:30` | `STRATEGY_SHARD_ENGINE_VERSION`, entry engines, risk overlay versions, or `PATH_SIMULATION_VERSION` changes | Historical strategy/path data refresh. |
| `strategyAssemblyVersion` | `buildStrategyAssemblyVersion()` in `strategyArtifactVersions.ts:46` | view-model/display aggregation changes | Reassemble from reusable shards when possible. |
| `sourceWatermark` | fingerprint built in `strategyPageData.ts` and readiness logic | COT/sentiment/strength/ADR source rows change | Refresh affected weeks only. |
| `currentWeekWatermark` | `currentWeekOpenUtc` plus current-week fetch timestamp/data watermark | new week opens or intra-week data changes | Refresh current week slice only. |
| `selectionKey` | `buildStrategySelectionKey()` | user changes `strategy:f1:f2` | Select a different `SessionStrategyData`. |

Lifecycle rules:

1. On page change, compare the route's requested selection/week to `LimniAppSession`. If `cacheKey` matches, pages render from session selectors and make zero data fetches.
2. On refresh/return visit, load in-memory session first. Persistent browser storage is optional and must use the same key. If any key component changed, refresh only the affected strategy/current/source slices.
3. On new deployment (`appBuildVersion` mismatch), discard the session and bootstrap fresh.
4. On strategy engine version mismatch, discard historical strategy data for the affected selection and refetch/rebuild.
5. On assembly version mismatch, reuse compatible shards if available and rebuild display payloads.
6. On source watermark mismatch, patch only changed weeks.
7. On current-week watermark mismatch, transition the current-week slice to `current-loading`; do not mark the whole strategy as missing.

Deletion target: `strategyClientCache.ts` currently keys data as a flat `payloadCache` at line 7 and separates inflight requests by `${cacheKey}:${scope}` at lines 274 and 341. That cache becomes the transport implementation behind the session store, not the canonical app state.

## 3. Current Week State Model

Current week is explicit state, not a map-entry side effect.

```ts
type CurrentWeekEvent =
  | { type: "BOOT"; weekOpenUtc: string }
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; result: WeeklyHoldResult; path: BasketPathResult | null }
  | { type: "FETCH_EMPTY"; reason: string }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "STALE" }
  | { type: "NEW_WEEK"; weekOpenUtc: string };

type CurrentWeekTransition =
  | ["historical-only", "FETCH_START", "current-loading"]
  | ["current-loading", "FETCH_SUCCESS", "current-ready"]
  | ["current-loading", "FETCH_EMPTY", "current-empty"]
  | ["current-loading", "FETCH_ERROR", "current-error"]
  | ["current-ready", "STALE", "current-loading"]
  | ["current-empty", "STALE", "current-loading"]
  | ["current-error", "FETCH_START", "current-loading"]
  | [SessionCurrentWeekStatus, "NEW_WEEK", "historical-only"];
```

Rendering rules:

- `historical-only`: current week is not shown as a normal week unless a component explicitly supports "pending current week".
- `current-loading`: show last historical data plus a current-week loading state, not a zero-value row.
- `current-ready`: render current week normally.
- `current-empty`: render an empty-state badge with `emptyReason`; never render `0%`, `0 trades`, and ready styling as if it were real performance.
- `current-error`: render an error state and keep historical data usable.

Deletion targets:

- `readReadyStrategyArtifactPayload()` implicitly overlays current week at `strategyArtifactReadiness.ts:231` and `strategyArtifactReadiness.ts:276`; this should delegate to the session current-week slice.
- Performance currently fetches Matrix current week only at `PerformanceStrategyViewSection.tsx:219-221`; Performance current-week rendering should not rely on that cache side effect.
- Matrix currently fetches current week when a map key is absent at `MatrixViewSection.tsx:229-240`; this should become a session current-week transition.

## 4. Module Ownership Map

| Data Concern | Canonical Owner | Old Paths To Delete Or Delegate | Migration Action |
| --- | --- | --- | --- |
| Total max DD | `basketPathEngine.ts:summarizePoints()` at lines 132-156, fed by corrected `drawdownPct` in `buildPathResultFromArrays()` lines 163-181 and `computeMultiWeekBasketPath()` lines 344-369 | `PerformanceGrid.tsx:computeMaxDrawdownFromReturns()` lines 141-165; `EquityCurveChart.tsx` local DD loop lines 135-149; `weeklyHoldEngine.ts` weekly DD at line 1282 should remain fallback only | Delete component DD; delegate weekly fallback behind path preference. |
| Per-source max DD | `computeBasketPathWithSlots()` at `basketPathEngine.ts:323`, with slot path summaries passed into `engineAdapter.ts` | `PerformanceGrid.tsx` card fallback at lines 342-344 | Populate `ModelPerformance.diagnostics.max_drawdown`; delete card fallback. |
| Per-asset max DD | Asset path construction in `strategyPageData.ts` around path maps at lines 1296-1333 and shard assembly at lines 1432-1479 | Any component-local asset DD, including chart local peak/trough logic | Store path summaries by asset id and use them in grid/simulation. |
| Sidebar all-time stats | `engineAdapter.ts:weeklyHoldToSidebarStatsWithPath()` lines 950-989 | No exact duplicate; it already prefers `multiWeekPathSummary` at line 970 and `currentWeekPathSummary` at line 988 | Keep, but source its inputs from session `SessionStrategyData`. |
| Current week result | `SessionStrategyData.currentWeek` state slice | `strategyArtifactReadiness.ts:231/276`; `PerformanceStrategyViewSection.tsx:219-221`; `MatrixViewSection.tsx:229-240` | Delegate current-week fetching/merge to session reducer. |
| Strategy client payload | Session store owns canonical strategy state. `strategyClientCache.ts` remains transport/cache helper only if needed. | `strategyClientCache.ts` scoped cache/inflight lines 89-114, 262-285, 336-352; `strategyClientPayload.ts` scope slicing lines 15, 64-95 | Remove `scope` from canonical state. If retained, scope may only reduce transport payload size and must merge into one session entry. |
| Equity curve data | `BasketPathPoint[]` from `basketPathEngine.ts` | `EquityCurveChart.tsx` local peak/trough recalculation lines 135-149 | Pass `peak_pct`, `drawdown_pct`, and `active_positions` through simulation points; chart reads them. |
| Performance page data | Session selectors over `SessionStrategyData` | `PerformanceStrategyViewSection.tsx` local `entryCache` and stale refresh logic lines 66-210 | Delete local cache after session store exists. |
| Matrix page data | Session selectors over `SessionStrategyData.weekResults` plus shared source returns slice | `MatrixViewSection.tsx` local `strategyDataCache` lines 94-213 and current-week fetch lines 229-240 | Delete local cache after session store exists. |
| Data page source snapshots | `SessionSourceData` when migrated | `dashboard/page.tsx` currently builds `cotDataByReport` lines 841-908 and `strengthDataByReport` lines 925-947 | Keep server-owned initially; migrate only after strategy session is stable. |

## 5. Preload And Lifecycle

### App Boot / First Strategy Page Visit

1. Server resolves the requested selection and current week.
2. Server may return only the current selection payload for first paint.
3. Client creates `LimniAppSession` and seeds `strategyByKey[activeSelectionKey]`.
4. Client starts background preload for visible selections with concurrency 3.
5. Client starts current-week state transition for active selection: `historical-only -> current-loading`.
6. Stale historical artifacts render immediately with `artifactMeta.stale = true`; server warm runs in the background.

Delete/delegate target: `StrategyArtifactLoadingGate.tsx` should no longer own broad loading semantics after session migration. Its current `currentReady` gate at lines 22-32 becomes a thin view over session preload state.

### Strategy Switch

1. Sidebar dispatches the selection change.
2. Page reads `session.strategyByKey[nextSelectionKey]`.
3. If present, render immediately.
4. If absent, session transport fetches that selection, stores it once, and marks status partial/loading.
5. Current-week slice transitions independently.

Delete/delegate target: `PerformanceStrategyViewSection.tsx` `ensureSelectionEntry()` lines 110-166 and `MatrixViewSection.tsx` `ensureStrategyData()` lines 165-213 must be removed when the session store owns this flow.

### Page Navigation

Performance, Matrix, and later Data must mount as selectors:

- Performance selects `gridByWeek`, `simulationByWeek`, `sidebarStats`, and active week state.
- Matrix selects `weekResults`, signals, and weekly returns.
- Sidebar selects `SessionStrategyData.allTime.sidebarStats` and current active-week stats.
- Charts select `EngineSimulationGroup` or, after WS3, a derived portfolio-mix path.

No page-owned loaders fire if the session has matching keys.

### Refresh / Return Visit

The in-memory session is primary. Optional persistent storage can restore the latest `LimniAppSession` if its `SessionCacheKey` still matches. Persistent storage should be future enhancement; the first implementation should work without it.

### Staleness Detection

Stale data is served, then patched. The session store must record `stale`, `staleReason`, `loadingSelectionKeys`, and per-selection refresh status. Blocking loading screens are only allowed for a cold empty session.

## 6. Migration Order

### Step 1: WS1 DD Source Of Truth

Add:

- Correct conventional DD formula in `basketPathEngine.ts`.
- Path-derived `diagnostics.max_drawdown` for grid cards.
- Path fields in simulation points.

Delete/delegate:

- Delete `PerformanceGrid.tsx:computeMaxDrawdownFromReturns()` lines 141-165.
- Remove raw DD loop usage in `EquityCurveChart.tsx` lines 135-149 for path-backed data.

Expected net line count: neutral to slightly negative.

Verification:

- `rg "computeMaxDrawdownFromReturns" src/components` returns no results.
- `rg "basketEquityPct - runningPeakPct|shiftedEquityPct - runningPeakPct|runningPeak - current" src components` returns no strategy DD paths.
- Typecheck and ESLint pass.

### Step 2: WS2 Current Week State Machine

Add:

- Current-week state fields to strategy payload/session state.
- Explicit empty/error/loading rendering.

Delete/delegate:

- Remove implicit overlay calls in `strategyArtifactReadiness.ts:231` and `strategyArtifactReadiness.ts:276`.
- Remove Performance Matrix-only current-week side-effect fetch at `PerformanceStrategyViewSection.tsx:219-221`.
- Replace Matrix key-absence current-week fetch at `MatrixViewSection.tsx:229-240`.

Expected net line count: neutral; some new state code offset by deleted side effects.

Verification:

- Current week cannot render as ready with `0 trades` unless `currentWeek.status === "current-ready"` and result genuinely has zero trades with explicit empty handling.
- Performance and Matrix show the same current-week state for the same selection.

### Step 3: Session Store Implementation And Performance Migration

Add:

- `src/lib/performance/sessionStore.ts` or equivalent client store.
- Selectors for Performance view data.
- Session bootstrap from SSR payload.

Delete/delegate:

- Delete `PerformanceStrategyViewSection.tsx` `entryCache`, `stableEntry`, and `ensureSelectionEntry()` lines 66-166.
- Convert `StrategyArtifactLoadingGate.tsx` to read session preload state or make it a thin presentational gate.

Expected net line count: neutral or negative after local cache deletion.

Verification:

- Performance has no local strategy payload cache.
- Page navigation back to Performance does not call `/api/performance/strategy-page-data` when session keys match.

### Step 4: Matrix Migration

Add:

- Matrix selectors over the same session store.

Delete/delegate:

- Delete `MatrixViewSection.tsx` `strategyDataCache`, `stableStrategyData`, and `ensureStrategyData()` lines 94-213.
- Delete Matrix current-week side-effect fetch at lines 229-240.

Expected net line count: negative.

Verification:

- Matrix and Performance consume the same `SessionStrategyData` for `tandem:adr_grid:exposure_cap`.
- Switching Performance -> Matrix causes zero duplicate strategy artifact fetches when the session is warm.

### Step 5: Data Page Migration

Add:

- Optional `SessionSourceData` hydration if Data is needed inside the unified session.

Delete/delegate:

- Do not migrate Data until Performance/Matrix are stable.
- If migrated, move `dashboard/page.tsx` source payload assembly around lines 841-947 into a canonical source-data loader and make `DashboardViewSection.tsx` a selector/renderer.

Expected net line count: neutral initially; negative only after server loader consolidation.

Verification:

- Data page bias/report switches do not rerun full dashboard page payload generation when session source data is present.

### Step 6: WS3 Portfolio Mixer

Add:

- Derived active portfolio mix selector that sums selected sleeve paths point-by-point.
- Metrics/sidebar/cards based on that derived path.

Delete/delegate:

- Remove Compare/Isolate as separate chart modes in `EquityCurveChart.tsx`; sleeve selection becomes the interaction model.
- Remove independent metric cards that read `group.metrics` without considering active mix.

Expected net line count: neutral; UI state added, old compare/isolate mode deleted.

Verification:

- All selected: one full portfolio curve.
- FX only: one FX curve and FX-only metrics.
- FX + indices: one mixed FX+indices curve and matching metrics/sidebar/cards.

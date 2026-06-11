# CODEX: Canonical Metrics Migration — Path Engine Becomes Source of Truth

**Date:** 2026-04-07
**Depends on:** Phase 1 (anchor reconciliation PASS) + Phase 2 (simulation wired)
**Goal:** Make path-engine metrics canonical everywhere — sidebar, grid cards, API routes, sidebar stats. The path engine is no longer a chart enhancement; it is the performance engine. Weekly-close metrics remain as a fallback/debug layer only.

---

## Why This Migration

The path engine produces verified, H1-resolution metrics that match weekly-close totals (±0.00%) while revealing honest intraweek drawdown, peak, and giveback. Currently, only the simulation chart uses path metrics. Everything else — sidebar stats, grid cards, API routes — still reads from coarse weekly-close DD (which showed Dealer at 0.00% DD when the path-true DD is 19.82%).

This prompt makes the path engine the canonical metric source for all consumers.

---

## Architecture Principle: Resolution-Agnostic Canonical Layer

All performance metrics must flow from a single canonical source that:
1. Uses the **lowest trusted timeframe available** (currently `1h`)
2. Is configurable in **one place** (not per-consumer)
3. Preserves weekly-close economics for backward compatibility

When we later upgrade to 5m or 1m resolution, only the loader and resolution config change — no consumer code is touched.

---

## Design: Where the Change Happens

The migration modifies **three layers** and touches **four files**:

```
Layer 1: Metric computation    → strategyPageData.ts (already runs path engine per Phase 2)
Layer 2: Metric transformation → engineAdapter.ts (sidebar stats + grid allTime)
Layer 3: API endpoint          → engine-stats/route.ts (sidebar API)
Layer 4: Configuration         → new: pathResolution.ts (single resolution config)
```

**Zero UI component changes.** All downstream components (`StrategySidebar`, `PerformanceGrid`, `PerformanceSimulationSection`, `PerformanceComparisonPanel`) consume typed data from the adapter layer. Swap the numbers at the adapter layer and every component shows path-true metrics automatically.

---

## Step 0: Create Resolution Config

### New file: `src/lib/performance/pathResolution.ts`

This is the **single place** that defines which resolution is canonical. When we upgrade from 1h to 5m later, this one file changes.

```typescript
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: pathResolution.ts
 *
 * Description:
 * Single source of truth for the canonical path engine resolution.
 * All path engine consumers read from here. When upgrading from
 * 1h to 5m or 1m, change CANONICAL_PATH_RESOLUTION and ensure
 * bars exist in canonical_price_bars at that resolution.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

/**
 * The canonical resolution for the path engine.
 * All path bar loaders and path engine calls use this value.
 * Valid values: "1h", "5m", "1m"
 */
export const CANONICAL_PATH_RESOLUTION = "1h";
```

Then update `pathBarLoader.ts` to import it as the default:

In `loadPathBars()` (line 79), change the default parameter:

```typescript
// BEFORE:
export async function loadPathBars(
  symbols: string[],
  fromUtc: string,
  toUtc: string,
  resolution = "1h",

// AFTER:
import { CANONICAL_PATH_RESOLUTION } from "@/lib/performance/pathResolution";

export async function loadPathBars(
  symbols: string[],
  fromUtc: string,
  toUtc: string,
  resolution = CANONICAL_PATH_RESOLUTION,
```

And update `strategyPageData.ts` where it calls `loadPathBars` to NOT pass a hardcoded `"1h"` — let it use the default from the config:

```typescript
// BEFORE (wherever Phase 2 added this):
const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc, "1h");

// AFTER:
const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc);
```

---

## Step 1: Enrich StrategyPageData with Path Summary

### File: `src/lib/performance/strategyPageData.ts`

Phase 2 already computes `BasketPathResult[]` inside `assembleStrategyPageData()`. We need to make the multi-week path summary available to the adapter layer.

#### 1a. Add path summary to `StrategyPageData` type (line 100-110)

```typescript
// BEFORE:
export type StrategyPageData = {
  weekMap: Record<string, EngineGridProps>;
  simMap: Record<string, EngineSimulationGroup>;
  multiWeekResult: MultiWeekResult;
  weekResults: Record<string, WeeklyHoldResult>;
  sidebarStats: EngineSidebarStats;
  biasSource: BiasSourceConfig;
  entryStyle: EntryStyleConfig | undefined;
  weekOptions: string[];
  currentWeekOpenUtc: string;
};

// AFTER:
import type { BasketPathSummary } from "@/lib/performance/basketPathEngine";

export type StrategyPageData = {
  weekMap: Record<string, EngineGridProps>;
  simMap: Record<string, EngineSimulationGroup>;
  multiWeekResult: MultiWeekResult;
  pathSummary: BasketPathSummary | null;
  weekResults: Record<string, WeeklyHoldResult>;
  sidebarStats: EngineSidebarStats;
  biasSource: BiasSourceConfig;
  entryStyle: EntryStyleConfig | undefined;
  weekOptions: string[];
  currentWeekOpenUtc: string;
};
```

#### 1b. Compute and return `pathSummary` in `assembleStrategyPageData()`

Phase 2 already computes `weekPathResults: BasketPathResult[]` inside the function. After building `simMap.all`, compute the multi-week path summary and store it:

```typescript
// After the existing line that builds simMap.all:
const multiWeekPath = computeMultiWeekBasketPath(weekPathResults);

// Then in the return object, add:
  pathSummary: weekPathResults.length > 0 ? multiWeekPath.summary : null,
```

Make sure `computeMultiWeekBasketPath` is imported (it should already be imported from Phase 2 via `multiWeekPathToSimulation` which calls it internally — but if it's not directly imported, add it):

```typescript
import { computeBasketPath, computeMultiWeekBasketPath, type BasketPathResult, type BasketPathSummary } from "@/lib/performance/basketPathEngine";
```

**Note:** `multiWeekPathToSimulation()` already calls `computeMultiWeekBasketPath()` internally. To avoid computing it twice, you can either:
- Extract the summary from the simulation group's metrics (it already has `returnPct` and `maxDrawdownPct`), OR
- Compute it once and pass to both `multiWeekPathToSimulation()` and `pathSummary`

The simplest approach: compute it once, store the summary, and have `multiWeekPathToSimulation()` accept the pre-computed result. But for Phase 3, the duplication is negligible (~60k lightweight operations). **Just compute it separately — do not refactor `multiWeekPathToSimulation()`.** Keep the change minimal.

---

## Step 2: Update Sidebar Stats to Use Path Metrics

### File: `src/lib/performance/engineAdapter.ts`

#### 2a. Add new function: `weeklyHoldToSidebarStatsWithPath()`

Add this function after the existing `weeklyHoldToSidebarStats()` (after line 740):

```typescript
export function weeklyHoldToSidebarStatsWithPath(
  result: WeeklyHoldResult,
  biasSource: BiasSourceConfig,
  multiWeek?: MultiWeekResult,
  pathSummary?: BasketPathSummary | null,
): EngineSidebarStats {
  const base = weeklyHoldToSidebarStats(result, biasSource, multiWeek);

  // If path summary is available, override DD with path-true DD
  if (base.allTime && pathSummary) {
    base.allTime = {
      ...base.allTime,
      maxDrawdownPct: -pathSummary.maxDrawdownPct,
    };
  }

  return base;
}
```

Add the import at the top of the file:

```typescript
import type { BasketPathSummary } from "@/lib/performance/basketPathEngine";
```

**Why `-pathSummary.maxDrawdownPct`:** The path engine stores `maxDrawdownPct` as a positive number (absolute value of the most negative drawdown). The weekly-close engine stores it as a negative number (`cum - peak`, which is ≤ 0). The sidebar displays it via `formatPercent()` which just formats the number. Check the display logic:

Look at `StrategySidebar.tsx` line 170 — it renders `allTime.maxDrawdownPct`. The weekly-close engine returns this as a negative number (e.g., `-4.01`), and the sidebar likely shows it as `-4.01%`. The path engine summary returns it as a positive number (e.g., `27.07`).

**IMPORTANT:** Check the actual sign convention used by `StrategySidebar.tsx` before deciding the sign. Read `StrategySidebar.tsx` lines 168-172 to see how `maxDrawdownPct` is formatted. If it applies `Math.abs()` or shows it as a positive %, use positive. If it shows it with the sign, use negative.

**The safest approach:** Keep the same sign convention as the weekly-close engine. Since `computeMultiWeekHold()` returns `maxDD = cum - peak` (which is ≤ 0), set:

```typescript
maxDrawdownPct: -pathSummary.maxDrawdownPct,
```

This produces a negative number (e.g., `-27.07`) matching the existing convention. If the sidebar already handles this with `Math.abs()` or similar, this is correct.

#### 2b. Update `multiWeekToGridProps()` to accept path summary

The grid card `allTime` stats currently don't show DD (the `diagnostics.max_drawdown` field is always `null` at line 365). The grid cards show `totalPercent`, `winRate`, `avgWeekly`, and `weeks`. These all come from weekly-close data and are correct (returns match exactly between weekly-close and path engine). **No change needed for grid card all-time stats.**

The only grid metric that would benefit from path data is `diagnostics.max_drawdown`, but it's currently `null` and not rendered by the UI. Leave it alone for now.

---

## Step 3: Wire Path Stats into Data Loaders

### File: `src/lib/performance/strategyPageData.ts`

In `assembleStrategyPageData()`, update the sidebar stats computation to use path metrics:

```typescript
// BEFORE:
    sidebarStats: weeklyHoldToSidebarStats(currentWeekResult, biasSource, multiWeekResult),

// AFTER:
    sidebarStats: weeklyHoldToSidebarStatsWithPath(currentWeekResult, biasSource, multiWeekResult, pathSummary),
```

Add the import:

```typescript
import {
  multiWeekToGridProps,
  singleWeekPathToSimulation,
  multiWeekPathToSimulation,
  weeklyHoldToGridProps,
  weeklyHoldToSidebarStatsWithPath,
  type EngineGridProps,
  type EngineSidebarStats,
  type EngineSimulationGroup,
} from "@/lib/performance/engineAdapter";
```

Remove `weeklyHoldToSidebarStats` from the import since we're replacing it with `weeklyHoldToSidebarStatsWithPath`. (Or keep both if other code uses the old one — check for other call sites first.)

### File: `src/app/api/performance/engine-stats/route.ts`

This API endpoint independently computes sidebar stats. It needs the same path enhancement.

Replace the computation (lines 48-61):

```typescript
// BEFORE:
  try {
    const result = await computeWeeklyHold(biasSource, weekOpenUtc, entryStyle);
    const dataSectionWeeks = await listDataSectionWeeks();
    const weekOptions = buildDataWeekOptions({
      historicalWeeks: dataSectionWeeks,
      currentWeekOpenUtc,
    }) as string[];
    const multiWeek = await computeMultiWeekHold(biasSource, weekOptions, entryStyle);
    const stats = weeklyHoldToSidebarStats(result, biasSource, multiWeek);
    return NextResponse.json(stats);

// AFTER:
  try {
    const result = await computeWeeklyHold(biasSource, weekOpenUtc, entryStyle);
    const dataSectionWeeks = await listDataSectionWeeks();
    const weekOptions = buildDataWeekOptions({
      historicalWeeks: dataSectionWeeks,
      currentWeekOpenUtc,
    }) as string[];
    const multiWeek = await computeMultiWeekHold(biasSource, weekOptions, entryStyle);

    // Compute path-true metrics for sidebar DD
    const { buildWeeklyHoldLedger } = await import("@/lib/performance/positionLedger");
    const { loadPathBars } = await import("@/lib/performance/pathBarLoader");
    const { computeBasketPath, computeMultiWeekBasketPath } = await import("@/lib/performance/basketPathEngine");
    const realizedWeeks = multiWeek.weeks.filter((w) => w.isRealized);
    const weekPathResults = [];
    for (const weekResult of realizedWeeks) {
      const ledger = await buildWeeklyHoldLedger(weekResult, { entryStyleId: entryStyle?.id });
      const symbols = ledger.legs.map((leg) => leg.symbol);
      const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc);
      weekPathResults.push(computeBasketPath(ledger, bars));
    }
    const pathSummary = weekPathResults.length > 0
      ? computeMultiWeekBasketPath(weekPathResults).summary
      : null;

    const { weeklyHoldToSidebarStatsWithPath } = await import("@/lib/performance/engineAdapter");
    const stats = weeklyHoldToSidebarStatsWithPath(result, biasSource, multiWeek, pathSummary);
    return NextResponse.json(stats);
```

**Why dynamic imports:** The engine-stats route currently doesn't import any path engine code. Using dynamic `import()` keeps the cold-start fast when path engine isn't needed, and avoids circular dependency risks. All imports are from existing, verified modules.

**Performance:** The path bar loader caches results for 15 seconds. If the sidebar API is called shortly after a page load (which already ran the path engine), the H1 bars are cache-warm. Worst case (cold): ~10 SQL queries for 10 weeks, each hitting a single indexed table. Sub-second.

---

## Step 4: Bump Artifact Version

### File: `src/lib/performance/strategyPageData.ts`

Phase 2 already bumped to `v20`. Bump again to `v21` so cached artifacts with stale sidebar stats are invalidated:

```typescript
// BEFORE:
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v20";

// AFTER:
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v21";
```

---

## What This Does NOT Change (By Design)

1. **Grid card weekly returns and win rates** — these come from `WeeklyHoldResult.totalReturnPct` which already matches path-engine totals exactly (±0.00%). No change needed.

2. **Grid card `diagnostics.max_drawdown`** — currently `null` for all cards, not rendered. Populating it with path DD per slot would require per-slot path computation (running separate path engines for Tier 1/2/3). Out of scope. Can be added later if needed.

3. **`PerformanceComparisonPanel`** — reads from `canonicalPerformanceReport.ts` which reads from `comprehensive-reconstruction.json`. This is a static historical dataset. To update it with path metrics, regenerate the JSON with path-engine DD (separate task, after this migration). The comparison panel will automatically show path-true DD once the JSON is regenerated.

4. **Research scripts** — `scripts/verify-path-engine.ts` etc. remain unchanged. They have their own path engine integration.

5. **`computeMultiWeekHold()`** — the weekly-close engine function stays as-is. It remains available as a fallback and as the source of weekly return totals (which are still correct). The path engine supplements it with DD/peak/giveback.

6. **UI components** — zero component file changes. All metrics flow through typed adapter functions.

---

## Future Resolution Upgrade Path

When upgrading from `1h` to `5m`:

1. Backfill `canonical_price_bars` with 5m bars for all instruments
2. Add 5m ingestion to the canonical-refresh cron
3. Change `CANONICAL_PATH_RESOLUTION` from `"1h"` to `"5m"` in `pathResolution.ts`
4. Bump artifact version

That's it. No consumer code changes. The path engine, adapter, sidebar, grid, chart — all resolution-agnostic. They process whatever points the loader returns.

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/performance/pathResolution.ts` | **CREATE** — single resolution config |
| `src/lib/performance/pathBarLoader.ts` | **MODIFY** — import default resolution from config |
| `src/lib/performance/engineAdapter.ts` | **MODIFY** — add `weeklyHoldToSidebarStatsWithPath()` |
| `src/lib/performance/strategyPageData.ts` | **MODIFY** — add `pathSummary` to type + return, use path-aware sidebar builder, remove hardcoded `"1h"` |
| `src/app/api/performance/engine-stats/route.ts` | **MODIFY** — compute path summary, use path-aware sidebar builder |

**4 files modified. 1 file created.**

---

## Validation Checklist

1. [ ] `pathResolution.ts` exists with `CANONICAL_PATH_RESOLUTION = "1h"`
2. [ ] `pathBarLoader.ts` imports default resolution from config
3. [ ] `strategyPageData.ts` no longer passes hardcoded `"1h"` to `loadPathBars()`
4. [ ] `StrategyPageData` type includes `pathSummary: BasketPathSummary | null`
5. [ ] `assembleStrategyPageData()` computes and returns `pathSummary`
6. [ ] `weeklyHoldToSidebarStatsWithPath()` exists in `engineAdapter.ts`
7. [ ] `weeklyHoldToSidebarStatsWithPath()` overrides `allTime.maxDrawdownPct` with path DD
8. [ ] `strategyPageData.ts` uses `weeklyHoldToSidebarStatsWithPath()` for sidebar stats
9. [ ] `engine-stats/route.ts` computes path summary and uses `weeklyHoldToSidebarStatsWithPath()`
10. [ ] Artifact version bumped to `v21`
11. [ ] `npm run build` passes
12. [ ] `npm run lint` passes
13. [ ] Dev server: sidebar "Max DD" shows path-true DD (e.g., `-19.82%` for Dealer, not `0.00%`)
14. [ ] Dev server: sidebar "Total Return" unchanged (still matches weekly-close)
15. [ ] Dev server: simulation chart still renders path-true curves (Phase 2 intact)
16. [ ] Sign convention: sidebar DD displays consistently with previous behavior (negative = drawdown)

---

## Important Warnings

1. **Do NOT modify `basketPathEngine.ts`, `positionLedger.ts`, or `verify-path-engine.ts`.** Phase 1 is locked.

2. **Do NOT modify any UI component files.** The migration happens entirely in the data/adapter layer.

3. **Do NOT remove `weeklyHoldToSidebarStats()`.** It stays as the base function. The new `weeklyHoldToSidebarStatsWithPath()` calls it and overrides DD. Other code may still call the original.

4. **Do NOT remove `computeMultiWeekHold()`.** It remains the source of weekly return totals, trade counts, and win rates. The path engine supplements it with DD/peak/giveback — it does not replace the return computation.

5. **Check the DD sign convention** by reading how `StrategySidebar.tsx` displays `allTime.maxDrawdownPct` before deciding the sign of the path DD override. Match whatever the sidebar already expects.

6. **File header standard applies** to the new `pathResolution.ts` file and any new code added to modified files.

7. **The `PerformanceComparisonPanel` DD** comes from `comprehensive-reconstruction.json`, not the live engine. It will still show weekly-close DD until the reconstruction JSON is regenerated. This is acceptable — it's a separate static data source. Note it in the commit message.

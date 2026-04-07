# CODEX: Phase 2 — Wire Path Engine Into Performance Simulation

**Date:** 2026-04-07
**Depends on:** Phase 1 anchor reconciliation (PASS — verified 2026-04-07)
**Goal:** Replace the straight-line weekly equity curves on the Performance page with path-true H1-resolution curves from the basket path engine. Update simulation metrics to use path-true Max DD, Peak, and Giveback.

---

## Context

The Performance page currently shows equity curves built from **one data point per week** — a straight line from 0% to the week's total return. This hides all intraweek price movement.

Phase 1 built and verified a path engine that produces **~168 data points per week** (hourly resolution) while matching weekly-close total returns exactly (±0.00%). Phase 2 wires this into the live app.

---

## Architecture: Where Path Data Plugs In

Current simulation data flow:

```
weeklyHoldEngine → WeeklyHoldResult[]
  → engineAdapter.ts → singleWeekToSimulation() / multiWeekToSimulation()
    → EngineSimulationGroup { series: [{ points: [{ ts_utc, equity_pct }] }] }
      → strategyPageData.ts → simMap
        → PerformanceSimulationSection → EquityCurveChart (SVG)
```

Phase 2 adds a parallel path:

```
weeklyHoldEngine → WeeklyHoldResult[]
  → positionLedger → WeekPositionLedger[]
    → pathBarLoader → PathBarMap
      → basketPathEngine → BasketPathResult[]
        → NEW: pathToSimulation() in engineAdapter.ts
          → EngineSimulationGroup (with ~168 points/week)
            → simMap (replaces old straight-line entries)
```

**The chart component (`EquityCurveChart.tsx`) and the simulation UI component (`PerformanceSimulationSection.tsx`) need ZERO changes.** They already handle arbitrary point density. The only changes are in the data pipeline.

---

## Step 1: Add Path-to-Simulation Adapter Functions

### File: `src/lib/performance/engineAdapter.ts`

Add two new exported functions alongside the existing `singleWeekToSimulation()` and `multiWeekToSimulation()`.

#### 1a. `singleWeekPathToSimulation()`

Converts a single-week `BasketPathResult` into an `EngineSimulationGroup` for the single-week simulation view.

```typescript
import type { BasketPathResult } from "@/lib/performance/basketPathEngine";
import { computeMultiWeekBasketPath } from "@/lib/performance/basketPathEngine";
```

Add this function after `singleWeekToSimulation()` (after line 527):

```typescript
export function singleWeekPathToSimulation(
  pathResult: BasketPathResult,
  biasSource: BiasSourceConfig,
  weekLabel: string,
  selectionLabel = "Weekly Hold",
): EngineSimulationGroup {
  const points = pathResult.points.map((point) => ({
    ts_utc: point.tsUtc,
    equity_pct: point.equityPct,
    lock_pct: null,
  }));

  return {
    title: buildExecutionLabel(biasSource, selectionLabel),
    description: `Path-true equity curve for ${weekLabel}. Resolution: ${pathResult.resolution}.`,
    metrics: {
      returnPct: pathResult.summary.totalReturnPct,
      maxDrawdownPct: pathResult.summary.maxDrawdownPct,
      trades: null,
    },
    series: [
      {
        id: "total",
        label: "Total",
        color: "#ffffff",
        points,
      },
    ],
  };
}
```

**Note:** Single-week path view shows only the "Total" basket series (not per-slot breakdown). Per-slot path breakdown would require running separate path engines per card slot, which is out of scope for Phase 2. The total basket curve is the most valuable view — it shows the real intraweek journey of the combined portfolio.

#### 1b. `multiWeekPathToSimulation()`

Converts multi-week path results into an `EngineSimulationGroup` for the "All weeks" simulation view.

Add this function after `multiWeekToSimulation()` (after line 585):

```typescript
export function multiWeekPathToSimulation(
  weekPathResults: BasketPathResult[],
  biasSource: BiasSourceConfig,
  selectionLabel = "Weekly Hold",
): EngineSimulationGroup {
  const multiWeekPath = computeMultiWeekBasketPath(weekPathResults);
  const points = multiWeekPath.points.map((point) => ({
    ts_utc: point.tsUtc,
    equity_pct: point.equityPct,
    lock_pct: null,
  }));

  return {
    title: buildExecutionLabel(biasSource, selectionLabel),
    description: `Path-true cumulative equity across ${weekPathResults.length} weeks. Resolution: 1h.`,
    metrics: {
      returnPct: multiWeekPath.summary.totalReturnPct,
      maxDrawdownPct: multiWeekPath.summary.maxDrawdownPct,
      trades: null,
    },
    series: [
      {
        id: "total",
        label: "Total",
        color: "#ffffff",
        points,
      },
    ],
  };
}
```

---

## Step 2: Compute Path Results in Strategy Page Data Loader

### File: `src/lib/performance/strategyPageData.ts`

#### 2a. Add imports

At the top of the file, add:

```typescript
import { buildWeeklyHoldLedger } from "@/lib/performance/positionLedger";
import { loadPathBars } from "@/lib/performance/pathBarLoader";
import { computeBasketPath, type BasketPathResult } from "@/lib/performance/basketPathEngine";
import {
  singleWeekPathToSimulation,
  multiWeekPathToSimulation,
} from "@/lib/performance/engineAdapter";
```

Also add `multiWeekPathToSimulation` and `singleWeekPathToSimulation` to the existing engineAdapter import if you prefer to keep imports merged. Either approach is fine.

#### 2b. Modify `assembleStrategyPageData()` to compute path simulations

The function is at line 428. Inside the `for (const weekResult of orderedWeeks)` loop (line 445), after building the old straight-line simulation, also build the path simulation.

Replace the loop and simMap construction (lines 440-453) with:

```typescript
  const multiWeekResult = buildMultiWeekResultFromWeeks(biasSource, orderedWeeks);
  const weekMap: Record<string, EngineGridProps> = {};
  const simMap: Record<string, EngineSimulationGroup> = {};
  const nextWeekResults: Record<string, WeeklyHoldResult> = {};
  const weekPathResults: BasketPathResult[] = [];

  for (const weekResult of orderedWeeks) {
    const label = weekDisplayLabel(weekResult.weekOpenUtc);
    weekMap[weekResult.weekOpenUtc] = weeklyHoldToGridProps(weekResult, biasSource, label, selectionLabel);
    nextWeekResults[weekResult.weekOpenUtc] = weekResult;

    // Build path-true simulation for this week
    const ledger = await buildWeeklyHoldLedger(weekResult, { entryStyleId: entryStyle?.id });
    const symbols = ledger.legs.map((leg) => leg.symbol);
    const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc, "1h");
    const pathResult = computeBasketPath(ledger, bars);
    weekPathResults.push(pathResult);

    simMap[weekResult.weekOpenUtc] = singleWeekPathToSimulation(pathResult, biasSource, label, selectionLabel);
  }

  weekMap.all = multiWeekToGridProps(multiWeekResult, biasSource, selectionLabel);
  simMap.all = multiWeekPathToSimulation(weekPathResults, biasSource, selectionLabel);
```

**Key changes from original:**
1. `singleWeekToSimulation()` calls are replaced with `singleWeekPathToSimulation()` — curves go from 2 points to ~168 points per week
2. `multiWeekToSimulation()` call is replaced with `multiWeekPathToSimulation()` — "All weeks" curve goes from N points (one per week) to N×168 points
3. The weekly-close grid (`weekMap`) and sidebar stats remain unchanged — they still use `WeeklyHoldResult` data. Only the simulation curves change.

#### 2c. Make `assembleStrategyPageData()` async

The function is currently synchronous (line 428):

```typescript
function assembleStrategyPageData(options: {
```

It needs to become `async` because `buildWeeklyHoldLedger()` and `loadPathBars()` are async:

```typescript
async function assembleStrategyPageData(options: {
```

Then update the return type. Search for every call site of `assembleStrategyPageData` in this file and add `await`:

The function is called in two places:
1. Line ~390 area (inside `loadStrategyPageData()`) — this function is already async, so just add `await`
2. Any other call site — add `await`

Search for `assembleStrategyPageData(` in the file and add `await` before each call.

---

## Step 3: Update Simulation Metrics Display

### File: `src/components/performance/PerformanceSimulationSection.tsx`

**No changes needed to this file.** The component already renders `maxDrawdownPct` from the metrics object. With the path engine, this value is now path-true (e.g., 19.82% for Dealer instead of 0.00%). The UI automatically shows the correct number.

### File: `src/components/research/EquityCurveChart.tsx`

**No changes needed to this file.** The chart renders whatever points it receives. Dense hourly points will produce smooth curves instead of straight lines.

---

## Step 4: Add Path Metrics to Sidebar Stats (Optional Enhancement)

### File: `src/lib/performance/engineAdapter.ts`

The `EngineSidebarStats.allTime` object (line 599-609) currently includes `maxDrawdownPct` from the weekly-close engine. To show the path-true DD in the sidebar, you could add a `pathMaxDrawdownPct` field.

**This is optional for Phase 2.** The simulation chart already shows path-true DD in the metrics panel below it. Adding it to the sidebar is a nice-to-have but adds complexity (the sidebar stats builder would also need path data). **Skip this unless trivial to add.**

---

## Performance Considerations

### H1 bar loading

Each week loads H1 bars for ~36 symbols. The `loadPathBars()` function does a single SQL query per call (batched by symbol array) and caches results for 15 seconds via `getOrSetRuntimeCache`. For 10 weeks, that's 10 SQL queries.

**This is acceptable for server-side rendering.** The Performance page is already a server component that runs multiple DB queries. Adding 10 more cached queries is marginal.

### Computation cost

`computeBasketPath()` iterates ~168 grid points × ~36 legs = ~6,048 operations per week. For 10 weeks, that's ~60,480 operations. This is trivial — sub-millisecond.

### Data size

Multi-week "All" curve: 10 weeks × ~168 points = ~1,680 points. Each point is `{ ts_utc, equity_pct, lock_pct }` ≈ 60 bytes. Total: ~100KB. Negligible for server → client transfer.

### Caching

The `pathBarLoader` already caches for 15 seconds. For historical weeks (which never change), this is sufficient since the page itself caches via Next.js ISR/SSR patterns. If performance becomes an issue later, increase the `PATH_BAR_LOADER_CACHE_TTL_MS` env var for historical data, or add a longer-lived cache layer. **Do not add any new caching logic in Phase 2.**

---

## Validation Checklist

1. [ ] `singleWeekPathToSimulation()` added to `engineAdapter.ts` and exported
2. [ ] `multiWeekPathToSimulation()` added to `engineAdapter.ts` and exported
3. [ ] `assembleStrategyPageData()` computes path results and uses path simulation functions
4. [ ] `assembleStrategyPageData()` is `async` and all call sites `await` it
5. [ ] `npm run build` passes
6. [ ] `npm run lint` passes
7. [ ] Dev server starts and Performance page loads without errors
8. [ ] Single-week simulation shows a smooth hourly equity curve (not a straight line)
9. [ ] "All weeks" simulation shows a continuous hourly equity curve across all weeks
10. [ ] Max DD metric in the simulation panel shows path-true DD (not weekly-close DD)
11. [ ] Grid cards, sidebar stats, and other non-simulation sections are unchanged

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/performance/engineAdapter.ts` | **MODIFY** — add `singleWeekPathToSimulation()` and `multiWeekPathToSimulation()`, add imports |
| `src/lib/performance/strategyPageData.ts` | **MODIFY** — compute path results in `assembleStrategyPageData()`, make it async, replace sim builders |

**2 files modified. 0 files created.**

---

## Important Warnings

1. **Do NOT modify `basketPathEngine.ts`, `positionLedger.ts`, or `pathBarLoader.ts`.** Phase 1 is verified and locked.

2. **Do NOT modify `PerformanceSimulationSection.tsx` or `EquityCurveChart.tsx`.** The UI components are already compatible with dense point arrays.

3. **Do NOT add per-slot (Tier 1/2/3) path breakdown in Phase 2.** The single "Total" basket curve is the right first step. Per-slot paths would require splitting the ledger by card slot and running separate path engines — that's Phase 3 scope if needed at all.

4. **The `weekMap` (grid cards) and `sidebarStats` must remain unchanged.** They continue to use weekly-close data. Only `simMap` switches to path engine data.

5. **The `trades` metric in path simulation is `null`** because the path engine doesn't track trade counts — it tracks positions. The trade count is already shown in the grid cards. Don't try to populate it from the path engine.

6. **File header standard applies** to any new code added to modified files.

7. **Keep the old `singleWeekToSimulation()` and `multiWeekToSimulation()` functions in `engineAdapter.ts`.** They are not deleted — they may still be used by other code paths (e.g., the Performance page's historical reconstruction view that reads from `comprehensive-reconstruction.json`). Only the `strategyPageData.ts` call sites switch to the new path versions.

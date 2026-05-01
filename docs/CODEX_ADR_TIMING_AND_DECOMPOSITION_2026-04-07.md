# CODEX: ADR Path Timing Fix + Simulation Decomposition Restore

**Date:** 2026-04-07
**Problems:**
1. ADR Pullback shows 100%+ phantom drawdown because the position ledger stamps all trades with week open/close times, ignoring actual entry/exit times
2. Compare/Isolate is broken because the path simulation emits a single "Equity" series instead of per-slot breakdown (Tier 1/2/3, asset class, per-model)

**Goal:** Fix ADR trade timing in the ledger, restore per-slot path decomposition in simulation

---

## Part 1: ADR Path Timing Fix

### Root Cause

`positionLedger.ts` line 81-82 hardcodes:
```typescript
entryTimeUtc: result.weekOpenUtc,
exitTimeUtc: weekCloseUtc,
```

For Weekly Hold, this is correct — trades are open Sunday to Sunday. For ADR Pullback, trades have specific `detail.entryTimeUtc` (e.g., Tuesday 14:30) and `detail.exitTimeUtc` (e.g., Tuesday 20:15). The path engine marks these positions across the entire week's hourly grid, capturing 7 days of price volatility for an 18-hour trade. This creates phantom drawdown.

### Fix

**File: `src/lib/performance/positionLedger.ts`**

Change lines 81-82:

```typescript
// BEFORE:
      entryTimeUtc: result.weekOpenUtc,
      exitTimeUtc: weekCloseUtc,

// AFTER:
      entryTimeUtc: trade.detail?.entryTimeUtc ?? result.weekOpenUtc,
      exitTimeUtc: trade.detail?.exitTimeUtc ?? weekCloseUtc,
```

That's it. `trade.detail` is only present on ADR/stoch trades (line 65 of `weeklyHoldEngine.ts`). Weekly Hold trades have `detail: undefined`, so the fallback to `result.weekOpenUtc` / `weekCloseUtc` is correct.

### Validation

After this fix:
- Weekly Hold DD numbers should be unchanged (no `detail` on those trades)
- ADR Pullback DD should drop significantly (trades are now marked only during their actual holding period)
- The path engine still anchors entry/exit to `entryPrice`/`exitPrice` at the correct timestamps

---

## Part 2: Simulation Decomposition Restore

### Root Cause

Phase 2 path adapters (`singleWeekPathToSimulation`, `multiWeekPathToSimulation`) emit a single "Equity" series. The old adapters (`singleWeekToSimulation`, `multiWeekToSimulation`) emitted per-slot series using `slotTrades()` — one curve per tier/asset-class/model plus a "Total" curve. The chart's Compare/Isolate buttons need multiple series to function.

### Architecture

To decompose the path by slot, we need to:
1. Split the position ledger into sub-ledgers per slot
2. Run `computeBasketPath()` on each sub-ledger
3. Emit each sub-path as a separate series alongside the total

This requires the `PositionLeg` to carry `source` and `tier` fields so legs can be grouped by the same logic as `slotTrades()`.

### Step 2a: Add `source` and `tier` to PositionLeg

**File: `src/lib/performance/positionLedger.ts`**

Add `source` and `tier` to the `PositionLeg` type:

```typescript
// BEFORE:
export type PositionLeg = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  entryTimeUtc: string;
  exitTimeUtc: string;
  weight: number;
  adrMultiplier: number;
  entryPrice: number;
  exitPrice: number;
  strategyId: string;
  entryStyleId: string;
};

// AFTER:
export type PositionLeg = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  entryTimeUtc: string;
  exitTimeUtc: string;
  weight: number;
  adrMultiplier: number;
  entryPrice: number;
  exitPrice: number;
  strategyId: string;
  entryStyleId: string;
  source: string;
  tier: number | null;
};
```

Populate in `buildWeeklyHoldLedger()` (inside the map at line 77-92):

```typescript
      source: trade.source,
      tier: trade.tier,
```

### Step 2b: Add slot-based ledger splitting

**File: `src/lib/performance/positionLedger.ts`**

Add a utility function that splits a `WeekPositionLedger` by a grouping function, returning sub-ledgers that the path engine can process independently:

```typescript
export function splitLedgerBySlot(
  ledger: WeekPositionLedger,
  slotFn: (leg: PositionLeg) => number,
  slotCount: number,
): WeekPositionLedger[] {
  const slotLedgers: WeekPositionLedger[] = [];
  for (let i = 0; i < slotCount; i++) {
    slotLedgers.push({
      weekOpenUtc: ledger.weekOpenUtc,
      weekCloseUtc: ledger.weekCloseUtc,
      strategyId: ledger.strategyId,
      entryStyleId: ledger.entryStyleId,
      legs: ledger.legs.filter((leg) => slotFn(leg) === i),
    });
  }
  return slotLedgers;
}
```

### Step 2c: Add slot grouping functions

**File: `src/lib/performance/engineAdapter.ts`**

Add leg-level grouping functions that mirror the existing trade-level `slotTrades()` logic:

```typescript
import type { PositionLeg } from "@/lib/performance/positionLedger";

function legSlotByAssetClass(leg: PositionLeg): number {
  if (leg.assetClass === "fx") return 0;
  if (leg.assetClass === "commodities" || leg.assetClass === "indices") return 1;
  if (leg.assetClass === "crypto") return 2;
  return 0;
}

function legSlotByTier(leg: PositionLeg): number {
  if (leg.tier === 1) return 0;
  if (leg.tier === 2) return 1;
  if (leg.tier === 3) return 2;
  return 0;
}

function legSlotByModel(leg: PositionLeg, models: readonly PerformanceModel[]): number {
  const idx = models.indexOf(leg.source as PerformanceModel);
  return idx >= 0 ? idx : 0;
}

function resolveLegSlotFn(
  breakdown: BiasSourceConfig["cardBreakdown"],
  models: readonly PerformanceModel[],
): (leg: PositionLeg) => number {
  switch (breakdown) {
    case "asset_class":
      return legSlotByAssetClass;
    case "tiers":
      return legSlotByTier;
    case "per_model":
      return (leg) => legSlotByModel(leg, models);
  }
}
```

### Step 2d: Update path simulation adapters to emit per-slot series

**File: `src/lib/performance/engineAdapter.ts`**

Modify `singleWeekPathToSimulation()` to accept sub-paths and emit per-slot series:

```typescript
export function singleWeekPathToSimulation(
  path: BasketPathResult,
  result: WeeklyHoldResult,
  biasSource: BiasSourceConfig,
  weekLabel: string,
  selectionLabel = "Weekly Hold",
  slotPaths?: BasketPathResult[],
): EngineSimulationGroup {
  const cardSlots = resolveCardSlots(biasSource);
  const labels = getLabels(biasSource.cardBreakdown);
  const slotLabels = cardSlots.map((slot) => labels[slot]);

  const totalSeries = {
    id: "equity",
    label: "Total",
    color: "#ffffff",
    points: pathPointsToSimulationPoints(path.points),
  };

  const slotSeries = (slotPaths ?? []).map((slotPath, i) => ({
    id: cardSlots[i] ?? `slot-${i}`,
    label: slotLabels[i] ?? `Slot ${i + 1}`,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    points: pathPointsToSimulationPoints(slotPath.points),
  }));

  return {
    title: buildExecutionLabel(biasSource, selectionLabel),
    description: `Hourly equity path for ${weekLabel}.`,
    metrics: {
      returnPct: path.summary.totalReturnPct,
      maxDrawdownPct: path.summary.maxDrawdownPct,
      trades: result.tradeCount,
    },
    series: [totalSeries, ...slotSeries],
  };
}
```

Apply the same pattern to `multiWeekPathToSimulation()`:

```typescript
export function multiWeekPathToSimulation(
  path: MultiWeekPathAggregate,
  result: MultiWeekResult,
  biasSource: BiasSourceConfig,
  selectionLabel = "Weekly Hold",
  slotPaths?: MultiWeekPathAggregate[],
): EngineSimulationGroup {
  const cardSlots = resolveCardSlots(biasSource);
  const labels = getLabels(biasSource.cardBreakdown);
  const slotLabels = cardSlots.map((slot) => labels[slot]);

  const totalSeries = {
    id: "equity",
    label: "Total",
    color: "#ffffff",
    points: pathPointsToSimulationPoints(path.points),
  };

  const slotSeries = (slotPaths ?? []).map((slotPath, i) => ({
    id: cardSlots[i] ?? `slot-${i}`,
    label: slotLabels[i] ?? `Slot ${i + 1}`,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    points: pathPointsToSimulationPoints(slotPath.points),
  }));

  return {
    title: buildExecutionLabel(biasSource, selectionLabel),
    description: `Continuous hourly equity path across ${result.weeks.length} weeks.`,
    metrics: {
      returnPct: path.summary.totalReturnPct,
      maxDrawdownPct: path.summary.maxDrawdownPct,
      trades: result.totalTrades,
    },
    series: [totalSeries, ...slotSeries],
  };
}
```

### Step 2e: Compute per-slot paths in `buildSimulationMapFromWeekResults()`

**File: `src/lib/performance/strategyPageData.ts`**

In `buildSimulationMapFromWeekResults()`, after computing the total path for each week, also compute per-slot sub-paths:

```typescript
import { splitLedgerBySlot } from "@/lib/performance/positionLedger";
```

Inside the per-week loop, after computing `path = computeBasketPath(ledger, bars)`:

```typescript
      const path = computeBasketPath(ledger, bars);

      // Compute per-slot decomposition paths
      const cardSlots = resolveCardSlots(biasSource);
      const slotFn = resolveLegSlotFn(biasSource.cardBreakdown, cardSlots);
      const subLedgers = splitLedgerBySlot(ledger, slotFn, cardSlots.length);
      const slotPaths = subLedgers.map((subLedger) => computeBasketPath(subLedger, bars));

      simMap[weekResult.weekOpenUtc] = singleWeekPathToSimulation(
        path, weekResult, biasSource, label, selectionLabel, slotPaths,
      );
```

For the multi-week "all" path, compute per-slot multi-week aggregates:

```typescript
      // After computing multiWeekPath for total:
      const multiWeekPath = computeMultiWeekBasketPath(realizedWeekPaths);

      // Compute per-slot multi-week paths
      const slotMultiWeekPaths = cardSlots.map((_, slotIndex) => {
        const slotWeekPaths = realizedSlotPaths[slotIndex] ?? [];
        return computeMultiWeekBasketPath(slotWeekPaths);
      });

      simMap.all = multiWeekPathToSimulation(
        multiWeekPath, multiWeekResult, biasSource, selectionLabel, slotMultiWeekPaths,
      );
```

To collect `realizedSlotPaths`, add tracking alongside `realizedWeekPaths`:

```typescript
  const realizedWeekPaths: BasketPathResult[] = [];
  const realizedSlotPaths: BasketPathResult[][] = Array.from(
    { length: resolveCardSlots(biasSource).length },
    () => [],
  );
```

And inside the per-week loop, when pushing to `realizedWeekPaths`:

```typescript
      if (weekResult.isRealized) {
        realizedWeekPaths.push(path);
        for (let slotIndex = 0; slotIndex < slotPaths.length; slotIndex++) {
          realizedSlotPaths[slotIndex].push(slotPaths[slotIndex]);
        }
      }
```

### Step 2f: Export `resolveLegSlotFn` and `resolveCardSlots`

If `resolveCardSlots` and `resolveLegSlotFn` are called from `strategyPageData.ts`, they need to be exported from `engineAdapter.ts`. Export them:

```typescript
export function resolveCardSlots(...) { ... }
export function resolveLegSlotFn(...) { ... }
```

Alternatively, if you prefer to keep them private, move the per-slot path computation into a new adapter function that `strategyPageData.ts` calls. Either approach works — use whichever is cleaner.

---

## Performance Impact of Per-Slot Paths

Each week now runs `computeBasketPath()` 1 (total) + 3 (slots) = 4 times instead of 1. The function is pure CPU (no DB queries) — it iterates ~168 grid points × ~36 legs per call. Adding 3 more calls with ~12 legs each is negligible. The DB cost is zero — bars are already loaded for the total path.

For 10 weeks: 10 × 3 extra path computations = 30 calls × ~168 × ~12 = ~60,480 operations. Sub-millisecond total.

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/performance/positionLedger.ts` | **MODIFY** — fix entry/exit times for ADR trades, add `source`/`tier` fields, add `splitLedgerBySlot()` |
| `src/lib/performance/engineAdapter.ts` | **MODIFY** — add leg slot functions, update path simulation adapters to emit per-slot series |
| `src/lib/performance/strategyPageData.ts` | **MODIFY** — compute per-slot paths alongside total paths |

**3 files modified. 0 files created.**

---

## Validation Checklist

1. [ ] ADR Pullback trades use `trade.detail.entryTimeUtc` / `exitTimeUtc` in the ledger
2. [ ] Weekly Hold trades still use `result.weekOpenUtc` / `weekCloseUtc` (fallback)
3. [ ] `PositionLeg` type includes `source: string` and `tier: number | null`
4. [ ] `buildWeeklyHoldLedger()` populates `source` and `tier` from the trade
5. [ ] `splitLedgerBySlot()` exported from positionLedger.ts
6. [ ] Per-slot path series emitted by `singleWeekPathToSimulation()` and `multiWeekPathToSimulation()`
7. [ ] Compare/Isolate buttons work in the chart — multiple series visible
8. [ ] Total series is white (#ffffff), slot series use SERIES_COLORS
9. [ ] Weekly Hold Dealer DD unchanged (~19.82%)
10. [ ] ADR Pullback DD drops significantly from 100%+
11. [ ] `npm run build` and `npm run lint` pass
12. [ ] Artifact version bumped to `v22`

---

## Important Warnings

1. **Do NOT modify `basketPathEngine.ts`.** The path engine is verified and locked. Per-slot paths are computed by splitting the ledger and running the same engine on sub-ledgers.

2. **Do NOT modify `EquityCurveChart.tsx` or `PerformanceSimulationSection.tsx`.** The chart already handles multiple series with Compare/Isolate.

3. **The per-slot paths will NOT sum to the total path exactly** at each timestamp, because the path engine tracks peak/drawdown independently per sub-ledger. The equity values will sum correctly (basket equity is additive), but the per-slot DD metrics won't sum to total DD (drawdown is not additive). This is correct and expected.

4. **Bump artifact version to `v22`** so cached artifacts without per-slot paths get invalidated.

5. **The fallback code paths** (catch blocks in `buildSimulationMapFromWeekResults`) should fall back to the old `singleWeekToSimulation` which already emits per-slot series from weekly-close data. This is the safe fallback.

6. **File header standard applies** to any new code.

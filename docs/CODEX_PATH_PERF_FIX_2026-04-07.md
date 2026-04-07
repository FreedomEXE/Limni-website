# CODEX: Path Engine Performance Fix

**Date:** 2026-04-07
**Problem:** Strategy switching takes forever — path engine recomputes H1 bar data for all weeks on every page load, even when cached
**Goal:** Ensure path computation happens once per strategy, gets cached in the artifact, and is reused on subsequent loads

---

## Root Cause

`loadStrategyPageData()` calls `buildStrategyPageDataFromWeekResults()` multiple times per request. Before the path engine, this was fast (array slotting). Now each call runs `buildSimulationMapFromWeekResults()` which does sequential DB queries for H1 bars across all 10+ weeks (~10 SQL queries per call).

**Worst case (first load after v21 bump = right now):**
1. Line 220: `buildStrategyPageDataFromWeekResults()` → full path computation → ~10 DB queries
2. Line 228: persist artifact
3. Line 239: `buildStrategyPageDataFromWeekResults()` again → full path computation again → ~10 more DB queries

**Best case (cache hit, no changed weeks):**
1. Cache hit at line 146 — but nothing changed, so falls through to line 190
2. Line 195: `buildStrategyPageDataFromWeekResults()` → full path computation → ~10 DB queries

Even on a perfect cache hit with zero changed weeks, the path engine runs for ALL weeks just to add the current week to the response.

---

## Fix: Cache-Aware Path Computation

### Principle

The artifact cache already stores `simMap` and `pathSummaryMap`. When historical weeks haven't changed, reuse the cached path data. Only compute path data for:
1. The current (unrealized) week — always fresh
2. Any weeks that changed (per watermark diff)
3. All weeks on cold cache (first load)

### File: `src/lib/performance/strategyPageData.ts`

#### Change 1: Extract `buildStrategyPageDataFromWeekResults` into a lightweight assembler

Split the function into two concerns:
- **`buildSimulationMapFromWeekResults()`** — expensive (DB queries). Call only when needed.
- **`assembleStrategyPageData()`** — cheap (slotting + assembly). Call freely with pre-built sim/path data.

Create a new lightweight assembler that takes pre-built sim and path data:

```typescript
function assembleStrategyPageData(options: {
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  weekOptions: string[];
  weekResultsByWeek: Record<string, WeeklyHoldResult>;
  simMap: Record<string, EngineSimulationGroup>;
  pathSummaryMap: Record<string, BasketPathSummary>;
}): StrategyPageData {
  const { biasSource, currentWeekOpenUtc, entryStyle, weekOptions, weekResultsByWeek, simMap, pathSummaryMap } = options;
  const selectionLabel = entryStyle?.label ?? "Weekly Hold";
  const orderedWeeks = weekOptions
    .map((weekOpenUtc) => weekResultsByWeek[weekOpenUtc])
    .filter((weekResult): weekResult is WeeklyHoldResult => Boolean(weekResult));

  const multiWeekResult = buildMultiWeekResultFromWeeks(biasSource, orderedWeeks);
  const weekMap: Record<string, EngineGridProps> = {};

  for (const weekResult of orderedWeeks) {
    const label = weekDisplayLabel(weekResult.weekOpenUtc);
    weekMap[weekResult.weekOpenUtc] = weeklyHoldToGridProps(weekResult, biasSource, label, selectionLabel);
  }
  weekMap.all = multiWeekToGridProps(multiWeekResult, biasSource, selectionLabel);

  const currentWeekResult =
    weekResultsByWeek[currentWeekOpenUtc] ??
    orderedWeeks[0] ??
    {
      weekOpenUtc: currentWeekOpenUtc,
      biasSourceId: biasSource.id,
      trades: [],
      totalReturnPct: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      tradeCount: 0,
      signals: [],
      isRealized: false,
    };

  return {
    weekMap,
    simMap,
    pathSummaryMap,
    multiWeekResult,
    weekResults: weekResultsByWeek,
    sidebarStats: weeklyHoldToSidebarStatsWithPath(currentWeekResult, biasSource, {
      multiWeek: multiWeekResult,
      currentWeekPathSummary: pathSummaryMap[currentWeekResult.weekOpenUtc] ?? null,
      multiWeekPathSummary: pathSummaryMap.all ?? null,
    }),
    biasSource,
    entryStyle,
    weekOptions,
    currentWeekOpenUtc,
  };
}
```

Keep the existing `buildStrategyPageDataFromWeekResults()` but have it call the new assembler:

```typescript
async function buildStrategyPageDataFromWeekResults(options: {
  biasSource: BiasSourceConfig;
  currentWeekOpenUtc: string;
  entryStyle: EntryStyleConfig | undefined;
  weekOptions: string[];
  weekResultsByWeek: Record<string, WeeklyHoldResult>;
}): Promise<StrategyPageData> {
  const { biasSource, entryStyle, weekOptions, weekResultsByWeek } = options;
  const selectionLabel = entryStyle?.label ?? "Weekly Hold";
  const orderedWeeks = weekOptions
    .map((weekOpenUtc) => weekResultsByWeek[weekOpenUtc])
    .filter((weekResult): weekResult is WeeklyHoldResult => Boolean(weekResult));
  const multiWeekResult = buildMultiWeekResultFromWeeks(biasSource, orderedWeeks);

  const { simMap, pathSummaryMap } = await buildSimulationMapFromWeekResults({
    biasSource,
    entryStyle,
    selectionLabel,
    orderedWeeks,
    multiWeekResult,
  });

  return assembleStrategyPageData({
    ...options,
    simMap,
    pathSummaryMap,
  });
}
```

#### Change 2: Reuse cached path data in `loadStrategyPageData()`

**Cache hit, no changed weeks (the common case):**

At lines 190-201, instead of calling `buildStrategyPageDataFromWeekResults()`, reuse the cached `simMap` and `pathSummaryMap`, and only compute path for the current week:

```typescript
      const currentWeekResult = await currentWeekResultPromise;
      if (currentWeekResult) {
        nextWeekResults[currentWeekOpenUtc] = currentWeekResult;
      }

      // Reuse cached path data for historical weeks
      const cachedSimMap = { ...cached.payload.simMap };
      const cachedPathSummaryMap = { ...cached.payload.pathSummaryMap };

      // Only compute path for current (unrealized) week
      if (currentWeekResult) {
        try {
          const ledger = await buildWeeklyHoldLedger(currentWeekResult, {
            entryStyleId: entryStyle?.id ?? "weekly_hold",
          });
          const symbols = ledger.legs.map((leg) => leg.symbol);
          const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc, CANONICAL_PATH_RESOLUTION);
          const path = computeBasketPath(ledger, bars);
          cachedPathSummaryMap[currentWeekOpenUtc] = path.summary;
          cachedSimMap[currentWeekOpenUtc] = singleWeekPathToSimulation(
            path, currentWeekResult, biasSource,
            weekDisplayLabel(currentWeekOpenUtc),
            entryStyle?.label ?? "Weekly Hold",
          );
        } catch {
          // fallback: current week uses legacy sim
          cachedSimMap[currentWeekOpenUtc] = singleWeekToSimulation(
            currentWeekResult, biasSource,
            weekDisplayLabel(currentWeekOpenUtc),
            entryStyle?.label ?? "Weekly Hold",
          );
        }

        // Rebuild "all" multi-week path including current week
        // But only if current week is realized (otherwise "all" stays as cached)
        // Current week is typically unrealized, so "all" sim stays cached. No recompute needed.
      }

      return assembleStrategyPageData({
        biasSource,
        currentWeekOpenUtc,
        entryStyle,
        weekOptions,
        weekResultsByWeek: nextWeekResults,
        simMap: cachedSimMap,
        pathSummaryMap: cachedPathSummaryMap,
      });
```

**Cache hit, some weeks changed:**

At lines 175-187, the artifact is being rebuilt because some weeks changed. This is rare (happens when new COT data arrives or source watermarks change). In this case, calling `buildStrategyPageDataFromWeekResults()` is correct — it needs to recompute path for the changed weeks. But then at line 195, instead of calling it AGAIN, reuse the just-persisted artifact and merge in the current week:

```typescript
        const artifactPayload = await buildStrategyPageDataFromWeekResults({
          biasSource,
          currentWeekOpenUtc,
          entryStyle,
          weekOptions: cachedWeeks,
          weekResultsByWeek: nextWeekResults,
        });

        await persistStrategyArtifactEntry(selectionKey, {
          cachedAtUtc: new Date().toISOString(),
          fingerprint,
          payload: artifactPayload,
        });

        // Merge current week into the just-built artifact instead of rebuilding
        const currentWeekResult = await currentWeekResultPromise;
        if (currentWeekResult) {
          nextWeekResults[currentWeekOpenUtc] = currentWeekResult;
        }

        // Reuse the artifact's sim/path data, compute only current week path
        const mergedSimMap = { ...artifactPayload.simMap };
        const mergedPathSummaryMap = { ...artifactPayload.pathSummaryMap };
        if (currentWeekResult) {
          try {
            const ledger = await buildWeeklyHoldLedger(currentWeekResult, {
              entryStyleId: entryStyle?.id ?? "weekly_hold",
            });
            const symbols = ledger.legs.map((leg) => leg.symbol);
            const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc, CANONICAL_PATH_RESOLUTION);
            const path = computeBasketPath(ledger, bars);
            mergedPathSummaryMap[currentWeekOpenUtc] = path.summary;
            mergedSimMap[currentWeekOpenUtc] = singleWeekPathToSimulation(
              path, currentWeekResult, biasSource,
              weekDisplayLabel(currentWeekOpenUtc),
              entryStyle?.label ?? "Weekly Hold",
            );
          } catch {
            mergedSimMap[currentWeekOpenUtc] = singleWeekToSimulation(
              currentWeekResult, biasSource,
              weekDisplayLabel(currentWeekOpenUtc),
              entryStyle?.label ?? "Weekly Hold",
            );
          }
        }

        return assembleStrategyPageData({
          biasSource,
          currentWeekOpenUtc,
          entryStyle,
          weekOptions,
          weekResultsByWeek: nextWeekResults,
          simMap: mergedSimMap,
          pathSummaryMap: mergedPathSummaryMap,
        });
```

Apply the same pattern to the **cold cache** path (lines 220-245):

```typescript
    const artifactPayload = await buildStrategyPageDataFromWeekResults({
      biasSource,
      currentWeekOpenUtc,
      entryStyle,
      weekOptions: cachedWeeks,
      weekResultsByWeek,
    });

    await persistStrategyArtifactEntry(selectionKey, {
      cachedAtUtc: new Date().toISOString(),
      fingerprint,
      payload: artifactPayload,
    });

    // Merge current week into the artifact without recomputing all path data
    const currentWeekResult = await currentWeekResultPromise;
    if (currentWeekResult) {
      weekResultsByWeek[currentWeekOpenUtc] = currentWeekResult;
    }

    const mergedSimMap = { ...artifactPayload.simMap };
    const mergedPathSummaryMap = { ...artifactPayload.pathSummaryMap };
    if (currentWeekResult) {
      try {
        const ledger = await buildWeeklyHoldLedger(currentWeekResult, {
          entryStyleId: entryStyle?.id ?? "weekly_hold",
        });
        const symbols = ledger.legs.map((leg) => leg.symbol);
        const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc, CANONICAL_PATH_RESOLUTION);
        const path = computeBasketPath(ledger, bars);
        mergedPathSummaryMap[currentWeekOpenUtc] = path.summary;
        mergedSimMap[currentWeekOpenUtc] = singleWeekPathToSimulation(
          path, currentWeekResult, biasSource,
          weekDisplayLabel(currentWeekOpenUtc),
          entryStyle?.label ?? "Weekly Hold",
        );
      } catch {
        mergedSimMap[currentWeekOpenUtc] = singleWeekToSimulation(
          currentWeekResult, biasSource,
          weekDisplayLabel(currentWeekOpenUtc),
          entryStyle?.label ?? "Weekly Hold",
        );
      }
    }

    return assembleStrategyPageData({
      biasSource,
      currentWeekOpenUtc,
      entryStyle,
      weekOptions,
      weekResultsByWeek,
      simMap: mergedSimMap,
      pathSummaryMap: mergedPathSummaryMap,
    });
```

#### Change 3: Parallelize H1 bar loading in `buildSimulationMapFromWeekResults()`

The loop at line 451 processes weeks sequentially. Since each week's path computation is independent, parallelize with `Promise.all`:

```typescript
// BEFORE (sequential):
  for (const weekResult of orderedWeeks) {
    const label = weekDisplayLabel(weekResult.weekOpenUtc);
    try {
      const ledger = await buildWeeklyHoldLedger(weekResult, { ... });
      const symbols = ledger.legs.map((leg) => leg.symbol);
      const bars = await loadPathBars(symbols, ...);
      const path = computeBasketPath(ledger, bars);
      ...
    }
  }

// AFTER (parallel):
  const weekPathPromises = orderedWeeks.map(async (weekResult) => {
    const label = weekDisplayLabel(weekResult.weekOpenUtc);
    try {
      const ledger = await buildWeeklyHoldLedger(weekResult, {
        entryStyleId: entryStyle?.id ?? "weekly_hold",
      });
      const symbols = ledger.legs.map((leg) => leg.symbol);
      const bars = await loadPathBars(
        symbols,
        ledger.weekOpenUtc,
        ledger.weekCloseUtc,
        CANONICAL_PATH_RESOLUTION,
      );
      const path = computeBasketPath(ledger, bars);
      return { weekResult, label, path, error: null };
    } catch (error) {
      return { weekResult, label, path: null, error };
    }
  });

  const weekPathSettled = await Promise.all(weekPathPromises);

  for (const { weekResult, label, path, error } of weekPathSettled) {
    if (path) {
      pathSummaryMap[weekResult.weekOpenUtc] = path.summary;
      simMap[weekResult.weekOpenUtc] = singleWeekPathToSimulation(
        path, weekResult, biasSource, label, selectionLabel,
      );
      if (weekResult.isRealized) {
        realizedWeekPaths.push(path);
      }
    } else {
      console.warn(
        `[strategyPageData] Falling back to legacy simulation for ${biasSource.id} ${weekResult.weekOpenUtc}:`,
        error instanceof Error ? (error as Error).stack ?? (error as Error).message : error,
      );
      pathSummaryMap[weekResult.weekOpenUtc] = {
        totalReturnPct: weekResult.totalReturnPct,
        peakPct: weekResult.totalReturnPct,
        troughPct: Math.min(0, weekResult.totalReturnPct),
        maxDrawdownPct: 0,
        peakToCloseGivebackPct: 0,
        troughToCloseRecoveryPct: weekResult.totalReturnPct - Math.min(0, weekResult.totalReturnPct),
        maxActivePositions: weekResult.tradeCount,
      };
      simMap[weekResult.weekOpenUtc] = singleWeekToSimulation(
        weekResult, biasSource, label, selectionLabel,
      );
    }
  }
```

This fires all 10 SQL queries concurrently instead of sequentially. On the cold path, this alone cuts latency by ~5-8x (from ~10 sequential DB round trips to ~1 parallel batch).

---

## Performance Budget After Fix

| Scenario | Before Fix | After Fix |
|---|---|---|
| Cold cache (first load per strategy) | ~20 DB queries (2× full computation) | ~10 DB queries (1× parallel) + 1 for current week |
| Warm cache, no changes | ~10 DB queries (1× full recompute) | ~1 DB query (current week only) |
| Warm cache, some weeks changed | ~20 DB queries | ~N changed + 1 current week |
| Strategy switch (already cached) | ~10 DB queries | ~1 DB query |

The common case (strategy switching) goes from **~10 sequential DB queries to ~1 query**. First load is still heavier but parallelized.

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/performance/strategyPageData.ts` | **MODIFY** — cache-aware path reuse, parallel H1 loading, lightweight assembler |

**1 file modified. 0 files created.**

---

## Validation Checklist

1. [ ] Cold cache: first strategy load computes path and caches (slower, but only once)
2. [ ] Warm cache: switching back to a previously loaded strategy reuses cached path data (fast)
3. [ ] Current week path is always fresh (not cached)
4. [ ] Sidebar DD matches path-true values (unchanged from Phase 3)
5. [ ] Simulation curves render correctly (unchanged from Phase 2)
6. [ ] `npm run build` and `npm run lint` pass
7. [ ] No double-computation of path data on any code path

---

## Important Warnings

1. **Do NOT modify any file other than `strategyPageData.ts`.** This is a pure caching/flow optimization.

2. **Do NOT change the path engine computation logic.** The fix is about WHEN and HOW OFTEN we compute, not WHAT we compute.

3. **The `realizedWeekPaths` array in `buildSimulationMapFromWeekResults` must preserve week order** for `computeMultiWeekBasketPath()` to produce correct results. `Promise.all` preserves order, so this is safe. But do NOT use `Promise.allSettled` with unordered processing.

4. **The parallelization may increase peak DB connection usage.** If the Postgres pool is small (e.g., 5 connections), 10 concurrent queries may queue. The `pathBarLoader` uses the shared `query()` function which goes through the connection pool. Monitor for pool exhaustion. If it's an issue, batch into groups of 3-4 with `Promise.all` in chunks. But try full parallel first — most pools handle 10 concurrent queries fine.

5. **File header standard applies** to any new code.

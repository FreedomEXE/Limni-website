# CODEX: Ship Strength Source — Resolver + Production Wiring

**Date:** 2026-04-04
**Goal:** Wire the strength source into the production performance pipeline with a neutral resolver. Strength has been dead code (`performanceLab.ts:339-341` returns `{}`). This prompt ships it as a live source with 351/360 coverage.

**Research backing:**
- T1 baseline: 335/360, +80.89%, 14.98% DD, 54.6% WR
- TA (T1 + raw spread sum resolver): 351/360, +78.72%, 15.09% DD, 54.4% WR, 3 losing weeks
- The 16 resolver trades fill FX to 280/280 (full coverage). Cost: -2.17% total, 50% WR.
- Remaining 9/360 gaps: 6 true neutrals (spread sums to 0) + 3 data gaps. Cannot be resolved without degradation.

**What ships:**
1. `buildStrengthPairs()` function with neutral resolver in `performanceLab.ts`
2. Strength parameter added to `computeModelPairSignals()` and `computeModelPerformance()`
3. "strength" added to the model refresh loop in `performanceRefresh.ts`
4. Strength data loaded and passed through in the refresh pipeline

---

## Change 1: `src/lib/performanceLab.ts`

### 1A. Add import

Add to the existing import block at the top of the file:

```typescript
import type { WeeklyPairStrength } from "./strength/weeklyStrength";
```

### 1B. Add `buildStrengthPairs` function

Add this function near the other pair-building functions (`buildSentimentPairs`, `buildBiasPairs`). Place it directly after `buildSentimentPairs`.

```typescript
function resolveStrengthNeutral(ps: WeeklyPairStrength): Direction | null {
  // Raw spread sum across all windows. Matches T5/TA from research.
  let sum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (w.available && w.signedSpread !== null && Number.isFinite(w.signedSpread)) {
      sum += w.signedSpread;
      hasData = true;
    }
  }
  if (!hasData || sum === 0) return null;
  return sum > 0 ? "LONG" : "SHORT";
}

function buildStrengthPairs(
  assetClass: AssetClass,
  strengthData: WeeklyPairStrength[],
): Record<string, PairSnapshot> {
  const pairs: Record<string, PairSnapshot> = {};
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];

  for (const pairDef of pairDefs) {
    const ps = strengthData.find(
      (s) => s.pair.toUpperCase() === pairDef.pair.toUpperCase(),
    );
    if (!ps || ps.availableWindows === 0) continue;

    let direction: Direction | null = null;

    // T1 baseline: use pre-computed compositeDirection (threshold=5, equal-weight windows)
    if (ps.compositeDirection !== "NEUTRAL") {
      direction = ps.compositeDirection as Direction;
    } else {
      // Neutral resolver: raw spread sum across all windows
      direction = resolveStrengthNeutral(ps);
    }

    if (!direction) continue;
    pairs[pairDef.pair] = pairSnapshot(direction);
  }

  return pairs;
}
```

### 1C. Update `computeModelPairSignals`

Add `strength?: WeeklyPairStrength[]` to the options type:

```typescript
export function computeModelPairSignals(options: {
  model: PerformanceModel;
  assetClass: AssetClass;
  snapshot: CotSnapshot;
  sentiment: SentimentAggregate[];
  strength?: WeeklyPairStrength[];  // ADD THIS
  system?: "v1" | "v2" | "v3";
}): Record<string, PairSnapshot> {
```

Update the destructuring to include strength:

```typescript
const { model, assetClass, snapshot, sentiment, strength, system = "v1" } = options;
```

Replace the dead code block:

```typescript
// BEFORE (lines 339-341):
if (model === "strength") {
  return {};
}

// AFTER:
if (model === "strength") {
  if (!strength) return {};
  return buildStrengthPairs(assetClass, strength);
}
```

### 1D. Update `computeModelPerformance`

Add `strength?: WeeklyPairStrength[]` to the options type:

```typescript
export async function computeModelPerformance(options: {
  model: PerformanceModel;
  assetClass: AssetClass;
  snapshot: CotSnapshot;
  sentiment: SentimentAggregate[];
  strength?: WeeklyPairStrength[];  // ADD THIS
  performance?: Awaited<ReturnType<typeof getPairPerformance>>;
  pairsOverride?: Record<string, PairSnapshot>;
  reasonOverrides?: Map<string, string[]>;
  system?: "v1" | "v2" | "v3";
}): Promise<ModelPerformance> {
```

Update the destructuring to include strength:

```typescript
const { model, assetClass, snapshot, sentiment, strength, performance, pairsOverride, reasonOverrides, system = "v1" } = options;
```

Update the `computeModelPairSignals` call inside this function to pass strength through:

```typescript
let pairs: Record<string, PairSnapshot> = {};

if (pairsOverride) {
  pairs = pairsOverride;
} else {
  pairs = computeModelPairSignals({ model, assetClass, snapshot, sentiment, strength, system });
}
```

**Find the existing line that calls `computeModelPairSignals` and add `strength` to it.** The exact current code may vary — look for the call and add the `strength` field.

### 1E. Update `biasReason` function

The `biasReason` function at approximately line 366-385 already handles the "Strength" label:

```typescript
const label =
  model === "blended"
    ? "Blended"
    : model === "dealer"
      ? "Dealer"
      : model === "commercial"
        ? "Commercial"
        : "Strength";
```

This already works. No change needed.

---

## Change 2: `src/lib/performanceRefresh.ts`

### 2A. Add import

```typescript
import { readWeeklyPairStrengths } from "@/lib/strength/weeklyStrength";
```

### 2B. Add "strength" to models array

```typescript
// BEFORE (line 100-108):
const models: PerformanceModel[] = [
  "antikythera",
  "antikythera_v2",
  "antikythera_v3",
  "blended",
  "dealer",
  "commercial",
  "sentiment",
];

// AFTER:
const models: PerformanceModel[] = [
  "antikythera",
  "antikythera_v2",
  "antikythera_v3",
  "blended",
  "dealer",
  "commercial",
  "sentiment",
  "strength",
];
```

### 2C. Load strength data per week

Inside the `for (const weekOpenUtc of targetWeeks)` loop, after loading sentiment but before the asset class loop, load strength:

```typescript
// After the sentimentForWeek loading (around line 142), add:
const strengthForWeek = await readWeeklyPairStrengths(weekOpenUtc);
```

### 2D. Pass strength to computeModelPerformance

Update the `computeModelPerformance` call (around line 164):

```typescript
// BEFORE:
const result = await computeModelPerformance({
  model,
  assetClass: asset.id,
  snapshot,
  sentiment: sentimentForWeek,
  performance,
});

// AFTER:
const result = await computeModelPerformance({
  model,
  assetClass: asset.id,
  snapshot,
  sentiment: sentimentForWeek,
  strength: strengthForWeek,
  performance,
});
```

---

## Change 3: No Other Callers Need Updating

The `strength` parameter is optional (`strength?: WeeklyPairStrength[]`). All existing callers that don't pass it will continue to work unchanged — `computeModelPairSignals` returns `{}` for strength when `strength` is undefined. This is backward-compatible.

**The following files call `computeModelPerformance` but DO NOT need changes:**
- `src/app/api/performance/comparison/route.ts` (legacy, will get `{}` for strength — fine)
- All `scripts/*.ts` files (research/backfill scripts — will get `{}` for strength — fine)

These callers will start producing strength results naturally once they're updated to pass strength data. This can be done incrementally — not required for this ship.

---

## Validation

### Build and lint

```bash
npx eslint src/lib/performanceLab.ts src/lib/performanceRefresh.ts --max-warnings=0
npx tsc --noEmit
```

### Functional verification

After the changes, trigger a performance refresh for the current week:

```bash
npx tsx scripts/refresh-performance.ts
```

This should now produce non-empty strength performance rows in the database. Verify by checking:

```sql
SELECT week_open_utc, asset_class, model, percent, total, priced
FROM performance_snapshots
WHERE model = 'strength'
ORDER BY week_open_utc DESC
LIMIT 20;
```

Expect: rows for each asset class with non-zero `total` and `priced` counts.

### Unit tests

```bash
npx vitest run src/lib/__tests__/performanceLab.test.ts
```

All existing tests must pass. If there are strength-specific tests, they should now return non-empty results.

---

## Important Warnings

1. **The resolver is ONLY for neutral composites.** If `compositeDirection` is LONG or SHORT, use it as-is. The resolver fires only when compositeDirection is "NEUTRAL" and data exists.

2. **`resolveStrengthNeutral` sums raw `signedSpread` values across windows.** These values differ by asset class:
   - FX: `normalizedBase - normalizedQuote`
   - Non-FX: `normalizedBase - 50`
   - Already computed in `WeeklyPairStrength.windows[].signedSpread`. Just read them.

3. **The `strength` parameter is optional.** Callers that don't pass it get `{}` — same as before. This is backward-compatible.

4. **"strength" must be added to the `models` array in `performanceRefresh.ts`.** Without this, the refresh loop won't compute strength performance even with the fixed code.

5. **Strength data loading:** `readWeeklyPairStrengths(weekOpenUtc)` returns all 36 pairs across all asset classes. It reads from `strength_weekly_snapshots` (if locked) or falls back to live `currency_strength_snapshots`/`asset_strength_snapshots`. No new data loading infrastructure needed.

6. **`WeeklyPairStrength.pair` is uppercase.** Match against `pairDef.pair` with `.toUpperCase()` for safety.

7. **Do NOT modify `weeklyStrength.ts` or any other strength data file.** The resolver lives in `performanceLab.ts` only. Raw data stays raw.

8. **Do NOT modify the `biasReason` function.** It already handles the "Strength" label case.

9. **Expected coverage after ship:** ~351/360 (97.5%). FX: 280/280. The 9 remaining gaps are 6 true neutrals (all window spreads cancel perfectly) and 3 data-unavailable weeks.

10. **File header standard applies.** Preserve existing headers. Add comments only where the logic isn't self-evident.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/lib/performanceLab.ts` | Add `resolveStrengthNeutral()`, `buildStrengthPairs()`; add `strength` param to `computeModelPairSignals` and `computeModelPerformance`; replace `return {}` dead code |
| `src/lib/performanceRefresh.ts` | Add `readWeeklyPairStrengths` import; add "strength" to models array; load strength data per week; pass to `computeModelPerformance` |

**Two files changed. No new files.**

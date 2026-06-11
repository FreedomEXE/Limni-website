# Codex Prompt: Fix Selector Engine Math Bugs

## Context

The selector engine (`src/lib/performance/selectorEngine.ts`) uses min-max normalization to score COT and sentiment data. Two math bugs cause crypto pairs (BTCUSD, ETHUSD) to incorrectly resolve as LONG when they should be SHORT:

1. **Sentiment thin-lookback bug**: when the min-max lookback has zero variance (1-2 entries or identical values), `minMaxIndex` returns 50 → score = 0, killing the sentiment signal. The raw `agg_net` has directional information but it's discarded. This causes the selector to fall through to the COT fallback.

2. **COT one-sided normalization bug**: for assets where net positioning is consistently on one side (e.g., crypto dealers are always net short over 156 weeks), min-max normalization maps "least short in history" to index ~100 → score ~+1.0 → LONG. The actual positioning is SHORT. The normalization formula `(index - 50) / 50` assumes data oscillates around zero, which isn't true for crypto COT.

These bugs combine: sentiment is zeroed out → falls to COT → COT gives inverted signal → LONG instead of SHORT.

## Phase 1: Diagnostic Script

Create `scripts/diagnose-selector-crypto.ts` that dumps the selector's internal computation for ALL pairs across ALL weeks in the app. This lets us see exactly what's happening and verify the fixes.

**What it must print, per week per pair:**

```
Week: 2026-01-19  Pair: BTCUSD  Asset: crypto
  Sentiment: agg_net=34.5  lookback=[34.5]  minMaxIndex=50  score=0.00  extremity=0.00
  Dealer COT: baseSeries=[-800,-750,-600]  baseCurrent=-600  minMaxIndex=100  score=+1.00  crossesZero=false
  Commercial COT: baseSeries=[...]  baseCurrent=...  minMaxIndex=...  score=...  crossesZero=...
  Policy: sentiment_score=0.00 → FALLBACK → dealer_score=+1.00 → direction=LONG
  Raw sentiment strategy direction: SHORT (from basketSource for comparison)
  ---
  MISMATCH: Selector=LONG, Raw Sentiment=SHORT
```

**Implementation:**

- Import and call the same functions the selector uses: `loadCotHistory`, `loadSentimentHistory`, `computeCotMetrics`, `computeSentimentMetrics`, `policySentimentContextOverride`
- PROBLEM: these are all private/non-exported functions in `selectorEngine.ts`
- SOLUTION: temporarily export the diagnostic helpers, OR (better) duplicate the core math in the script with identical logic so we can instrument it with logging. The script is throwaway — it doesn't need to be clean.
- Also call `resolveSentimentBasket` from `basketSource.ts` for each week to get the raw sentiment direction for comparison
- Load all weeks from `listDataSectionWeeks`
- Print a summary table at the end showing ALL mismatches between selector and raw sentiment for crypto pairs

**Also print for the CURRENT week specifically:**
- All 3 source scores for BTC and ETH
- Which policy branch was taken
- The final direction and why

**Run with:** `npx tsx scripts/diagnose-selector-crypto.ts`

This script talks to the database, so it needs `DATABASE_URL` from `.env`.

## Phase 2: Fix the Math

### Fix 2a: One-sided COT normalization (`computeCotMetrics`)

**The problem (line ~258):**
```typescript
const score = clamp((baseIndex - 50) / 50, -1, 1);
```

When all values in `baseSeries` are the same sign (don't cross zero), this formula inverts the signal. "Least short" maps to the top of the range → positive score → LONG, even though positioning is SHORT.

**The fix:**

After computing `baseSeries`, `baseCurrent`, and `baseIndex`, check if the data crosses zero. If it doesn't, use the raw current value normalized by the max absolute value to preserve the correct sign:

```typescript
const baseLow = Math.min(...baseSeries);
const baseHigh = Math.max(...baseSeries);
const crossesZero = baseLow < 0 && baseHigh > 0;

let baseScore: number;
if (!crossesZero) {
  // One-sided data: direction from sign, magnitude from absolute position
  const maxAbs = Math.max(Math.abs(baseLow), Math.abs(baseHigh));
  baseScore = maxAbs > 0 ? clamp(baseCurrent / maxAbs, -1, 1) : 0;
} else {
  // Oscillating data: standard min-max normalization
  baseScore = clamp((baseIndex - 50) / 50, -1, 1);
}
```

**Apply this same fix to the FX branch too** (lines 245-255). For FX, both `baseSeries` and `quoteSeries` get the crossesZero check independently. The FX score formula `(baseIndex - quoteIndex) / 100` is fine when both oscillate, but if either is one-sided, its individual index should be recomputed using the one-sided formula above.

Here's how the FX branch should work:

```typescript
if (pairDef.assetClass === "fx") {
  const quoteSeries = slice
    .map((row) => resolveMarketBias(row.snapshot.currencies[pairDef.quote]!, mode)?.net ?? null)
    .filter((v): v is number => v !== null);

  if (quoteSeries.length === 0) {
    return { score: baseScore, extremity: Math.abs(baseScore) };
  }

  const quoteCurrent = quoteSeries[quoteSeries.length - 1]!;
  const quoteIndex = minMaxIndex(quoteSeries, quoteCurrent);
  const quoteLow = Math.min(...quoteSeries);
  const quoteHigh = Math.max(...quoteSeries);
  const quoteCrossesZero = quoteLow < 0 && quoteHigh > 0;

  let quoteScore: number;
  if (!quoteCrossesZero) {
    const maxAbs = Math.max(Math.abs(quoteLow), Math.abs(quoteHigh));
    quoteScore = maxAbs > 0 ? clamp(quoteCurrent / maxAbs, -1, 1) : 0;
  } else {
    quoteScore = clamp((quoteIndex - 50) / 50, -1, 1);
  }

  const score = clamp(baseScore - quoteScore, -1, 1);
  return {
    score,
    extremity: Math.max(Math.abs(baseScore), Math.abs(quoteScore)),
  };
}

return { score: baseScore, extremity: Math.abs(baseScore) };
```

### Fix 2b: Sentiment thin-lookback (`computeSentimentMetrics`)

**The problem (line ~285):**
```typescript
const index = minMaxIndex(lookbackSeries, currentAggNet);
const centered = clamp((index - 50) / 50, -1, 1);
return { score: -centered, extremity: Math.abs(centered) };
```

When `lookbackSeries` has zero variance (all identical values, or only 1 entry), `minMaxIndex` returns 50 → score = 0. But `currentAggNet` has directional information.

**The fix:**

After calling `minMaxIndex`, check for the zero-variance case and fall back to raw contrarian direction:

```typescript
const lookbackSeries = selectedWeeklyValues.slice(-SENTIMENT_LOOKBACK_WEEKS);
const currentAggNet = history[currentIndex]!.aggNet;
const index = minMaxIndex(lookbackSeries, currentAggNet);
const centered = clamp((index - 50) / 50, -1, 1);

// When lookback has zero variance (thin data), normalization returns neutral.
// Fall back to raw contrarian direction from agg_net at moderate strength.
if (Math.abs(centered) < 0.000001 && Math.abs(currentAggNet) > 0.001) {
  const rawContrarian = currentAggNet > 0 ? -1 : 1; // crowd long → SHORT, crowd short → LONG
  const moderateScore = rawContrarian * 0.3; // moderate strength — we lack context for extremity
  return { score: moderateScore, extremity: 0.3 };
}

return {
  score: -centered,
  extremity: Math.abs(centered),
};
```

The `0.3` magnitude ensures:
- The sentiment signal provides a direction (won't fall to COT fallback)
- It's moderate enough that it won't trigger the "stretched" COT override path (threshold is 0.8)
- As lookback data accumulates, the real normalization takes over naturally

### Fix 2c: Bump selector engine version

Change `SELECTOR_ENGINE_VERSION` (line 49):
```typescript
export const SELECTOR_ENGINE_VERSION = "selector-engine-v5";
```

This flushes all cached selector results.

## Phase 3: Verification Script

Create `scripts/verify-selector-fix.ts` that:

1. Runs `resolveSelectorDirections` for every week in the app
2. Computes total return and max drawdown for the selector strategy (weekly hold, no overlay)
3. Prints the new honest baselines
4. Compares BTC/ETH directions per week against the raw sentiment/dealer strategies
5. Confirms NO mismatches remain for Jan 19 crypto pairs

**Also verify that FX results are not degraded** — print per-asset-class returns before/after:
- FX total return
- Crypto total return
- Indices total return
- Commodities total return

Run: `npx tsx scripts/verify-selector-fix.ts`

## What NOT to Change

- **No changes to `basketSource.ts`** — the raw sentiment/dealer strategies are correct
- **No changes to `weeklyHoldEngine.ts`** — the engine consumes whatever the selector produces
- **No changes to any UI code** — the selector just appears in the dropdown as before
- **`minMaxIndex` function itself stays unchanged** — the fixes are in how its output is interpreted in `computeCotMetrics` and `computeSentimentMetrics`

## Files to Change

| File | Change |
|------|--------|
| `src/lib/performance/selectorEngine.ts` | Fix `computeCotMetrics` one-sided normalization, fix `computeSentimentMetrics` thin-lookback fallback, bump engine version to v5 |
| `scripts/diagnose-selector-crypto.ts` | NEW — diagnostic dump of selector internals per week per pair |
| `scripts/verify-selector-fix.ts` | NEW — post-fix verification with new baselines |

## Acceptance Criteria

1. `scripts/diagnose-selector-crypto.ts` runs and dumps full computation trace for all crypto pairs across all weeks
2. After fixes, BTC/ETH on Jan 19 should NOT be LONG (should match raw sentiment direction)
3. After fixes, all FX pair directions should be identical or very close to pre-fix (the FX branch crossesZero check should be a no-op for oscillating FX data)
4. `scripts/verify-selector-fix.ts` prints new honest baselines with per-asset breakdown
5. All existing tests pass: `npm test` (142+ tests)
6. Build passes: `npm run build`
7. Parity script if it exists (`scripts/verify-selector-parity.ts`) should be updated with new baselines

## Run Order

```bash
# 1. Run diagnostic BEFORE fix to see current state
npx tsx scripts/diagnose-selector-crypto.ts

# 2. Apply fixes to selectorEngine.ts

# 3. Run diagnostic AFTER fix to confirm changes
npx tsx scripts/diagnose-selector-crypto.ts

# 4. Run verification
npx tsx scripts/verify-selector-fix.ts

# 5. Run tests
npm test

# 6. Build
npm run build
```

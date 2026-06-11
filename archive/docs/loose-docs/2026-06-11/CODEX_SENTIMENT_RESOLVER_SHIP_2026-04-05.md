# CODEX: Ship Sentiment Neutral Resolver (SC Stack — 360/360)

**Date:** 2026-04-05
**Goal:** Wire the validated SC sentiment resolver into production through `basketSource.ts` so ALL consumers (Data, Performance, Matrix, Dashboard, Selector, Automation) get 36/36 coverage every week with zero drift.

**Research results:** `docs/SENTIMENT_FULL_RESOLVER_RESEARCH_2026-04-05.md`
**Ship candidate:** SC — S1 → Tier A → Tier R → Tier F = 360/360, +73.16%, 28.29% DD, 58.9% WR, 3 losing weeks

---

## Architecture

Follow the exact same pattern as the strength canonical resolver (`src/lib/strength/canonicalDirection.ts`):
- **New file** `src/lib/sentiment/resolver.ts` — contains the resolver cascade logic
- **Modified file** `src/lib/performance/basketSource.ts` — wire resolver into `resolveSentimentBasket()`
- **Modified file** `src/lib/performance/strategyPageData.ts` — bump engine version v14 → v15

The resolver function is the single source of truth for sentiment directions. `basketSource.ts` calls it. Every downstream consumer reads from `basketSource.ts`. Nothing else changes.

---

## File 1: CREATE `src/lib/sentiment/resolver.ts`

This file contains the sentiment neutral resolver — a tiered cascade that guarantees every pair gets a LONG or SHORT direction.

### Imports

```typescript
import { getAggregatesForWeekStartWithBackfill } from "@/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "@/lib/sentiment/daily";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { DateTime } from "luxon";
import type { AssetClass } from "@/lib/cotMarkets";
import type { SentimentAggregate } from "@/lib/sentiment/types";
```

### Types

```typescript
export type SentimentResolvedDirection = {
  symbol: string;
  assetClass: AssetClass;
  direction: "LONG" | "SHORT";
  tier: "S1" | "A" | "R" | "F";
  tierFSubStep?: "prior_s1" | "prior_lean" | "two_week_lean" | "hardcoded" | null;
  aggLongPct: number | null;
  crowdingState: string | null;
  flipState: string | null;
};
```

### Core Logic

The resolver takes THREE weeks of sentiment data (current, prior, 2-weeks-back) and resolves every pair in the universe to LONG or SHORT.

```typescript
export async function resolveSentimentDirections(
  weekOpenUtc: string,
): Promise<SentimentResolvedDirection[]> {
  const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const close = open.plus({ days: 7 });

  // Load current week sentiment
  const currentAggs = await getAggregatesForWeekStartWithBackfill(
    open.toUTC().toISO()!,
    close.toUTC().toISO()!,
  );

  // Load prior week sentiment (for Tier A carry and Tier F prior lean)
  const prior1Open = open.minus({ weeks: 1 });
  const prior1Close = prior1Open.plus({ days: 7 });
  const prior1Aggs = await getAggregatesForWeekStartWithBackfill(
    prior1Open.toUTC().toISO()!,
    prior1Close.toUTC().toISO()!,
  );

  // Load 2-weeks-back sentiment (for Tier F 2-week lean)
  const prior2Open = open.minus({ weeks: 2 });
  const prior2Close = prior2Open.plus({ days: 7 });
  const prior2Aggs = await getAggregatesForWeekStartWithBackfill(
    prior2Open.toUTC().toISO()!,
    prior2Close.toUTC().toISO()!,
  );

  // Build symbol maps
  const currentMap = new Map(currentAggs.map(a => [a.symbol.toUpperCase(), a]));
  const prior1Map = new Map(prior1Aggs.map(a => [a.symbol.toUpperCase(), a]));
  const prior2Map = new Map(prior2Aggs.map(a => [a.symbol.toUpperCase(), a]));

  const resolved: SentimentResolvedDirection[] = [];

  for (const assetClass of Object.keys(PAIRS_BY_ASSET_CLASS) as AssetClass[]) {
    for (const pairDef of PAIRS_BY_ASSET_CLASS[assetClass]) {
      const symbol = pairDef.pair.toUpperCase();
      const currentAgg = currentMap.get(symbol) ?? null;
      const prior1Agg = prior1Map.get(symbol) ?? null;
      const prior2Agg = prior2Map.get(symbol) ?? null;

      const result = resolveOnePair(symbol, assetClass, currentAgg, prior1Agg, prior2Agg);
      resolved.push(result);
    }
  }

  return resolved;
}
```

### Per-Pair Resolver (private function)

```typescript
function resolveOnePair(
  symbol: string,
  assetClass: AssetClass,
  currentAgg: SentimentAggregate | null,
  prior1Agg: SentimentAggregate | null,
  prior2Agg: SentimentAggregate | null,
): SentimentResolvedDirection {
  const aggLongPct = currentAgg?.agg_long_pct ?? null;
  const crowdingState = currentAgg?.crowding_state ?? null;
  const flipState = currentAgg?.flip_state ?? null;

  const base = { symbol, assetClass, aggLongPct, crowdingState, flipState };

  // ── S1 baseline: flips → crowding → null ──
  if (currentAgg) {
    const s1 = sentimentDirectionFromAggregate(currentAgg);
    if (s1 === "LONG" || s1 === "SHORT") {
      return { ...base, direction: s1, tier: "S1" };
    }
  }

  // ── From here, pair is NEUTRAL (has data but S1 returned null, OR no data) ──

  // ── Tier A: Prior-week S1 carry ──
  if (prior1Agg) {
    const priorS1 = sentimentDirectionFromAggregate(prior1Agg);
    if (priorS1 === "LONG" || priorS1 === "SHORT") {
      return { ...base, direction: priorS1, tier: "A" };
    }
  }

  // ── Tier R: Relative extremity fade (any lean from 50) ──
  if (aggLongPct !== null) {
    if (aggLongPct > 50) return { ...base, direction: "SHORT", tier: "R" };
    if (aggLongPct < 50) return { ...base, direction: "LONG", tier: "R" };
  }

  // ── Tier F: Forced lean cascade (guaranteed closer) ──
  // Sub-step 1: Prior-week S1 direction
  if (prior1Agg) {
    const priorS1 = sentimentDirectionFromAggregate(prior1Agg);
    if (priorS1 === "LONG" || priorS1 === "SHORT") {
      return { ...base, direction: priorS1, tier: "F", tierFSubStep: "prior_s1" };
    }
  }

  // Sub-step 2: Prior-week raw lean (faded)
  const priorLongPct = prior1Agg?.agg_long_pct ?? null;
  if (priorLongPct !== null) {
    if (priorLongPct > 50) return { ...base, direction: "SHORT", tier: "F", tierFSubStep: "prior_lean" };
    if (priorLongPct < 50) return { ...base, direction: "LONG", tier: "F", tierFSubStep: "prior_lean" };
  }

  // Sub-step 3: 2-week-back average lean (faded)
  const prior2LongPct = prior2Agg?.agg_long_pct ?? null;
  if (prior2LongPct !== null) {
    if (prior2LongPct > 50) return { ...base, direction: "SHORT", tier: "F", tierFSubStep: "two_week_lean" };
    if (prior2LongPct < 50) return { ...base, direction: "LONG", tier: "F", tierFSubStep: "two_week_lean" };
  }

  // Sub-step 4: Hardcoded SHORT fallback (synthetic — not a real signal)
  return { ...base, direction: "SHORT", tier: "F", tierFSubStep: "hardcoded" };
}
```

### Important Implementation Notes for `resolver.ts`

1. **`sentimentDirectionFromAggregate` is imported from `@/lib/sentiment/daily.ts`** — do NOT reimplement S1 logic. Call the existing function.

2. **Tier A fires ONLY when Tier R would also need to fire.** Because Tier A checks the PRIOR week's S1, and the current week is already neutral, Tier A is tried first as it has proven edge (+7.54%, 70% WR).

3. **Tier R fires on ANY lean from 50.** No threshold. `aggLongPct > 50` → SHORT (contrarian fade). `aggLongPct < 50` → LONG. Exactly 50.0 falls through to Tier F.

4. **Tier F sub-step 1 ("prior_s1") will NEVER fire in practice** because if prior S1 existed, Tier A would have caught it. It exists for safety/completeness only. Do NOT remove it — it's the same defensive cascade pattern as the dealer resolver.

5. **The function ALWAYS returns a direction.** The hardcoded SHORT at the end is the ultimate guarantee. It should fire on ≤10 rows across all 10 weeks.

6. **Use the Freedom_EXE file header.**

7. **Add 5-minute runtime cache** using `getOrSetRuntimeCache` from `@/lib/runtimeCache`, same as strength does. Cache key: `sentimentResolver:${weekOpenUtc}`. Import: `import { getOrSetRuntimeCache } from "@/lib/runtimeCache";`

```typescript
const SENTIMENT_RESOLVER_CACHE_TTL_MS = 5 * 60 * 1000;

export async function resolveSentimentDirections(
  weekOpenUtc: string,
): Promise<SentimentResolvedDirection[]> {
  return getOrSetRuntimeCache(
    `sentimentResolver:${weekOpenUtc}`,
    SENTIMENT_RESOLVER_CACHE_TTL_MS,
    async () => {
      // ... all the logic above goes inside this callback
    },
  );
}
```

---

## File 2: MODIFY `src/lib/performance/basketSource.ts`

Replace `resolveSentimentBasket()` (lines 119-195) to use the new resolver instead of calling `sentimentDirectionFromAggregate` directly.

### New imports (add at top)

```typescript
import { resolveSentimentDirections } from "@/lib/sentiment/resolver";
```

### Remove these imports (no longer needed directly in basketSource)

```typescript
// REMOVE: import { getAggregatesForWeekStartWithBackfill } from "@/lib/sentiment/store";
// REMOVE: import { sentimentDirectionFromAggregate } from "@/lib/sentiment/daily";
```

**WAIT — keep `inferAssetClass` function as-is.** It's still used. But sentiment no longer needs it since the resolver returns `assetClass` already.

### New `resolveSentimentBasket()` implementation

Replace the ENTIRE function body (lines 119-195) with:

```typescript
async function resolveSentimentBasket(
  weekOpenUtc: string,
): Promise<CanonicalBasketSignal[]> {
  try {
    const resolved = await resolveSentimentDirections(weekOpenUtc);
    return resolved.map((r) => ({
      weekOpenUtc,
      model: "sentiment" as const,
      symbol: r.symbol,
      assetClass: r.assetClass,
      direction: r.direction,
      sourceReportDate: null,
      metadata: {
        tier: r.tier,
        tierFSubStep: r.tierFSubStep ?? null,
        aggLongPct: r.aggLongPct,
        crowdingState: r.crowdingState,
        flipState: r.flipState,
      },
    }));
  } catch {
    // Error fetching sentiment — emit explicit NEUTRAL for all known pairs (Rule 4)
    const signals: CanonicalBasketSignal[] = [];
    for (const ac of ASSET_CLASSES) {
      for (const pd of (PAIRS_BY_ASSET_CLASS[ac] ?? [])) {
        signals.push({
          weekOpenUtc, model: "sentiment", symbol: pd.pair,
          assetClass: ac, direction: "NEUTRAL", sourceReportDate: null,
          metadata: { reason: "sentiment_error" },
        });
      }
    }
    return signals;
  }
}
```

### Critical: The resolver NEVER returns NEUTRAL

The new `resolveSentimentBasket()` maps resolver output directly. Since `resolveSentimentDirections()` always returns `"LONG"` or `"SHORT"` (never `"NEUTRAL"`), the basket will always have 36 non-neutral signals per week.

**The ONLY path to NEUTRAL is the catch block** (database error / total failure). This matches the strength pattern exactly.

### What NOT to change in basketSource.ts

- `resolveCotBasket()` — untouched
- `resolveStrengthBasket()` — untouched
- `getCanonicalBasketWeek()` — untouched (it already calls `resolveSentimentBasket()`)
- `getCanonicalBasketWeeks()` — untouched
- `filterByModel()`, `nonNeutralSignals()` — untouched
- `inferAssetClass()` — keep it. Other code may reference it. Don't remove.

---

## File 3: MODIFY `src/lib/performance/strategyPageData.ts`

Bump the engine version to force full recomputation of cached strategy artifacts:

```typescript
// Line 49-50: Change from
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v14";

// To
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v15";
```

This ensures Performance and Matrix pages recompute with the new resolver logic on next load.

---

## Files Summary

| File | Action | What Changes |
|------|--------|-------------|
| `src/lib/sentiment/resolver.ts` | **CREATE** | Tiered resolver cascade (S1 → A → R → F), runtime-cached |
| `src/lib/performance/basketSource.ts` | **MODIFY** | `resolveSentimentBasket()` calls resolver instead of S1 directly |
| `src/lib/performance/strategyPageData.ts` | **MODIFY** | Engine version v14 → v15 |

**Three files total. One new, two modified. No other files change.**

---

## Verification

After implementation, verify correctness:

### 1. Type check
```bash
npx tsc --noEmit
```
Must pass with zero errors.

### 2. Build check
```bash
npm run build
```
Must pass.

### 3. Functional verification script

Create `scripts/verify-sentiment-resolver.ts` — a lightweight verification script (NOT a research script) that confirms:

```typescript
// Load 10 weeks via listDataSectionWeeks, filter to backtestable
// For each week, call resolveSentimentDirections(weekOpenUtc)
// Assert:
// 1. Every week returns exactly 36 results
// 2. Every result has direction === "LONG" or direction === "SHORT" (never NEUTRAL)
// 3. Count tier breakdown: S1, A, R, F
// 4. Total across 10 weeks === 360
// 5. S1 count should be ~265 (matching baseline)
// 6. Tier A count should be ~30
// 7. Tier R count should be ~52
// 8. Tier F count should be ~13
```

Output format:
```
Sentiment Resolver Verification
================================
Week        | Total | S1  | A  | R  | F  |
Jan 19      |  36   | 30  |  2 |  3 |  1 |
...
================================
Total       | 360   | 265 | 30 | 52 | 13 |

✓ All weeks have exactly 36 directions
✓ No NEUTRAL directions found
✓ S1 baseline matches expected (~265)
```

Run:
```bash
npx tsx scripts/verify-sentiment-resolver.ts
```

### 4. Integration verification

After the build succeeds and verification passes, confirm that the Performance page loads correctly by checking that the strategy artifact cache gets invalidated (engine version bump from v14 to v15 forces this).

---

## What This Does NOT Change

- **`sentimentDirectionFromAggregate()` in `daily.ts`** — unchanged. The resolver calls it internally.
- **`getAggregatesForWeekStartWithBackfill()` in `store.ts`** — unchanged. The resolver calls it internally.
- **`weeklyHoldEngine.ts`** — unchanged. It reads from `basketSource.ts` which now returns resolved directions.
- **`selectorEngine.ts`** — unchanged. Same reason.
- **Dashboard, Data section, Automation** — unchanged. They all read from `getCanonicalBasketWeek()`.
- **Composite strategies (tiered_v3, agree_2of3, etc.)** — unchanged. They consume the same basket signals.

This is the power of the canonical basket architecture: change the source, everything downstream inherits.

---

## Important Warnings

1. **Use `getAggregatesForWeekStartWithBackfill` for ALL sentiment loading.** This is the canonical app/engine path. Do NOT use `getAggregatesAsOf`.

2. **The resolver MUST return exactly 36 results per week** — one per pair in `PAIRS_BY_ASSET_CLASS`. Iterate over `PAIRS_BY_ASSET_CLASS`, not over the aggregates array. Aggregates may not cover all 36 symbols.

3. **Do NOT modify `sentimentDirectionFromAggregate()`** — the resolver calls it. It is the S1 baseline. Leave it unchanged.

4. **Do NOT modify `weeklyHoldEngine.ts`** — it already handles non-neutral sentiment signals from the basket. Since the resolver eliminates all NEUTRALs, the engine will automatically trade all 36 pairs.

5. **The catch block in `resolveSentimentBasket()` MUST emit NEUTRAL** for all 36 pairs on total failure. This is the safety net. If the resolver itself throws (DB down, etc.), the system falls back to zero-trade rather than crashing.

6. **Runtime cache is important.** `resolveSentimentBasket()` is called once per week per page load via `getCanonicalBasketWeek()`, but across multiple weeks in sequence. The 5-minute cache on `resolveSentimentDirections()` prevents redundant DB hits.

7. **File header standard applies.** Use the Freedom_EXE header format on the new file.

8. **Do NOT create or modify any research scripts.** The research is done. This is a ship prompt.

9. **Do NOT modify any existing test files** unless they fail due to the new types/exports.

---

## Expected Production Behavior After Ship

- **Sentiment standalone strategy:** 360 trades across 10 weeks (was 265). Every week has 36 pairs.
- **Composite strategies:** All composites that include sentiment will now receive a LONG/SHORT vote for every pair every week. No more sentiment-neutral gaps in composite scoring.
- **Data section:** Sentiment directions on the Data page will show resolved directions with tier metadata.
- **New weeks going forward:** The resolver runs on every new week automatically. If S1 is neutral, it cascades through A → R → F. Coverage is structurally guaranteed.

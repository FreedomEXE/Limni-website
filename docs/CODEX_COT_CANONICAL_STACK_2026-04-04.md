# CODEX: Dealer Neutral Resolver + Commercial Quality — Verify & Canonicalize

**Date:** 2026-04-04
**Goal:** Verify the optimized dealer neutral resolver stack (spread ratio → delta persistence → OI-confirm), test the same concepts on commercial, and canonicalize both into the engine if results pass quality bar.

**Context:** Deep-history research tested the wrong stack order (OI+Delta → 4-week momentum → extremes). The best methods were spread directional ratio (118/130, 61.0% WR, +31.90%) and delta persistence (93/130, 60.2% WR, +7.92%). These were never tested together as a stacked resolver. The tested stack got -1.98% total on 130 neutral fills and expanded DD from 2.19% → 8.85%. The correct stack should produce **positive** returns on neutral fills.

---

## Phase 1: Research Verification

**Script:** `scripts/research-cot-optimized-stack.ts`
**Output:** `docs/COT_OPTIMIZED_STACK_RESULTS_2026-04-04.md`

### Step 0: Reproduce baselines

Same as prior passes. Use `listDataSectionWeeks()` for 10 backtestable weeks. ADR-normalize all returns.

```
Baseline                        | Pairs | Total% | MaxDD% | Win%
────────────────────────────────┼───────┼────────┼────────┼──────
Dealer non-neutral              | 150   | +38.03 | —      | 55.3
Dealer neutral lean             | 130   | -58.66 | —      | 34.6
Commercial forced-raw           | 280   | +23.41 | —      | 52.9
Dealer standalone (no fill)     | 230   | +73.18 | 2.19   | 56.5
```

If these don't match, stop and report.

### Step 1: Dealer — Test individual methods (confirmation)

Reproduce these from the deep-history research to confirm matching numbers:

```
Method (neutral resolver)       | Fills | Total% | Win% | Avg%
────────────────────────────────┼───────┼────────┼──────┼──────
Spread directional ratio        | 118   | +31.90 | 61.0 | +0.270
Delta persistence (≥3 of 4)    | 93    | +7.92  | 60.2 | +0.085
OI-confirmed delta              | 90    | +4.85  | 54.4 | +0.054
```

**Method definitions (must match deep-history research exactly):**

- **Spread directional ratio:** For each currency, `ratio = abs(dealer_net) / (abs(dealer_net) + dealer_spread)`. If `dealer_spread` is null/undefined, skip. For a neutral pair, compute `base_ratio - quote_ratio`. Positive → LONG, negative → SHORT. The currency with higher ratio has a more committed (less hedged) book — follow that currency's lean.

- **Delta persistence:** For each currency, count how many of the last 4 weekly snapshots had `dealer_delta_net` in the same direction as the current `dealer_delta_net`. Score 0-4. Only use if score ≥ 3. For a neutral pair, compare base vs quote persistence scores. Higher-persistence side wins. Direction follows the sign of that currency's current `dealer_delta_net` (remember: `dealer_delta_net = delta_short - delta_long`, inverted). If base persistence > quote persistence and base delta_net > 0 → base is dealer-bullish → LONG. If base delta_net < 0 → base is dealer-bearish → SHORT. Invert for quote winning.

- **OI-confirmed delta:** Current `dealer_delta_net` and `oi_delta` must agree in direction (both positive or both negative) for a currency. For a neutral pair, check each side. If base has OI-confirmed delta and quote doesn't → follow base direction. If both or neither have confirmation → use `dealer_delta_net` sign difference as tiebreaker (pair score = `base_delta_net - quote_delta_net`, positive → LONG). If score is zero → no resolution.

### Step 2: Dealer — Optimized stack waterfall

Test the 3-tier stack: **Spread Ratio → Delta Persistence → OI-Confirm**

For each neutral pair-week:
1. Try Tier 1 (spread ratio). If it resolves → use it, skip to next pair.
2. If Tier 1 doesn't resolve → try Tier 2 (delta persistence ≥3). If it resolves → use it.
3. If Tier 2 doesn't resolve → try Tier 3 (OI-confirmed delta). If it resolves → use it.
4. If nothing resolves → pair stays NEUTRAL (don't force).

```
Tier                        | Resolved | Cumulative | Tier Win% | Cum Win% | Tier Total%
────────────────────────────┼──────────┼────────────┼───────────┼──────────┼───────────
Tier 1: Spread Ratio        | ???      | ???/130    | ???       | ???      | ???
Tier 2: Delta Persistence   | ???      | ???/130    | ???       | ???      | ???
Tier 3: OI-Confirm          | ???      | ???/130    | ???       | ???      | ???
Remaining unresolved        | ???      | ???/130    | —         | —        | —
```

### Step 3: Dealer — Combined standalone result

Compute the full 10-week dealer standalone:
- All 36 pairs per week
- Non-neutral pairs: existing dealer direction (unchanged)
- Resolved neutral pairs: direction from optimized stack
- Unresolved neutrals: skipped (no trade)
- ADR-normalize all returns

```
Dealer System               | Trades | Total% | MaxDD% | Win%
────────────────────────────┼────────┼────────┼────────┼──────
Current dealer (no fill)    | 230    | +73.18 | 2.19   | 56.5
Dealer + optimized stack    | ???    | ???    | ???    | ???
```

**Also test spread ratio as a single-tier resolver** (no stack at all):

```
Dealer System               | Trades | Total% | MaxDD% | Win%
────────────────────────────┼────────┼────────┼────────┼──────
Current dealer (no fill)    | 230    | +73.18 | 2.19   | 56.5
Dealer + spread ratio only  | ???    | ???    | ???    | ???
Dealer + optimized stack    | ???    | ???    | ???    | ???
```

This tells us whether the complexity of a 3-tier stack is worth it, or if spread ratio alone is good enough.

### Step 4: Dealer — Non-neutral impact check

Verify the resolver methods don't hurt non-neutral signals. For each non-neutral pair-week, check:
- Does spread ratio confirm or contradict the existing dealer direction?
- Does delta persistence confirm or contradict?

```
Filter on non-neutral           | Pairs | Total% | Win% | vs Baseline
────────────────────────────────┼───────┼────────┼──────┼───────────
All non-neutral (baseline)      | 150   | +38.03 | 55.3 | —
Spread ratio confirms direction | ???   | ???    | ???  | +/-X%
Spread ratio contradicts        | ???   | ???    | ???  | +/-X%
Delta persist confirms          | ???   | ???    | ???  | +/-X%
```

### Step 5: Commercial — Quality filters

Commercial already has 36/36 coverage. We're testing quality filters — which of the 36 directions are higher confidence.

**Delta persistence for commercial:** Same concept — count how many of last 4 weeks had `commercial_delta_net` in the same direction. `commercial_delta_net = delta_long - delta_short` (NOT inverted like dealer). Direction confirmed if commercial delta persistence ≥ 3 and the persistent direction agrees with the forced-raw direction.

**Mean-reversion toward 52-week mean:** For each currency, compute `commercial_net` 52-week mean from prior snapshots. "Moving toward mean" = current commercial_net is closer to the mean than 4 weeks ago. For a pair, both base and quote should be moving toward their means (or at least one strongly).

Test:

```
Filter on commercial forced-raw | Pairs | Total% | Win% | Avg% | vs Baseline
────────────────────────────────┼───────┼────────┼──────┼──────┼───────────
Baseline (all forced-raw)       | 280   | +23.41 | 52.9 | 0.084| —
Delta persistence confirms      | ???   | ???    | ???  | ???  | +/-X%
Moving toward 52w mean          | ???   | ???    | ???  | ???  | +/-X%
Either filter confirms          | ???   | ???    | ???  | ???  | +/-X%
Both filters confirm            | ???   | ???    | ???  | ???  | +/-X%
Neither filter confirms         | ???   | ???    | ???  | ???  | +/-X%
```

### Step 6: Commercial — High/low confidence split

Using the best filter from Step 5, split commercial into confidence tiers:

```
Commercial Tier                 | Trades | Total% | MaxDD% | Win%
────────────────────────────────┼────────┼────────┼────────┼──────
All commercial (baseline)       | 280    | +23.41 | 29.04  | 52.9
High-confidence subset          | ???    | ???    | ???    | ???
Low-confidence subset           | ???    | ???    | ???    | ???
```

Compute MaxDD (true cumulative) for each tier as a standalone system over 10 weeks.

---

## Phase 2: Canonical Implementation

**Proceed with canonicalization ONLY if:**
- Dealer + optimized stack: Total% ≥ +60%, MaxDD ≤ 10%, WR ≥ 54%
- Commercial high-confidence: WR ≥ 57% (at least +4pp over baseline 52.9%)

If either condition fails, output results only (no code changes) and explain which bar was missed.

### 2A: New enrichment fields

Add to `MarketSnapshot` in `src/lib/cotTypes.ts`:

```typescript
dealer_directional_ratio?: number | null;
dealer_delta_persistence?: number | null;    // 0-4 score
commercial_delta_persistence?: number | null; // 0-4 score
commercial_toward_mean?: boolean | null;
```

Add to `CotEnrichment` in `src/lib/cotCompute.ts`:

```typescript
dealer_directional_ratio?: number | null;
dealer_delta_persistence?: number | null;
commercial_delta_persistence?: number | null;
commercial_toward_mean?: boolean | null;
```

### 2B: Compute enrichment fields

**`dealer_directional_ratio`** — compute in `buildMarketSnapshot()` from existing data:

```typescript
const dealerDirectionalRatio =
  typeof enrichment?.dealer_spread === "number" && enrichment.dealer_spread >= 0
    ? Math.abs(dealerNet) / (Math.abs(dealerNet) + enrichment.dealer_spread)
    : null;
```

This needs NO historical data — purely current-snapshot math.

**`dealer_delta_persistence` and `commercial_delta_persistence`** — these need prior snapshots. Compute them in `refreshSnapshotForClass()` AFTER building all currency snapshots but BEFORE deriving pairs:

```typescript
// After the currencies loop, before pair derivation:
const priorDates = (await listSnapshotDates(assetClass))
  .filter(d => d < resolvedReportDate)
  .sort()
  .slice(-4);

const priorSnapshots = await Promise.all(
  priorDates.map(d => readSnapshot({ assetClass, reportDate: d }))
);

for (const [ccyId, snapshot] of Object.entries(currencies)) {
  // Dealer delta persistence
  const currentDealerDelta = snapshot.dealer_delta_net;
  if (typeof currentDealerDelta === "number" && currentDealerDelta !== 0) {
    const currentSign = currentDealerDelta > 0 ? 1 : -1;
    let count = 0;
    for (const prior of priorSnapshots) {
      const priorDelta = prior?.currencies?.[ccyId]?.dealer_delta_net;
      if (typeof priorDelta === "number" && priorDelta !== 0) {
        if ((priorDelta > 0 ? 1 : -1) === currentSign) count++;
      }
    }
    snapshot.dealer_delta_persistence = count;
  }

  // Commercial delta persistence — same logic with commercial_delta_net
  const currentCommDelta = snapshot.commercial_delta_net;
  if (typeof currentCommDelta === "number" && currentCommDelta !== 0) {
    const currentSign = currentCommDelta > 0 ? 1 : -1;
    let count = 0;
    for (const prior of priorSnapshots) {
      const priorDelta = prior?.currencies?.[ccyId]?.commercial_delta_net;
      if (typeof priorDelta === "number" && priorDelta !== 0) {
        if ((priorDelta > 0 ? 1 : -1) === currentSign) count++;
      }
    }
    snapshot.commercial_delta_persistence = count;
  }

  // Commercial toward mean — needs 52w lookback
  const allDates = (await listSnapshotDates(assetClass))
    .filter(d => d < resolvedReportDate)
    .sort()
    .slice(-52);
  // Only compute if enough history (>=26 weeks)
  if (allDates.length >= 26) {
    const priorNets: number[] = [];
    for (const prior of priorSnapshots) {  // reuse already-loaded snapshots where possible
      const net = prior?.currencies?.[ccyId]?.commercial_net;
      if (typeof net === "number") priorNets.push(net);
    }
    // Need more history — load the rest if not already loaded
    // (Cache will handle deduplication)
    const allPriorSnapshots = await Promise.all(
      allDates.map(d => readSnapshot({ assetClass, reportDate: d }))
    );
    const allNets: number[] = [];
    for (const ps of allPriorSnapshots) {
      const net = ps?.currencies?.[ccyId]?.commercial_net;
      if (typeof net === "number") allNets.push(net);
    }
    if (allNets.length >= 26) {
      const mean52w = allNets.reduce((a, b) => a + b, 0) / allNets.length;
      const currentNet = snapshot.commercial_net;
      // Compare: 4 weeks ago distance to mean vs current distance to mean
      const fourWeekAgoSnapshot = priorSnapshots.length >= 4
        ? priorSnapshots[0] // oldest of the 4
        : null;
      const fourWeekAgoNet = fourWeekAgoSnapshot?.currencies?.[ccyId]?.commercial_net;
      if (typeof currentNet === "number" && typeof fourWeekAgoNet === "number") {
        const currentDist = Math.abs(currentNet - mean52w);
        const priorDist = Math.abs(fourWeekAgoNet - mean52w);
        snapshot.commercial_toward_mean = currentDist < priorDist;
      }
    }
  }
}
```

**IMPORTANT:** The 52-week lookback is expensive. Load all needed prior snapshots ONCE (cache will help), do NOT load them per-currency. Restructure the above pseudocode to load snapshots once, then loop currencies. The pseudocode above is illustrative — optimize the actual implementation.

### 2C: Dealer neutral resolver

Add a new helper function in `src/lib/cotCompute.ts`:

```typescript
export function resolveDealerNeutral(
  base: MarketSnapshot,
  quote: MarketSnapshot,
): Direction | null {
  // Tier 1: Spread directional ratio
  const baseRatio = base.dealer_directional_ratio;
  const quoteRatio = quote.dealer_directional_ratio;
  if (typeof baseRatio === "number" && typeof quoteRatio === "number" && baseRatio !== quoteRatio) {
    const diff = baseRatio - quoteRatio;
    // Higher ratio = more committed positioning. Follow that currency's dealer lean.
    // dealer_net > 0 = BULLISH (inverted: short - long > 0 means more short → bullish for currency)
    if (diff > 0) {
      // Base is more committed
      return base.dealer_net > 0 ? "LONG" : base.dealer_net < 0 ? "SHORT" : null;
    } else {
      // Quote is more committed — invert
      return quote.dealer_net > 0 ? "SHORT" : quote.dealer_net < 0 ? "LONG" : null;
    }
  }

  // Tier 2: Delta persistence (≥3 of 4 weeks)
  const basePersist = base.dealer_delta_persistence;
  const quotePersist = quote.dealer_delta_persistence;
  if (typeof basePersist === "number" && typeof quotePersist === "number") {
    if (basePersist >= 3 && quotePersist < 3) {
      // Base has persistent delta, follow it
      const baseDelta = base.dealer_delta_net;
      if (typeof baseDelta === "number" && baseDelta !== 0) {
        return baseDelta > 0 ? "LONG" : "SHORT";
      }
    }
    if (quotePersist >= 3 && basePersist < 3) {
      const quoteDelta = quote.dealer_delta_net;
      if (typeof quoteDelta === "number" && quoteDelta !== 0) {
        return quoteDelta > 0 ? "SHORT" : "LONG"; // inverted because quote
      }
    }
  }

  // Tier 3: OI-confirmed delta
  const baseDelta = base.dealer_delta_net;
  const baseOiDelta = base.oi_delta;
  const quoteDelta = quote.dealer_delta_net;
  const quoteOiDelta = quote.oi_delta;
  const baseConfirmed = typeof baseDelta === "number" && typeof baseOiDelta === "number"
    && baseDelta !== 0 && baseOiDelta !== 0
    && Math.sign(baseDelta) === Math.sign(baseOiDelta);
  const quoteConfirmed = typeof quoteDelta === "number" && typeof quoteOiDelta === "number"
    && quoteDelta !== 0 && quoteOiDelta !== 0
    && Math.sign(quoteDelta) === Math.sign(quoteOiDelta);

  if (baseConfirmed && !quoteConfirmed) {
    return baseDelta! > 0 ? "LONG" : "SHORT";
  }
  if (quoteConfirmed && !baseConfirmed) {
    return quoteDelta! > 0 ? "SHORT" : "LONG";
  }
  if (baseConfirmed && quoteConfirmed) {
    const pairScore = (baseDelta ?? 0) - (quoteDelta ?? 0);
    if (pairScore > 0) return "LONG";
    if (pairScore < 0) return "SHORT";
  }

  return null; // Unresolved
}
```

### 2D: Wire resolver into direction derivation

In `derivePairDirections()` — for **dealer mode only**, replace the neutral-skip logic with a resolver call:

```typescript
// BEFORE (current):
if (baseBias.bias === "NEUTRAL" || quoteBias.bias === "NEUTRAL") {
  continue;
}
if (baseBias.bias === quoteBias.bias) {
  continue;
}

// AFTER (with resolver):
if (mode === "dealer") {
  const isNeutral =
    baseBias.bias === "NEUTRAL" || quoteBias.bias === "NEUTRAL" || baseBias.bias === quoteBias.bias;
  if (isNeutral) {
    const resolved = resolveDealerNeutral(base, quote);
    if (resolved && resolved !== "NEUTRAL") {
      pairs[pairDef.pair] = {
        direction: resolved,
        base_bias: baseBias.bias,
        quote_bias: quoteBias.bias,
      };
    }
    continue;
  }
}
// Non-dealer modes (commercial, blended) keep existing logic unchanged
```

**Apply the same change** to `derivePairDirectionsWithNeutral()` — neutral dealer pairs get the resolver. If resolver returns null, they stay NEUTRAL.

**Do NOT change** `derivePairDirectionsByBase()` or `derivePairDirectionsByBaseWithNeutral()`. Those are non-FX and should remain untouched.

### 2E: Commercial quality metadata

Add an optional `confidence` field to `PairSnapshot` in `src/lib/cotTypes.ts`:

```typescript
export type PairSnapshot = {
  direction: Direction;
  base_bias: Bias;
  quote_bias: Bias;
  confidence?: "high" | "standard";
};
```

In the commercial branch of `derivePairDirections()` and `derivePairDirectionsWithNeutral()`, after computing the direction, set confidence:

```typescript
if (mode === "commercial") {
  // ... existing forced-raw logic ...
  // After setting direction:
  const baseConfident =
    (typeof base.commercial_delta_persistence === "number" && base.commercial_delta_persistence >= 3) ||
    base.commercial_toward_mean === true;
  const quoteConfident =
    (typeof quote.commercial_delta_persistence === "number" && quote.commercial_delta_persistence >= 3) ||
    quote.commercial_toward_mean === true;
  pairs[pairDef.pair].confidence = (baseConfident || quoteConfident) ? "high" : "standard";
  continue;
}
```

### 2F: Wire persistence computation into `buildMarketSnapshot`

Add `dealer_directional_ratio` computation inside `buildMarketSnapshot()`:

```typescript
const dealerDirectionalRatio =
  typeof enrichment?.dealer_spread === "number" && enrichment.dealer_spread >= 0
    ? Math.abs(dealerNet) / (Math.abs(dealerNet) + enrichment.dealer_spread)
    : null;
```

Pass through `dealer_delta_persistence`, `commercial_delta_persistence`, and `commercial_toward_mean` from enrichment (they're computed in `refreshSnapshotForClass` and passed through `CotEnrichment`).

Return them in the MarketSnapshot object:

```typescript
return {
  // ... existing fields ...
  dealer_directional_ratio: dealerDirectionalRatio,
  dealer_delta_persistence: enrichment?.dealer_delta_persistence ?? null,
  commercial_delta_persistence: enrichment?.commercial_delta_persistence ?? null,
  commercial_toward_mean: enrichment?.commercial_toward_mean ?? null,
};
```

---

## Validation

After implementation:

1. **`npx eslint src/lib/cotCompute.ts src/lib/cotTypes.ts src/lib/cotStore.ts --max-warnings=0`**
2. **`npx vitest run src/lib/__tests__/cotCompute.test.ts`** — existing tests must pass
3. **New test in `src/lib/__tests__/cotCompute.test.ts`:**
   - Test `resolveDealerNeutral()` with known input snapshots
   - Test that non-neutral dealer pairs are unaffected
   - Test that commercial `confidence` is set correctly

---

## Important Warnings

1. **Do NOT change non-neutral dealer logic.** The resolver only applies when a pair would otherwise be NEUTRAL. Non-neutral pairs (BULLISH vs BEARISH) keep their existing direction.
2. **Do NOT change commercial direction derivation.** Commercial stays forced-raw. Only the `confidence` metadata is new.
3. **Dealer net inversion is critical.** `dealer_net = short - long`. `dealer_delta_net = delta_short - delta_long`. When `dealer_net > 0`, the dealer is net short the currency → BULLISH bias. The resolver must respect this.
4. **Commercial delta is NOT inverted.** `commercial_delta_net = delta_long - delta_short`.
5. **Handle null `dealer_spread` gracefully.** Some currencies/weeks may have null spread. Tier 1 (spread ratio) should skip when spread is null — fall through to Tier 2.
6. **Prior snapshot loading in `refreshSnapshotForClass`:** Load the 4 most recent prior snapshots once. For commercial mean-reversion, load up to 52 prior snapshots. Use `readSnapshot()` which is already cached. Load all snapshots ONCE, then iterate currencies — do NOT load per-currency.
7. **`dealer_delta_persistence` counts prior weeks only (0-4),** not the current week. The current week's delta direction is what we're testing persistence OF.
8. **The `confidence` field on PairSnapshot is optional.** All existing code that reads PairSnapshot should work without changes because it's optional. Verify by checking TypeScript compilation.
9. **For the research phase,** reproduce the deep-history delta persistence logic exactly. Delta persistence counts prior weeks where `dealer_delta_net` had the same sign as current. Score 0-4. Only counts as a resolver when ≥ 3.
10. **The research script and the canonical implementation must produce the same results.** After canonicalization, run the research script again and verify the stacked resolver numbers match what the engine would produce.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `scripts/research-cot-optimized-stack.ts` | New research script |
| `docs/COT_OPTIMIZED_STACK_RESULTS_2026-04-04.md` | Research output |
| `src/lib/cotTypes.ts` | Add `dealer_directional_ratio`, `dealer_delta_persistence`, `commercial_delta_persistence`, `commercial_toward_mean` to MarketSnapshot; add `confidence` to PairSnapshot |
| `src/lib/cotCompute.ts` | Add fields to CotEnrichment; add `resolveDealerNeutral()`; wire into `derivePairDirections()` and `derivePairDirectionsWithNeutral()`; compute `dealer_directional_ratio` in `buildMarketSnapshot()`; add commercial confidence |
| `src/lib/cotStore.ts` | Compute `dealer_delta_persistence`, `commercial_delta_persistence`, `commercial_toward_mean` in `refreshSnapshotForClass()` |
| `src/lib/__tests__/cotCompute.test.ts` | New tests for `resolveDealerNeutral()` and commercial confidence |

# CODEX: Dealer Neutral Resolver — Canonicalize + Commercial Direction Research

**Date:** 2026-04-04

This prompt has two independent parts:
- **Part A:** Ship the dealer neutral resolver into the engine (implementation)
- **Part B:** Research whether commercial directions can be improved (research only, no engine changes)

---

## Part A: Dealer Neutral Resolver — Canonicalize

### What we're shipping

A 5-tier resolver that fills dealer neutral gaps to achieve 36/36 FX pair coverage per week. Non-neutral dealer logic is UNTOUCHED. Only pairs that would otherwise be NEUTRAL get the resolver.

**Validated results (corrected research pass):**
- Baseline: 230 trades, +73.18%, 2.19% DD, 56.5% WR
- With resolver: 359 trades, near-identical performance, near-36/36 coverage
- 1 unresolved pair-week (NZDUSD 2026-02-09) due to all tiers tying — fixed by adding Tier 4+5

### Resolver hierarchy

For each neutral dealer pair, try tiers in order. First tier that produces a direction wins.

**Tier 1 — Spread directional ratio:**
For each currency: `ratio = abs(dealer_net) / (abs(dealer_net) + dealer_spread)`. Skip if `dealer_spread` is null.
For the pair: `score = base_ratio - quote_ratio`. Direction = `score > 0 ? "LONG" : score < 0 ? "SHORT" : null`.

**CRITICAL:** This is the simple version. Do NOT follow the "more committed currency's lean." Just use `directionFromScore(baseRatio - quoteRatio)`. This is what produced 61% WR in the deep-history research. The version that followed the currency's dealer_net sign produced 49% WR — that was wrong.

```typescript
function directionFromScore(score: number | null): Direction | null {
  if (typeof score !== "number" || !Number.isFinite(score) || score === 0) return null;
  return score > 0 ? "LONG" : "SHORT";
}
```

**Tier 2 — Delta persistence (≥3 of 4 weeks):**
For each currency, count how many of the prior 4 weekly snapshots had `dealer_delta_net` with the same sign as the current `dealer_delta_net`. Score 0-4. Only resolves if one currency has score ≥ 3 and the other has score < 3.

Direction follows the higher-persistence currency's `dealer_delta_net` sign:
- If base wins: `base.dealer_delta_net > 0 ? "LONG" : "SHORT"`
- If quote wins: `quote.dealer_delta_net > 0 ? "SHORT" : "LONG"` (inverted because quote)

If both ≥ 3 or both < 3 → no resolution, fall through.

**Tier 3 — OI-confirmed delta:**
A currency has "confirmed delta" when `dealer_delta_net` and `oi_delta` have the same sign (both positive or both negative), and both are non-zero.

- If only base is confirmed → follow base delta direction: `base.dealer_delta_net > 0 ? "LONG" : "SHORT"`
- If only quote is confirmed → follow quote delta direction: `quote.dealer_delta_net > 0 ? "SHORT" : "LONG"`
- If both confirmed → use pair delta score: `directionFromScore(base.dealer_delta_net - quote.dealer_delta_net)`
- If neither confirmed → no resolution, fall through.

**Tier 4 — Raw delta difference:**
`directionFromScore(base.dealer_delta_net - quote.dealer_delta_net)`. Simple delta difference without OI confirmation. Weaker signal but catches most remaining edge cases.

**Tier 5 — Forced lean (last resort):**
`directionFromScore(base.dealer_net - quote.dealer_net)`. Raw net difference. Guaranteed to produce a direction if both currencies have non-zero nets. This is the same as "lean" which tested poorly at 34.6% WR across ALL neutrals, but as a last-resort catch-all for the 1-2 pairs that slip through Tiers 1-4, it's acceptable.

### Implementation

#### 1. New fields in `src/lib/cotTypes.ts`

Add to `MarketSnapshot`:
```typescript
dealer_directional_ratio?: number | null;
dealer_delta_persistence?: number | null;  // 0-4 score
```

#### 2. New fields in `src/lib/cotCompute.ts`

Add to `CotEnrichment`:
```typescript
dealer_directional_ratio?: number | null;
dealer_delta_persistence?: number | null;
```

#### 3. Compute `dealer_directional_ratio` in `buildMarketSnapshot()`

Add after the existing enrichment computations:

```typescript
const dealerDirectionalRatio =
  typeof enrichment?.dealer_spread === "number" && enrichment.dealer_spread >= 0
    ? Math.abs(dealerNet) / (Math.abs(dealerNet) + enrichment.dealer_spread)
    : null;
```

Include in the return object:
```typescript
dealer_directional_ratio: dealerDirectionalRatio,
dealer_delta_persistence: enrichment?.dealer_delta_persistence ?? null,
```

#### 4. Compute `dealer_delta_persistence` in `refreshSnapshotForClass()` in `src/lib/cotStore.ts`

After building all currencies but BEFORE deriving pairs:

```typescript
// Load 4 most recent prior snapshots for persistence computation
const priorDates = (await listSnapshotDates(assetClass))
  .filter(d => d < resolvedReportDate)
  .sort()
  .slice(-4);

if (priorDates.length > 0) {
  const priorSnapshots = (await Promise.all(
    priorDates.map(d => readSnapshot({ assetClass, reportDate: d }))
  )).filter(Boolean);

  for (const [ccyId, snapshot] of Object.entries(currencies)) {
    const currentDelta = snapshot.dealer_delta_net;
    if (typeof currentDelta === "number" && currentDelta !== 0) {
      const currentSign = currentDelta > 0 ? 1 : -1;
      let count = 0;
      for (const prior of priorSnapshots) {
        const priorDelta = prior?.currencies?.[ccyId]?.dealer_delta_net;
        if (typeof priorDelta === "number" && priorDelta !== 0) {
          if ((priorDelta > 0 ? 1 : -1) === currentSign) count++;
        }
      }
      snapshot.dealer_delta_persistence = count;
    }
  }
}
```

**IMPORTANT:** `listSnapshotDates` and `readSnapshot` are already cached. This adds minimal overhead.

#### 5. New resolver function in `src/lib/cotCompute.ts`

```typescript
export function resolveDealerNeutral(
  base: MarketSnapshot,
  quote: MarketSnapshot,
): Direction | null {
  // Helper
  const fromScore = (score: number | null | undefined): Direction | null => {
    if (typeof score !== "number" || !Number.isFinite(score) || score === 0) return null;
    return score > 0 ? "LONG" : "SHORT";
  };

  // Tier 1: Spread directional ratio — simple score difference
  if (typeof base.dealer_directional_ratio === "number" && typeof quote.dealer_directional_ratio === "number") {
    const dir = fromScore(base.dealer_directional_ratio - quote.dealer_directional_ratio);
    if (dir) return dir;
  }

  // Tier 2: Delta persistence — higher-persistence side wins (must be ≥3)
  const bp = base.dealer_delta_persistence ?? 0;
  const qp = quote.dealer_delta_persistence ?? 0;
  if (bp !== qp && (bp >= 3 || qp >= 3)) {
    if (bp > qp && bp >= 3 && typeof base.dealer_delta_net === "number" && base.dealer_delta_net !== 0) {
      return base.dealer_delta_net > 0 ? "LONG" : "SHORT";
    }
    if (qp > bp && qp >= 3 && typeof quote.dealer_delta_net === "number" && quote.dealer_delta_net !== 0) {
      return quote.dealer_delta_net > 0 ? "SHORT" : "LONG";
    }
  }

  // Tier 3: OI-confirmed delta
  const baseConf = typeof base.dealer_delta_net === "number" && typeof base.oi_delta === "number"
    && base.dealer_delta_net !== 0 && base.oi_delta !== 0
    && Math.sign(base.dealer_delta_net) === Math.sign(base.oi_delta);
  const quoteConf = typeof quote.dealer_delta_net === "number" && typeof quote.oi_delta === "number"
    && quote.dealer_delta_net !== 0 && quote.oi_delta !== 0
    && Math.sign(quote.dealer_delta_net) === Math.sign(quote.oi_delta);

  if (baseConf && !quoteConf) {
    return base.dealer_delta_net! > 0 ? "LONG" : "SHORT";
  }
  if (quoteConf && !baseConf) {
    return quote.dealer_delta_net! > 0 ? "SHORT" : "LONG";
  }
  if (baseConf && quoteConf) {
    const dir = fromScore((base.dealer_delta_net ?? 0) - (quote.dealer_delta_net ?? 0));
    if (dir) return dir;
  }

  // Tier 4: Raw delta difference
  if (typeof base.dealer_delta_net === "number" && typeof quote.dealer_delta_net === "number") {
    const dir = fromScore(base.dealer_delta_net - quote.dealer_delta_net);
    if (dir) return dir;
  }

  // Tier 5: Forced lean (last resort)
  return fromScore(base.dealer_net - quote.dealer_net);
}
```

#### 6. Wire into direction derivation

In `derivePairDirections()`, replace the neutral-skip logic for dealer mode:

```typescript
// CURRENT CODE (lines ~379-385):
if (baseBias.bias === "NEUTRAL" || quoteBias.bias === "NEUTRAL") {
  continue;
}
if (baseBias.bias === quoteBias.bias) {
  continue;
}

// REPLACE WITH:
const isNeutral =
  baseBias.bias === "NEUTRAL" || quoteBias.bias === "NEUTRAL" || baseBias.bias === quoteBias.bias;
if (isNeutral) {
  if (mode === "dealer") {
    const resolved = resolveDealerNeutral(base, quote);
    if (resolved && resolved !== "NEUTRAL") {
      pairs[pairDef.pair] = {
        direction: resolved,
        base_bias: baseBias.bias,
        quote_bias: quoteBias.bias,
      };
    }
  }
  continue;
}
```

Apply the **same change** to `derivePairDirectionsWithNeutral()`:

In the section that handles neutral dealer pairs (lines ~477-484), change to:

```typescript
if (baseBias.bias === "NEUTRAL" || quoteBias.bias === "NEUTRAL") {
  if (mode === "dealer") {
    const resolved = resolveDealerNeutral(base, quote);
    if (resolved && resolved !== "NEUTRAL") {
      pairs[pairDef.pair] = {
        direction: resolved,
        base_bias: baseBias.bias,
        quote_bias: quoteBias.bias,
      };
      continue;
    }
  }
  pairs[pairDef.pair] = {
    direction: "NEUTRAL",
    base_bias: baseBias.bias,
    quote_bias: quoteBias.bias,
  };
  continue;
}

if (baseBias.bias === quoteBias.bias) {
  if (mode === "dealer") {
    const resolved = resolveDealerNeutral(base, quote);
    if (resolved && resolved !== "NEUTRAL") {
      pairs[pairDef.pair] = {
        direction: resolved,
        base_bias: baseBias.bias,
        quote_bias: quoteBias.bias,
      };
      continue;
    }
  }
  pairs[pairDef.pair] = {
    direction: "NEUTRAL",
    base_bias: baseBias.bias,
    quote_bias: quoteBias.bias,
  };
  continue;
}
```

**Do NOT change** `derivePairDirectionsByBase()` or `derivePairDirectionsByBaseWithNeutral()`. Those are used for non-FX asset classes.

**Do NOT change** any commercial logic. Commercial stays exactly as-is.

#### 7. Tests

In `src/lib/__tests__/cotCompute.test.ts`, add:

```typescript
describe("resolveDealerNeutral", () => {
  it("resolves via spread ratio when ratios differ", () => {
    const base = { ...neutralSnapshot, dealer_directional_ratio: 0.8 };
    const quote = { ...neutralSnapshot, dealer_directional_ratio: 0.3 };
    expect(resolveDealerNeutral(base, quote)).toBe("LONG");
  });

  it("returns SHORT when quote ratio is higher", () => {
    const base = { ...neutralSnapshot, dealer_directional_ratio: 0.2 };
    const quote = { ...neutralSnapshot, dealer_directional_ratio: 0.7 };
    expect(resolveDealerNeutral(base, quote)).toBe("SHORT");
  });

  it("falls through to delta persistence when ratios are equal", () => {
    const base = {
      ...neutralSnapshot,
      dealer_directional_ratio: 0.5,
      dealer_delta_persistence: 4,
      dealer_delta_net: 1000,
    };
    const quote = {
      ...neutralSnapshot,
      dealer_directional_ratio: 0.5,
      dealer_delta_persistence: 1,
      dealer_delta_net: -500,
    };
    expect(resolveDealerNeutral(base, quote)).toBe("LONG");
  });

  it("falls through to forced lean as last resort", () => {
    const base = { ...neutralSnapshot, dealer_net: 100 };
    const quote = { ...neutralSnapshot, dealer_net: -200 };
    expect(resolveDealerNeutral(base, quote)).toBe("LONG");
  });

  it("does not affect non-neutral pairs", () => {
    // Verify derivePairDirections still produces the same result for BULLISH vs BEARISH
    // by running with known test data and confirming output matches
  });
});
```

Create a `neutralSnapshot` test helper that has all required MarketSnapshot fields with neutral/zero values.

#### 8. Validation

1. `npx eslint src/lib/cotCompute.ts src/lib/cotTypes.ts src/lib/cotStore.ts --max-warnings=0`
2. `npx vitest run src/lib/__tests__/cotCompute.test.ts`
3. Existing tests must still pass — the resolver only applies to dealer neutral pairs

---

## Part B: Commercial Direction Research

**Script:** `scripts/research-cot-commercial-direction.ts`
**Output:** `docs/COT_COMMERCIAL_DIRECTION_RESEARCH_2026-04-04.md`

**Goal:** Find a better way to derive commercial pair directions than forced-raw (`base_commercial_net - quote_commercial_net`). Current baseline: 280 trades, +23.41%, 52.9% WR over 10 weeks.

**The problem:** Commercial net represents hedger positioning — driven by business exposure, not market views. The raw net level may not carry directional signal. But changes in positioning (delta) or relative positioning (OI-normalized) might.

### Baselines

Reproduce commercial forced-raw baseline:
```
Baseline                    | Pairs | Total% | MaxDD% | Win%
────────────────────────────┼───────┼────────┼────────┼──────
Commercial forced-raw       | 280   | +23.41 | 29.04  | 52.9
```

### Test 1: Alternative direction methods

Test each method as a REPLACEMENT for forced-raw direction (not a filter — a new direction signal for all 280 pair-weeks):

**1a. Delta-based direction:**
Instead of absolute net, use weekly change: `base_commercial_delta_net - quote_commercial_delta_net`.
`commercial_delta_net = delta_long - delta_short` (NOT inverted like dealer).
Direction: positive → LONG, negative → SHORT.

**1b. OI-normalized direction:**
`(base_commercial_net / base_open_interest) - (quote_commercial_net / quote_open_interest)`.
Normalizes by market size — removes the raw contract-count bias.

**1c. 4-week net change as direction:**
`(base_commercial_net_current - base_commercial_net_4wk_ago) - (quote_commercial_net_current - quote_commercial_net_4wk_ago)`.
What has changed over the last month, not where the net sits today.

**1d. Non-commercial (large spec) direction:**
`base_noncomm_net - quote_noncomm_net` as direction signal.
Non-commercial represents large speculators (hedge funds, CTAs in the legacy report). They trade momentum, not hedging.

```
Method (replaces forced-raw)    | Pairs | Total% | MaxDD% | Win% | vs Baseline
────────────────────────────────┼───────┼────────┼────────┼──────┼───────────
Forced-raw baseline             | 280   | +23.41 | 29.04  | 52.9 | —
Delta-based direction           | ???   | ???    | ???    | ???  | +/-X%
OI-normalized direction         | ???   | ???    | ???    | ???  | +/-X%
4-week net change direction     | ???   | ???    | ???    | ???  | +/-X%
Non-commercial direction        | ???   | ???    | ???    | ???  | +/-X%
```

Note: some methods may produce fewer than 280 pairs if data is missing (null delta, null OI, etc.). Report actual pair count.

### Test 2: Blended direction methods

Test blending forced-raw with other signals:

**2a. Net + delta agreement:**
Only trade when forced-raw and delta-based direction agree. Skip when they disagree.

**2b. Net + non-commercial agreement:**
Only trade when commercial forced-raw and non-commercial direction agree.

**2c. Forced-raw flipped by delta:**
Start with forced-raw direction. If commercial delta persistence (≥3 of 4 weeks) points the OPPOSITE direction, flip the trade. Otherwise keep forced-raw.

```
Blended method                  | Pairs | Total% | MaxDD% | Win% | vs Baseline
────────────────────────────────┼───────┼────────┼──────── ┼──────┼───────────
Forced-raw baseline             | 280   | +23.41 | 29.04  | 52.9 | —
Net + delta agree               | ???   | ???    | ???    | ???  | +/-X%
Net + noncomm agree             | ???   | ???    | ???    | ???  | +/-X%
Forced-raw flipped by delta     | ???   | ???    | ???    | ???  | +/-X%
```

### Test 3: Magnitude threshold

Test whether large net differences are better than small ones:

Compute `|base_commercial_net - quote_commercial_net|` for each pair-week. Split into terciles (top third, middle third, bottom third) by absolute magnitude.

```
Magnitude bucket                | Pairs | Total% | Win% | Avg%
────────────────────────────────┼───────┼────────┼──────┼──────
All (baseline)                  | 280   | +23.41 | 52.9 | +0.084
Top third (largest difference)  | ???   | ???    | ???  | ???
Middle third                    | ???   | ???    | ???  | ???
Bottom third (smallest diff)    | ???   | ???    | ???  | ???
```

Also test a simple threshold: only trade when `|net_diff| > median`. Report how many pairs that filters and the resulting performance.

### Test 4: Best method standalone result

Take the single best alternative direction method from Tests 1-3 and compute its full 10-week standalone result (Total%, MaxDD%, Win%) exactly like the engine computes it — all 36 pairs per week, ADR-normalized.

```
Commercial System               | Trades | Total% | MaxDD% | Win%
────────────────────────────────┼────────┼────────┼────────┼──────
Forced-raw (current)            | 280    | +23.41 | 29.04  | 52.9
Best alternative                | ???    | ???    | ???    | ???
```

### Loading

Use the same loading pattern as prior research scripts:
- `listDataSectionWeeks()` for 10 backtestable weeks
- `readSnapshot()` for current week data
- `listSnapshotDates()` + `readSnapshot()` for prior snapshots (4-week lookback for delta persistence, 4-week-ago net for change direction)
- ADR-normalize all returns

### Important notes

1. **Commercial delta net is NOT inverted.** `commercial_delta_net = delta_long - delta_short`. Positive means commercials are adding longs.
2. **Dealer delta net IS inverted.** `dealer_delta_net = delta_short - delta_long`. Don't mix them up.
3. **Non-commercial fields:** `noncomm_net` is already stored in the snapshot as `noncomm_long - noncomm_short`.
4. **OI normalization:** `open_interest` is in the snapshot. If null for a currency, skip that pair for the OI-normalized test.
5. **Delta-based direction may have fewer than 280 pairs** if `commercial_delta_net` is null for some currencies. That's fine — report the actual count.
6. **For 4-week net change:** load the snapshot from 4 weeks prior. Use `listSnapshotDates()` to find the closest date ≤ 4 weeks before current report date.
7. **The research script must reproduce the forced-raw baseline exactly (280 pairs, +23.41%, 52.9% WR) before proceeding.** If it doesn't match, stop and report.
8. **Do NOT change any engine code for Part B.** This is research only.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/lib/cotTypes.ts` | Add `dealer_directional_ratio`, `dealer_delta_persistence` to MarketSnapshot |
| `src/lib/cotCompute.ts` | Add fields to CotEnrichment; add `resolveDealerNeutral()`; wire into `derivePairDirections()` and `derivePairDirectionsWithNeutral()` |
| `src/lib/cotStore.ts` | Compute `dealer_delta_persistence` in `refreshSnapshotForClass()` |
| `src/lib/__tests__/cotCompute.test.ts` | Tests for `resolveDealerNeutral()` |
| `scripts/research-cot-commercial-direction.ts` | New research script (Part B) |
| `docs/COT_COMMERCIAL_DIRECTION_RESEARCH_2026-04-04.md` | Research output (Part B) |

---

## Warnings

1. **Spread ratio direction is SIMPLE:** `directionFromScore(baseRatio - quoteRatio)`. Do NOT follow the more committed currency's lean. This was validated at 61% WR. The lean-following version produced 49% WR.
2. **Non-neutral dealer pairs must be completely unaffected.** The resolver only fires when a pair would be NEUTRAL (either currency is NEUTRAL, or both have the same bias). Run the existing test suite to verify.
3. **Tier 5 (forced lean) is a last resort** expected to fire on ~1 pair per 10 weeks. It exists to guarantee 36/36, not as a quality signal.
4. **For Part B: these are ALTERNATIVE direction methods being tested against forced-raw.** They are NOT filters on top of forced-raw. Each method produces its own direction for each pair, independent of forced-raw.

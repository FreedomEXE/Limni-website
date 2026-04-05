# CODEX: Non-FX Direction Logic — Base vs USD Comparison + Resolver Coverage

**Date:** 2026-04-04
**Goal:** Bring non-FX asset classes (indices, crypto, commodities) up to the same architecture as FX — full coverage with smart dealer/commercial direction logic. Currently non-FX uses `derivePairDirectionsByBase()` which only looks at the base currency bias, ignoring USD entirely. All non-FX pairs are priced against USD (BTCUSD, XAUUSD, SPXUSD, etc.), so comparing base vs USD is the natural extension.

**Context:** FX dealer and commercial are shipped with:
- Dealer: 5-tier neutral resolver (spread ratio → delta persistence → OI-confirm → delta fallback → forced lean) achieving 36/36 coverage, +97% total, 0% DD, 58% WR
- Commercial: forced-raw with delta persistence flip, +39% total, 13.6% DD, 54.4% WR

The same enrichment data (dealer_spread, dealer_delta_persistence, dealer_directional_ratio, commercial_delta_persistence) is computed for ALL asset classes during snapshot refresh. The direction logic just doesn't use it for non-FX yet because `derivePairDirectionsByBase()` doesn't compare two currencies.

---

## Phase 1: Research

**Script:** `scripts/research-cot-non-fx-direction.ts`
**Output:** `docs/COT_NON_FX_DIRECTION_RESEARCH_2026-04-04.md`

### Data loading

Use `listDataSectionWeeks()` to get backtestable weeks. These weeks should have price returns for ALL asset classes, not just FX. Load returns via `getWeeklyPairReturns(weekOpenUtc)` (no asset class filter) — this returns all pairs.

For each backtestable week, load:
- The non-FX snapshots: `readSnapshot({ assetClass: "indices", reportDate })`, same for "crypto" and "commodities"
- The FX snapshot: `readSnapshot({ assetClass: "fx", reportDate })` — to extract USD data
- For delta persistence context: prior 4 snapshots for each asset class AND for FX (to get USD history)

**ADR data:** Load ADR for non-FX pairs from `getCanonicalInstrument()` and the standard ADR source used by research scripts. ADR-normalize all returns with targetAdr = 1.0%.

### Non-FX pair definitions

```typescript
// From cotPairs.ts:
indices:     SPXUSD (SPX vs USD), NDXUSD (NDX vs USD), NIKKEIUSD (NIKKEI vs USD)
crypto:      BTCUSD (BTC vs USD), ETHUSD (ETH vs USD)
commodities: XAUUSD (XAU vs USD), XAGUSD (XAG vs USD), WTIUSD (WTI vs USD)
```

Total: 8 non-FX pairs × N backtestable weeks.

### Test 3 options

**Option 1: Base-only baseline (current behavior)**

For each non-FX pair-week, derive direction using `derivePairDirectionsByBase()` with dealer mode:
- Base is BULLISH → LONG
- Base is BEARISH → SHORT
- Base is NEUTRAL → no trade (skip)

Do the same for commercial mode.

Report per asset class:

```
Option 1: Base-only (dealer)     | Asset Class  | Pairs | Trades | Total% | MaxDD% | Win%
─────────────────────────────────┼──────────────┼───────┼────────┼────────┼────────┼──────
                                 | indices      | ???   | ???    | ???    | ???    | ???
                                 | crypto       | ???   | ???    | ???    | ???    | ???
                                 | commodities  | ???   | ???    | ???    | ???    | ???
                                 | combined     | ???   | ???    | ???    | ???    | ???
```

Same table for commercial mode.

**Option 2: Base vs USD comparison**

For each non-FX pair-week:
1. Load the non-FX snapshot for the asset class
2. Load the FX snapshot for the same report date
3. Extract USD's `MarketSnapshot` from the FX snapshot: `fxSnapshot.currencies["USD"]`
4. If USD data is missing for that report date → fall back to Option 1 (base-only) for that pair-week
5. Build a temporary currencies map: `{ [base]: baseSnapshot, USD: usdSnapshot }`
6. Run `derivePairDirections()` on this map with the pair definition — this gives you the two-currency comparison including the neutral resolver for dealer mode, and the delta-flip for commercial mode

For dealer mode, the resolver stack applies:
- If base BULLISH + USD BEARISH → LONG (standard)
- If base BEARISH + USD BULLISH → SHORT (standard)
- If both same bias or one NEUTRAL → resolver fires (spread ratio, delta persistence, OI-confirm, delta fallback, forced lean)

For commercial mode, the delta-flip applies:
- `resolveCommercialFxDirection(base, usd)` — forced-raw net comparison with persistence flip

**IMPORTANT:** When computing USD's delta persistence for this comparison, use the FX snapshot's prior snapshots (the persistence is already stored in the FX snapshot's USD MarketSnapshot as `dealer_delta_persistence` and `commercial_delta_persistence`). Do NOT recompute it.

Report per asset class (same table format as Option 1).

**Option 3: Base-only with single-currency resolver**

For each non-FX pair-week where the base is NEUTRAL:
1. Use the base currency's enrichment data alone to resolve:
   - **Spread ratio signal:** `base.dealer_directional_ratio > 0.5` → the dealer book is mostly directional → treat as directional. Direction = sign of `base.dealer_net` (remember inverted: `dealer_net > 0` = BULLISH).
   - **Delta persistence signal:** `base.dealer_delta_persistence >= 3` → dealers have been consistently adding. Direction = sign of `base.dealer_delta_net`.
   - **OI-confirmed delta:** delta and OI same sign → direction = sign of delta.
   - **Forced lean:** direction = sign of `base.dealer_net`.
2. Try in order: spread ratio → delta persistence → OI-confirm → forced lean. First hit wins.
3. For commercial: if base NEUTRAL in forced-raw terms (`commercial_net = 0`), use commercial delta persistence to pick direction. If not neutral, use standard base-only bias.

Report per asset class (same table format).

### Summary tables

After all 3 options, produce a combined comparison:

```
Dealer comparison          | Trades | Total% | MaxDD% | Win% | Coverage
───────────────────────────┼────────┼────────┼────────┼──────┼─────────
Option 1: Base-only        | ???    | ???    | ???    | ???  | ???/80
Option 2: Base vs USD      | ???    | ???    | ???    | ???  | ???/80
Option 3: Single-ccy resv  | ???    | ???    | ???    | ???  | ???/80
```

(Coverage = out of 8 pairs × 10 weeks = 80 possible pair-weeks)

Same for commercial.

Also produce per-asset-class winner table:

```
Best dealer method by class | indices | crypto | commodities
────────────────────────────┼─────────┼────────┼────────────
Winner                      | ???     | ???    | ???
Win% gain vs baseline       | ???     | ???    | ???
```

---

## Phase 2: Implementation (conditional)

**Proceed ONLY if at least one option beats baseline on the combined non-FX result** for both dealer and commercial. If Option 2 and Option 3 both beat baseline, **prefer Option 2** (base vs USD) because it unifies the architecture.

### If Option 2 wins (preferred): USD injection

#### 2A. Inject USD into non-FX snapshots at refresh time

In `refreshSnapshotForClass()` in `src/lib/cotStore.ts`, for non-FX asset classes:

```typescript
// After building currencies from the asset class's own markets,
// and after computing delta persistence from prior snapshots:

if (assetClass !== "fx") {
  // Load the FX snapshot for the same report date to get USD data
  const fxSnapshot = await readSnapshot({ assetClass: "fx", reportDate: resolvedReportDate });
  const usdData = fxSnapshot?.currencies?.["USD"];
  if (usdData) {
    currencies["USD"] = usdData;
  }
}
```

This must happen AFTER the delta persistence computation (so USD's persistence is already in the FX snapshot from FX's own refresh).

**IMPORTANT:** The FX snapshot must already exist for that report date. In `refreshAllSnapshots()`, FX is refreshed alongside other classes via `Promise.all()`. To ensure FX is available first, change the refresh order:

```typescript
export async function refreshAllSnapshots(reportDate?: string): Promise<Record<AssetClass, CotSnapshot>> {
  // Refresh FX first — non-FX needs USD from FX snapshot
  const fxSnapshot = await refreshSnapshotForClass("fx", reportDate);

  const nonFxClasses: AssetClass[] = ["indices", "crypto", "commodities"];
  const nonFxEntries = await Promise.all(
    nonFxClasses.map(async (ac) => [ac, await refreshSnapshotForClass(ac, reportDate)] as const),
  );

  return Object.fromEntries([["fx", fxSnapshot], ...nonFxEntries]) as Record<AssetClass, CotSnapshot>;
}
```

#### 2B. Switch direction derivation for non-FX

In `refreshSnapshotForClass()`, change line ~393-396:

```typescript
// BEFORE:
const pairs =
  assetClass === "fx"
    ? derivePairDirections(currencies, pairDefs, biasMode)
    : derivePairDirectionsByBase(currencies, pairDefs, biasMode);

// AFTER:
const pairs = derivePairDirections(currencies, pairDefs, biasMode);
```

Now ALL asset classes use the same direction logic. For non-FX pairs:
- If USD was injected → two-currency comparison works, resolver fires on neutrals, commercial flip applies
- If USD was NOT injected (missing FX snapshot) → `!baseBias || !quoteBias` check fails → pair is skipped (safe fallback)

#### 2C. Update other callers

Search all files that call `derivePairDirectionsByBase()` and update them to use `derivePairDirections()` when operating on non-FX pairs that have USD as the quote. The key callers:

- `src/lib/basketSignals.ts` — currently chooses between the two based on a flag. Update to always use `derivePairDirections()`.
- `src/lib/antikythera.ts` — same pattern
- `src/lib/performanceLab.ts` — same pattern
- `src/lib/bitgetBotEngine.ts` — uses `derivePairDirectionsByBase` only. Update.
- `src/app/dashboard/page.tsx` — uses WithNeutral variants
- `src/app/api/flagship/cot-matrix/route.ts`
- `src/app/api/flagship/crypto-matrix/route.ts`
- `src/app/api/performance/gated-setups/route.ts`
- `src/lib/performance/basketSource.ts`

**For each caller:** if it loads a snapshot for display/analysis, and the snapshot was already refreshed with USD injected, then `derivePairDirections()` will work because USD is already in `snapshot.currencies`. No additional loading needed at call sites.

**For callers that pass raw snapshot data:** Verify that the snapshot's `currencies` object includes USD for non-FX snapshots. If the snapshot was written after this change, it will. For historical snapshots without USD, the fallback is safe (pair skipped).

**DO NOT change `derivePairDirectionsByBase()` or `derivePairDirectionsByBaseWithNeutral()` themselves.** Keep them intact for any edge case or backward compat. Just stop calling them for the standard pair derivation path.

### If Option 3 wins (fallback): Single-currency resolver

#### 3A. Add resolver to `derivePairDirectionsByBase()`

In `src/lib/cotCompute.ts`, modify `derivePairDirectionsByBase()`:

```typescript
export function derivePairDirectionsByBase(
  markets: Record<string, MarketSnapshot>,
  pairDefs: PairDefinition[],
  mode: BiasMode = "dealer",
): Record<string, PairSnapshot> {
  const pairs: Record<string, PairSnapshot> = {};

  for (const pairDef of pairDefs) {
    const base = markets[pairDef.base];
    const baseBias = base ? resolveMarketBias(base, mode) : null;

    if (!baseBias) {
      continue;
    }

    if (baseBias.bias === "NEUTRAL") {
      if (mode === "dealer") {
        const resolved = resolveSingleCurrencyNeutral(base);
        if (resolved) {
          pairs[pairDef.pair] = {
            direction: resolved,
            base_bias: baseBias.bias,
            quote_bias: "NEUTRAL",
          };
        }
      }
      continue;
    }

    pairs[pairDef.pair] = {
      direction: baseBias.bias === "BULLISH" ? "LONG" : "SHORT",
      base_bias: baseBias.bias,
      quote_bias: markets[pairDef.quote] ? resolveMarketBias(markets[pairDef.quote]!, mode)?.bias ?? "NEUTRAL" : "NEUTRAL",
    };
  }

  return pairs;
}
```

#### 3B. Add single-currency resolver function

```typescript
export function resolveSingleCurrencyNeutral(market: MarketSnapshot): Direction | null {
  // Tier 1: Spread ratio — is the book directional enough?
  if (typeof market.dealer_directional_ratio === "number" && market.dealer_directional_ratio > 0.5) {
    if (market.dealer_net > 0) return "LONG";
    if (market.dealer_net < 0) return "SHORT";
  }

  // Tier 2: Delta persistence
  if (typeof market.dealer_delta_persistence === "number" && market.dealer_delta_persistence >= 3) {
    if (typeof market.dealer_delta_net === "number" && market.dealer_delta_net !== 0) {
      return market.dealer_delta_net > 0 ? "LONG" : "SHORT";
    }
  }

  // Tier 3: OI-confirmed delta
  if (typeof market.dealer_delta_net === "number" && typeof market.oi_delta === "number"
    && market.dealer_delta_net !== 0 && market.oi_delta !== 0
    && Math.sign(market.dealer_delta_net) === Math.sign(market.oi_delta)) {
    return market.dealer_delta_net > 0 ? "LONG" : "SHORT";
  }

  // Tier 4: Forced lean
  if (market.dealer_net !== 0) {
    return market.dealer_net > 0 ? "LONG" : "SHORT";
  }

  return null;
}
```

Apply same pattern to `derivePairDirectionsByBaseWithNeutral()`.

---

## Validation

1. `npx eslint src/lib/cotCompute.ts src/lib/cotStore.ts src/lib/cotTypes.ts --max-warnings=0`
2. `npx vitest run src/lib/__tests__/cotCompute.test.ts`
3. All existing tests must pass
4. If Option 2 is shipped: verify that refreshing all snapshots produces correct non-FX snapshots with USD data included

---

## Important Warnings

1. **USD data must come from the FX snapshot with the SAME report date.** Do not use a different date's USD data. If the FX snapshot for that date doesn't exist or doesn't contain USD, fall back to base-only behavior for that pair-week.
2. **Refresh order matters.** FX must be refreshed before non-FX so USD data is available. Change `refreshAllSnapshots()` to refresh FX first.
3. **`dealer_net` inversion applies to USD too.** USD dealer_net uses the same convention: `short - long`. `dealer_net > 0` = BULLISH.
4. **Commercial delta for non-FX:** Commodities use the `disaggregated` source, not `legacy`. The `commercial_delta_net` computation is `delta_long - delta_short` (NOT inverted). The `resolveCommercialFxDirection` function works regardless of source because it operates on `commercial_net` and `commercial_delta_persistence` which are already in the snapshot.
5. **Do NOT rename `resolveCommercialFxDirection`.** Despite the "Fx" in its name, it will now apply to all asset classes. Add a comment noting this but don't rename to avoid unnecessary churn.
6. **Historical non-FX snapshots won't have USD data.** Only snapshots refreshed after this change will include USD in non-FX currencies. This is fine — the direction derivation handles missing quote data gracefully.
7. **Non-FX has fewer pairs (8 total).** Results will have smaller sample sizes. Report the actual pair counts clearly.
8. **If some asset classes are helped and others are hurt by an option,** still report the combined result but call out the divergence. The decision may be: use Option 2 for indices/commodities and Option 1 for crypto, for example. If this per-class routing is the winner, implement it.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `scripts/research-cot-non-fx-direction.ts` | New research script |
| `docs/COT_NON_FX_DIRECTION_RESEARCH_2026-04-04.md` | Research output |
| `src/lib/cotStore.ts` | Inject USD into non-FX snapshots; change refresh order; switch to `derivePairDirections()` for non-FX (if Option 2) |
| `src/lib/cotCompute.ts` | Add `resolveSingleCurrencyNeutral()` (if Option 3); update `derivePairDirectionsByBase()` (if Option 3) |
| `src/lib/basketSignals.ts` | Update to use `derivePairDirections()` for non-FX (if Option 2) |
| `src/lib/antikythera.ts` | Same |
| `src/lib/performanceLab.ts` | Same |
| `src/lib/bitgetBotEngine.ts` | Same |
| `src/lib/performance/basketSource.ts` | Same |
| Various route files | Update if needed for snapshot display |

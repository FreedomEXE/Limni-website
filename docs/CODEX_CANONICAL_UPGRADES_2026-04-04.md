# CODEX: Canonical Infrastructure Upgrades

**Date:** 2026-04-04
**Goal:** Two foundational changes that all future systems build on. Phase 1 makes ADR normalization the default risk layer. Phase 2 changes how commercial direction is calculated at the source.

**These are intentional historical rebasings, not bugfixes.** All historical weeks will recompute with the new canonical layers. Past performance numbers WILL change — that's the point. Every system, every week, every cached artifact gets rebased to the new canonical truth. Everything downstream recomputes automatically once the source logic changes.

---

## PHASE 1: ADR Normalization as Canonical Risk Layer

### What and Why
ADR normalization equalizes position risk across asset classes. A 1% move in EURUSD (ADR ~0.6%) is treated differently than a 1% move in BTCUSD (ADR ~3.5%). Our backtests consistently show ADR normalization improves results across every system. It should be the default, not an optional overlay.

Currently it's a **Filter 2 dropdown option** ("ADR Normalized" vs "None"). We want to:
1. **Always apply ADR normalization** — it's no longer optional
2. **Free up Filter 2** — the dropdown stays in the UI but is empty (ready for future DCA/daily adds layer)
3. **Invalidate all cached results** so they recompute with normalization baked in

### Current Architecture

**Filter 2 config** — `src/lib/performance/strategyConfig.ts` (lines 177-196):
```typescript
export const STRENGTH_GATES: StrengthGateConfig[] = [
  { id: "none", label: "None", description: "No overlay — raw 1:1 price mapping" },
  { id: "adr_normalized", label: "ADR Normalized", description: "Equalize position risk..." },
];
```

**Default selection** — `src/lib/performance/strategyConfig.ts` (line 211):
```typescript
const strengthGateId = isKnownId(STRENGTH_GATES, rawF2) ? rawF2 : "adr_normalized";
```
Already defaults to "adr_normalized" — but it's still a selectable option.

**Overlay application** — `src/lib/performance/weeklyHoldEngine.ts` (lines 119-148):
```typescript
async function applyOverlay(
  result: WeeklyHoldResult,
  strengthGate: StrengthGateConfig | undefined,
): Promise<WeeklyHoldResult> {
  if (strengthGate?.id !== "adr_normalized") return result;  // ← THIS GUARD GOES AWAY

  const adrMap = await loadWeeklyAdrMap(result.weekOpenUtc);
  const targetAdr = getTargetAdrPct();

  const normalizedTrades = result.trades.map((trade) => {
    const pairAdr = trade.detail?.adrPct && trade.detail.adrPct > 0
      ? trade.detail.adrPct
      : getAdrPct(adrMap, trade.symbol, trade.assetClass);
    const multiplier = targetAdr / pairAdr;
    return { ...trade, returnPct: trade.returnPct * multiplier };
  });
  // ... recalculates totalReturn, wins, losses, winRate
}
```

**Called from** — `src/lib/performance/weeklyHoldEngine.ts` (line 579):
```typescript
return applyOverlay(result, strengthGate);
```

**Also called from computeMultiWeekHold** — same file (line ~659-660):
```typescript
const weekResult = await computeWeeklyHold(biasSource, weekOpenUtc, entryStyle, strengthGate);
```

**UI dropdown** — `src/components/shared/StrategySelector.tsx` (lines 150-165):
Filter 2 select dropdown rendering `STRENGTH_GATES` options.

**API route** — `src/app/api/performance/strategy-page-data/route.ts`:
Reads `?f2=adr_normalized` from URL params.

**Fingerprint** — `src/lib/performance/strategyPageData.ts` (line 363):
```typescript
`overlay:${strengthGate?.id ?? "none"}`,
```
This is part of the per-week cache fingerprint.

**Engine version** — `src/lib/performance/strategyPageData.ts` (lines 52-53):
```typescript
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v12";
```

### Exact Changes Required

#### 1. `src/lib/performance/weeklyHoldEngine.ts`

**Rename `applyOverlay` → `applyAdrNormalization` and remove the guard:**

```typescript
async function applyAdrNormalization(
  result: WeeklyHoldResult,
): Promise<WeeklyHoldResult> {
  // ADR normalization is always applied — canonical risk layer
  const adrMap = await loadWeeklyAdrMap(result.weekOpenUtc);
  const targetAdr = getTargetAdrPct();

  const normalizedTrades = result.trades.map((trade) => {
    const pairAdr = trade.detail?.adrPct && trade.detail.adrPct > 0
      ? trade.detail.adrPct
      : getAdrPct(adrMap, trade.symbol, trade.assetClass);
    const multiplier = targetAdr / pairAdr;
    return { ...trade, returnPct: trade.returnPct * multiplier };
  });

  const totalReturn = normalizedTrades.reduce((s, t) => s + t.returnPct, 0);
  const wins = normalizedTrades.filter((t) => t.returnPct > 0).length;
  const losses = normalizedTrades.filter((t) => t.returnPct <= 0).length;

  return {
    ...result,
    trades: normalizedTrades,
    totalReturnPct: totalReturn,
    winCount: wins,
    lossCount: losses,
    winRate: normalizedTrades.length > 0 ? (wins / normalizedTrades.length) * 100 : 0,
  };
}
```

**Update call sites** — remove the `strengthGate` parameter from `applyOverlay` calls:

Line 579: `return applyAdrNormalization(result);`

Also in `computeWeeklyHold()` default path (around line 640+): make sure the return also goes through `applyAdrNormalization()`. Currently the default weekly_hold path builds trades and returns a `WeeklyHoldResult` directly — it also needs to go through ADR normalization. Check if there's a `return { weekOpenUtc, ... trades ... }` that bypasses the overlay — if so, wrap it in `applyAdrNormalization()`.

**Remove `strengthGate` parameter from `computeWeeklyHold` and `computeMultiWeekHold` signatures.** These functions no longer need it since ADR normalization is unconditional. Update all callers.

#### 2. `src/lib/performance/strategyConfig.ts`

**Empty the STRENGTH_GATES array** (but keep the type and export for future use):
```typescript
export const STRENGTH_GATES: StrengthGateConfig[] = [];
// Reserved for future Filter 2 layers (DCA, daily adds)
```

**Update `normalizeFilterSelection`** — f2 always normalizes to `"none"` for backward compatibility. Old URLs, cached links, and bookmarks may still carry `?f2=adr_normalized`. The parser must safely absorb this without breaking:
```typescript
export function normalizeFilterSelection(value: {
  f1?: string | null;
  f2?: string | null;
}) {
  const rawF1 = value.f1 ?? null;
  const legacyEntryStyleId = isKnownId(ENTRY_STYLE_FILTERS, value.f2 ?? null) ? value.f2! : null;
  const entryStyleId = legacyEntryStyleId
    ?? (isKnownId(ENTRY_STYLE_FILTERS, rawF1) ? rawF1 : "weekly_hold");
  return {
    f1: entryStyleId,
    f2: "none",  // ADR normalization is now canonical — f2 ignored for backward compat
  };
}
```

#### 3. `src/components/shared/StrategySelector.tsx`

**Hide the Filter 2 dropdown** when STRENGTH_GATES is empty:
```typescript
{STRENGTH_GATES.length > 0 && (
  <div>
    <label htmlFor="intraday-filter" className={labelClasses}>
      Filter 2
    </label>
    <select ...>
      {STRENGTH_GATES.map((f) => (
        <option key={f.id} value={f.id}>{f.label}</option>
      ))}
    </select>
  </div>
)}
```

This way when we add DCA later, we just add entries to STRENGTH_GATES and the dropdown reappears.

#### 4. `src/lib/performance/strategyPageData.ts`

**Remove `overlay:...` from fingerprint** (line 363):
```typescript
// Remove this line:
`overlay:${strengthGate?.id ?? "none"}`,
```
ADR normalization is no longer variable, so it doesn't belong in the fingerprint. Instead, it's captured by the engine version bump.

**Remove `strengthGate` from `loadStrategyPageData`, `buildStrategyFingerprint`, `patchWeekResults`, and `computeMultiWeekHold` calls.** Trace all usages.

**Bump engine version** (line 53):
```typescript
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v13";
```
This invalidates ALL cached artifacts, forcing recomputation with ADR normalization baked in.

#### 5. `src/app/api/performance/strategy-page-data/route.ts`

**Keep reading f2 from URL params for backward compatibility**, but it will be normalized to `"none"` by `normalizeFilterSelection()`. The route continues to call `loadStrategyPageData()` — just without passing a strengthGate through to the engine. Old bookmarked URLs like `?f2=adr_normalized` must not 404 or produce errors.

#### 6. ALL callers of `computeWeeklyHold` / `computeMultiWeekHold` — MANDATORY repo-wide update

**This is critical.** Removing the `strengthGate` parameter from the engine functions is a breaking signature change. You MUST search the entire repo and update every caller. Here is the complete list:

**App routes (2 files):**
- `src/app/api/performance/engine-stats/route.ts` — lines 52, 60
- `src/app/api/performance/engine-test/route.ts` — line 46

**Lib (2 files):**
- `src/lib/performance/strategyPageData.ts` — lines 120, 192, 388
- `src/lib/performance/weeklyHoldEngine.ts` — line 659 (internal: `computeMultiWeekHold` calling `computeWeeklyHold`)

**Scripts (25+ files) — every script that passes a `strengthGate`/`adrOverlay`/`overlay`/`adrNormalized` 3rd or 4th argument:**
- `scripts/adr-backtest-cs-weekopen.ts` — line 188
- `scripts/adr-backtest-strength-buckets-all-systems.ts` — line 497
- `scripts/backtest-2of3-fx-dealer-oppose-filter.ts` — line 248
- `scripts/backtest-adr-normalization.ts` — line 527
- `scripts/backtest-additive-layering.ts` — lines 219, 512
- `scripts/backtest-basket-adr-tp.ts` — line 336
- `scripts/backtest-basket-tp-final.ts` — line 234
- `scripts/backtest-basket-adr-tp-all-strategies.ts` — line 249
- `scripts/backtest-basket-exit-grid.ts` — line 395
- `scripts/backtest-basket-trailing-stop.ts` — line 288
- `scripts/backtest-commercial-forced-canonical.ts` — line 323
- `scripts/backtest-drawdown-trigger-layering.ts` — lines 216, 691
- `scripts/backtest-risk-management-matrix.ts` — lines 505, 747
- `scripts/backtest-scaled-prop-consistency.ts` — lines 352, 717
- `scripts/backtest-per-trade-sl.ts` — line 223
- `scripts/backtest-stoch-entry-modes.ts` — line 398
- `scripts/backtest-strength-standalone.ts` — lines 130, 135, 146, 151
- `scripts/backtest-strength-tiered-agreement-matrix.ts` — lines 477, 478
- `scripts/backtest-tandem-sleeve-portfolios.ts` — lines 407, 440
- `scripts/backtest-top-composite-live-layering.ts` — lines 255, 256
- `scripts/backtest-dca-layering.ts` — lines 222, 566
- `scripts/backtest-veto-composite-sweep.ts` — line 616
- `scripts/compare-fx-2of3-vs-3of3.ts` — line 158
- `scripts/compare-selector-sentiment-override-weekly-vs-adr.ts` — line 286
- `scripts/compare-weekly-bias-selector-vs-app-baselines.ts` — line 102
- `scripts/rank-current-intraday-strategies.ts` — line 78
- `scripts/verify-selector-fix.ts` — line 218
- `scripts/verify-selector-strength-confirmation.ts` — line 46
- `scripts/verify-selector-parity.ts` — lines 49, 75
- `scripts/verify-selector-strength-veto.ts` — line 47
- `scripts/verify-selector-strength-tiebreak.ts` — line 54

**For each caller:** Remove the `strengthGate`/`overlay`/`adrOverlay`/`adrNormalized` argument. The engine now applies ADR normalization unconditionally — callers that previously passed `undefined` or no overlay argument will now automatically get normalized results (this is the intentional rebasing).

**For scripts that tested BOTH normalized and non-normalized variants** (e.g., `backtest-strength-tiered-agreement-matrix.ts` line 477-478 comparing `computeMultiWeekHold(strategy, weeks, weeklyHold)` vs `computeMultiWeekHold(strategy, weeks, weeklyHold, adrNormalized)`): These comparisons are no longer meaningful since everything is normalized. Remove the non-normalized path or note that both now produce identical results.

### Verification

After changes:
1. `npm run build` must pass — **zero TypeScript errors from removed `strengthGate` parameter**
2. `npm run lint` must pass
3. Start dev server:
   - Go to Performance page — Filter 2 dropdown should be hidden
   - All strategies should show ADR-normalized results (same as when "ADR Normalized" was previously selected)
   - Navigate using an old URL like `?strategy=dealer&f2=adr_normalized` — must load without errors (backward compat)
4. Compare dealer standalone results: should be 230 trades, numbers matching our ADR-normalized baselines
5. The sidebar stats, watermark, and week-by-week grid should all reflect normalized returns
6. **Verify at least 2 research scripts still run without errors** (e.g., `npx tsx scripts/verify-selector-parity.ts` and `npx tsx scripts/backtest-strength-standalone.ts`)

**This is an intentional historical rebasing.** All historical week results will change because ADR normalization is now applied where it previously wasn't (for anyone who had "None" selected). This is correct and expected.

---

## PHASE 2: Commercial Forced-Raw as Canonical Direction

### What and Why
Commercial's current direction logic uses **bias-label matching**: each currency gets a bias (BULLISH/BEARISH/NEUTRAL from `biasFromNet()`), then FX pairs compare base bias vs quote bias. If both are same bias or either is neutral → no signal.

This produces -38% over 10 weeks. It's the worst source by far.

**Forced-raw** uses `base_net - quote_net` directly. If positive → LONG, negative → SHORT. This rescued commercial from -38% to +23% standalone, and to +67% with veto. Verified by backtest and confirmed by Codex.

We want to change commercial's canonical direction to forced-raw **at the source**, so every system downstream automatically uses the better direction.

### Current Architecture

**Per-currency bias** — `src/lib/cotCompute.ts` (lines 11-19):
```typescript
export function biasFromNet(net: number): Bias {
  if (net > 0) return "BULLISH";
  if (net < 0) return "BEARISH";
  return "NEUTRAL";
}
```

**Market snapshot** — `src/lib/cotCompute.ts` (lines 21-68):
```typescript
export function buildMarketSnapshot(dealerLong, dealerShort, commercialLong, commercialShort) {
  // ...
  const commercialNet = commercialLong - commercialShort;    // per-currency net
  const commercialBias = biasFromNet(commercialNet);          // per-currency bias label
  // ...
}
```

**Per-currency bias resolution** — `src/lib/cotCompute.ts` (lines 70-130):
```typescript
export function resolveMarketBias(market, mode) {
  // For mode === "commercial": returns { long, short, net, bias } per currency
  // The bias is the label (BULLISH/BEARISH/NEUTRAL)
  // The net is the raw net position
}
```

**FX pair direction (with neutral)** — `src/lib/cotCompute.ts` (lines 205-260):
```typescript
export function derivePairDirectionsWithNeutral(markets, pairDefs, mode) {
  for (const pairDef of pairDefs) {
    const baseBias = resolveMarketBias(base, mode);    // { net, bias }
    const quoteBias = resolveMarketBias(quote, mode);  // { net, bias }

    // CURRENTLY: compares baseBias.bias vs quoteBias.bias (labels)
    // If both NEUTRAL or both same → NEUTRAL
    // If BULLISH vs BEARISH → LONG
    // If BEARISH vs BULLISH → SHORT
  }
}
```

**Non-FX pair direction** — `src/lib/cotCompute.ts` (lines 262-296):
Uses base-only bias. For commercial, `biasFromNet(commercial_long - commercial_short)` already gives the correct direction. **No change needed for non-FX.**

**Basket signal assembly** — `src/lib/performance/basketSource.ts` (lines 87-89):
```typescript
const derivedPairs = ac === "fx"
  ? derivePairDirectionsWithNeutral(snapshot.currencies, pairDefs, model)
  : derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, model);
```
Calls the derivation functions with `model` = "dealer" or "commercial". **No change needed here** — it passes the mode through.

**COT matrix (data section)** — `src/app/api/flagship/cot-matrix/route.ts` (lines 48-51):
```typescript
const commercialPairs = assetClass === "fx"
  ? derivePairDirectionsWithNeutral(snapshot.currencies, pairDefs, "commercial")
  : derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, "commercial");
```
**No change needed here** — it calls the same derivation functions.

### Exact Changes Required

#### 1. `src/lib/cotCompute.ts` — `derivePairDirectionsWithNeutral()`

This is the **only function that needs to change**. For `mode === "commercial"`, use forced-raw instead of bias-label comparison.

**Current logic (lines 205-260):**
```typescript
export function derivePairDirectionsWithNeutral(markets, pairDefs, mode) {
  for (const pairDef of pairDefs) {
    const baseBias = resolveMarketBias(base, mode);
    const quoteBias = resolveMarketBias(quote, mode);

    if (!baseBias || !quoteBias) continue;

    // Neutral check (bias labels)
    if (baseBias.bias === "NEUTRAL" || quoteBias.bias === "NEUTRAL") {
      pairs[pairDef.pair] = { direction: "NEUTRAL", ... };
      continue;
    }

    // Same bias check (bias labels)
    if (baseBias.bias === quoteBias.bias) {
      pairs[pairDef.pair] = { direction: "NEUTRAL", ... };
      continue;
    }

    // Direction from bias labels
    if (baseBias.bias === "BULLISH" && quoteBias.bias === "BEARISH") {
      pairs[pairDef.pair] = { direction: "LONG", ... };
    }
    // etc.
  }
}
```

**New logic — add commercial forced-raw path BEFORE the bias-label logic:**

```typescript
export function derivePairDirectionsWithNeutral(markets, pairDefs, mode) {
  for (const pairDef of pairDefs) {
    const base = markets[pairDef.base];
    const quote = markets[pairDef.quote];
    const baseBias = base ? resolveMarketBias(base, mode) : null;
    const quoteBias = quote ? resolveMarketBias(quote, mode) : null;

    if (!baseBias || !quoteBias) continue;

    // Commercial uses forced-raw: base_net - quote_net for pair direction
    if (mode === "commercial") {
      const rawNet = baseBias.net - quoteBias.net;
      if (rawNet > 0) {
        pairs[pairDef.pair] = { direction: "LONG", base_bias: baseBias.bias, quote_bias: quoteBias.bias };
      } else if (rawNet < 0) {
        pairs[pairDef.pair] = { direction: "SHORT", base_bias: baseBias.bias, quote_bias: quoteBias.bias };
      } else {
        pairs[pairDef.pair] = { direction: "NEUTRAL", base_bias: baseBias.bias, quote_bias: quoteBias.bias };
      }
      continue;
    }

    // Dealer/blended: existing bias-label comparison (unchanged)
    if (baseBias.bias === "NEUTRAL" || quoteBias.bias === "NEUTRAL") {
      pairs[pairDef.pair] = { direction: "NEUTRAL", base_bias: baseBias.bias, quote_bias: quoteBias.bias };
      continue;
    }
    // ... rest of existing logic unchanged
  }
}
```

#### 2. `src/lib/cotCompute.ts` — `derivePairDirections()` (non-neutral version, lines 132-176)

Apply the **same forced-raw logic** for `mode === "commercial"`:

```typescript
if (mode === "commercial") {
  const rawNet = baseBias.net - quoteBias.net;
  if (rawNet > 0) {
    pairs[pairDef.pair] = { direction: "LONG", base_bias: baseBias.bias, quote_bias: quoteBias.bias };
  } else if (rawNet < 0) {
    pairs[pairDef.pair] = { direction: "SHORT", base_bias: baseBias.bias, quote_bias: quoteBias.bias };
  }
  // rawNet === 0: skip (no signal) — consistent with non-neutral behavior
  continue;
}
```

Add this block right after the `if (!baseBias || !quoteBias) continue;` check, before the existing bias-label logic.

#### 3. `src/lib/cotCompute.ts` — Non-FX functions: NO CHANGE

`derivePairDirectionsByBase()` and `derivePairDirectionsByBaseWithNeutral()` use base-only bias. For commercial, this is already `biasFromNet(commercial_long - commercial_short)`, which IS the forced-raw direction for single-asset pairs. No change needed.

#### 4. `src/lib/performance/strategyPageData.ts` — Bump engine version

```typescript
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v13";
```

**If Phase 1 already bumped to v13, bump to v14 instead.** The point is to invalidate all caches so every week recomputes with the new commercial direction.

**IMPORTANT: Only bump the version ONCE for both phases.** If you implement Phase 1 and Phase 2 together, a single bump to v13 is sufficient.

#### 5. No other files need changes

`basketSource.ts`, `cot-matrix/route.ts`, `weeklyHoldEngine.ts` strategy resolvers — they all call `derivePairDirectionsWithNeutral()` and `derivePairDirectionsByBaseWithNeutral()` with `mode = "commercial"`. The change propagates automatically.

### What Changes Downstream (automatically)

| System | Effect |
|--------|--------|
| **Commercial standalone** | Goes from -38% to ~+23% (more non-neutral trades, better directions) |
| **Data section (COT matrix)** | Commercial direction column shows forced-raw directions |
| **Tandem (dealer+commercial+sentiment+strength)** | Commercial sleeve uses forced-raw |
| **Tiered V3 (dealer+commercial+sentiment)** | Commercial's vote uses forced-raw |
| **Any future veto system** | Commercial as veto voter uses forced-raw |
| **Dealer standalone** | UNCHANGED — mode === "dealer" still uses bias-label logic |
| **Sentiment** | UNCHANGED — separate resolution path |
| **Strength** | UNCHANGED — separate resolution path |
| **2-of-3 NoComm** | UNCHANGED — doesn't use commercial |

### What Should NOT Change (verify these don't break)

1. **Dealer direction** — must still be 230 trades, +73.18% raw. Dealer uses mode === "dealer", which is untouched.
2. **Sentiment direction** — separate resolution path in basketSource.ts, not affected.
3. **Strength direction** — separate store (readWeeklyPairStrengths), not affected.
4. **Non-FX commercial pairs** — base-only logic unchanged. Same directions as before.

### Verification

After changes:
1. `npm run build` must pass
2. `npm run lint` must pass
3. Start dev server:
   - Go to Data section → COT matrix should show updated commercial directions (more non-neutral pairs)
   - Go to Performance → Dealer standalone should be UNCHANGED (230 trades, same ADR-normalized stats)
   - Go to Performance → Commercial standalone should show improved numbers (~280 trades instead of ~224, positive total return)
   - Go to Performance → Sentiment, Strength standalones should be UNCHANGED
   - Go to Performance → 2-of-3 NoComm should be UNCHANGED (doesn't use commercial)
4. Run a quick sanity check script (or use the existing `backtest-commercial-forced-canonical.ts`) to verify:
   - Dealer raw: 230 trades, +73.18% (ADR-normalized) — **MUST BE UNCHANGED**
   - Commercial raw with new canonical: ~280 trades, ~+23.41% (ADR-normalized)
   - Sentiment raw: 265 trades — **MUST BE UNCHANGED**

**This is an intentional historical rebasing of commercial data.** Every system that includes commercial (tandem, tiered_v3, etc.) will show different historical numbers. Systems that exclude commercial (2-of-3 NoComm, dealer standalone, sentiment standalone, strength standalone) must be identical to pre-change.

---

## Implementation Order

1. **Do Phase 1 and Phase 2 in the same PR** — they're independent changes that both require cache invalidation
2. **Bump engine version ONCE** (to v13) for both changes
3. **Test Phase 1 first** (ADR normalization) — easier to verify (numbers should match current "ADR Normalized" filter selection)
4. **Test Phase 2 second** (commercial forced-raw) — verify dealer is unchanged, commercial is improved
5. **Build passes, lint passes, dev server works**

---

## Files Changed Summary

| File | Phase | Change |
|------|-------|--------|
| `src/lib/performance/weeklyHoldEngine.ts` | 1 | Remove overlay guard, always apply ADR normalization, remove strengthGate param |
| `src/lib/performance/strategyConfig.ts` | 1 | Empty STRENGTH_GATES, update normalizeFilterSelection |
| `src/components/shared/StrategySelector.tsx` | 1 | Conditionally hide Filter 2 dropdown |
| `src/lib/performance/strategyPageData.ts` | 1+2 | Remove overlay from fingerprint, remove strengthGate plumbing, bump engine version |
| `src/app/api/performance/strategy-page-data/route.ts` | 1 | Stop reading f2 param (or ignore) |
| `src/lib/cotCompute.ts` | 2 | Add forced-raw path for commercial in FX derivation functions |

---

## Important Warnings

1. **Do NOT touch dealer's direction logic.** Dealer = mode "dealer" = bias-label comparison. Only commercial changes.
2. **Do NOT change non-FX derivation functions.** Commercial base-only direction is already correct.
3. **Bump engine version to invalidate ALL caches.** Without this, old cached results will persist with wrong normalization/directions.
4. **The `resolveMarketBias()` function does NOT change.** It still returns `{ net, bias }` per currency. The change is in how we USE those values for FX pair direction.
5. **`strengthGate` parameter removal is a breaking change for callers.** Search the entire codebase for `computeWeeklyHold` and `computeMultiWeekHold` calls and update all of them.
6. **Test dealer baseline AFTER commercial change.** If dealer stats change, something went wrong — the commercial change should only affect `mode === "commercial"` code paths.

# CODEX: Path Engine Anchor Reconciliation

**Date:** 2026-04-07
**Blocked by:** Path engine verification fails — total returns drift +2.80% to -11.62% from weekly-close baselines despite full H1 coverage
**Goal:** Anchor the path engine to the same `pair_period_returns` entry/exit economics used by the weekly-close engine, use H1 bars only for intraweek interpolation, then re-verify.

---

## Root Cause

The weekly-close engine (`weeklyHoldEngine.ts`) computes returns from `pair_period_returns`, which derives open/close prices from **daily bars** aligned to broker-specific times (17 ET for FX, 18 ET for commodities, UTC midnight for crypto).

The path engine (`basketPathEngine.ts`) computes returns by marking positions to market against **H1 bar close prices** on a UTC hourly grid running Sunday-to-Sunday. The first and last H1 bar closes don't land at the same times as the daily bar open/close, so entry and exit prices differ.

This means a leg that the weekly-close engine prices at `openPrice=1.08500 → closePrice=1.09200` (+0.645%) might be priced by the path engine as `firstH1Close=1.08520 → lastH1Close=1.09180` (+0.608%). Multiply this by 36 legs across 10 weeks with ADR normalization and the drift compounds to the +2.80% to -11.62% we see.

**The H1 bars are fine for showing the intraweek journey.** The problem is only at the endpoints — entry and exit prices must match `pair_period_returns` exactly.

---

## Fix Strategy: Anchor Endpoints, Interpolate Midweek

1. **Entry anchor:** At the first grid point where a leg is active, use `leg.entryPrice` (already from `pair_period_returns.open_price`) — do NOT look up an H1 bar
2. **Exit anchor:** At the last grid point where a leg is active, use `leg.exitPrice` (from `pair_period_returns.close_price`, NEW field) — do NOT look up an H1 bar
3. **Intermediate points:** Use H1 bar close prices via the existing `getMarkedPriceAtTimestamp()` function — this reveals the honest intraweek path

This guarantees:
- Per-leg return at exit = `((exitPrice - entryPrice) / entryPrice) * 100` = exact weekly-close return
- Multi-week total return matches weekly-close engine within rounding noise (≤0.5%)
- Intraweek DD, peak, and giveback are honest H1-resolution metrics

---

## Step 1: Add `exitPrice` to Position Ledger

### File: `src/lib/performance/positionLedger.ts`

#### 1a. Add `exitPrice` to the `PositionLeg` type (line 20-31)

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
};
```

#### 1b. Populate `exitPrice` from `trade.closePrice` in `buildWeeklyHoldLedger` (line 71-86)

The `WeeklyHoldTrade` type already carries `closePrice` (line 59 of `weeklyHoldEngine.ts`), which comes from `pair_period_returns.close_price`. Just add it to the leg:

```typescript
// BEFORE (line 82):
      entryPrice: trade.openPrice,

// AFTER:
      entryPrice: trade.openPrice,
      exitPrice: trade.closePrice,
```

That's it for positionLedger.ts. No other changes needed.

---

## Step 2: Anchor the Mark-to-Market Loop

### File: `src/lib/performance/basketPathEngine.ts`

#### 2a. Update the `computeBasketPath()` mark-to-market loop (lines 179-196)

Replace the current price resolution block with anchor-aware logic:

```typescript
// CURRENT CODE (lines 179-196):
    for (const leg of ledger.legs) {
      const entryMs = DateTime.fromISO(leg.entryTimeUtc, { zone: "utc" }).toMillis();
      const exitMs = DateTime.fromISO(leg.exitTimeUtc, { zone: "utc" }).toMillis();
      if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs)) continue;
      if (tsMs < entryMs || tsMs > exitMs) continue;

      const priceSeries = barSeriesBySymbol.get(leg.symbol) ?? [];
      const marked = getMarkedPriceAtTimestamp(priceSeries, tsUtc, leg.entryPrice);
      if (!Number.isFinite(marked.price) || marked.price <= 0 || leg.entryPrice <= 0) {
        continue;
      }

      activePositions += 1;
      const rawReturnPct = ((marked.price - leg.entryPrice) / leg.entryPrice) * 100;
      const directedReturnPct = leg.direction === "SHORT" ? -rawReturnPct : rawReturnPct;
      const legPnlPct = leg.weight * leg.adrMultiplier * directedReturnPct;
      basketEquityPct += legPnlPct;
    }

// REPLACEMENT:
    for (const leg of ledger.legs) {
      const entryMs = DateTime.fromISO(leg.entryTimeUtc, { zone: "utc" }).toMillis();
      const exitMs = DateTime.fromISO(leg.exitTimeUtc, { zone: "utc" }).toMillis();
      if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs)) continue;
      if (tsMs < entryMs || tsMs > exitMs) continue;
      if (leg.entryPrice <= 0) continue;

      // Anchor endpoints to pair_period_returns prices.
      // H1 bars interpolate the intraweek path between these fixed anchors.
      let markPrice: number;
      if (tsMs <= entryMs) {
        markPrice = leg.entryPrice;
      } else if (tsMs >= exitMs) {
        markPrice = leg.exitPrice;
      } else {
        const priceSeries = barSeriesBySymbol.get(leg.symbol) ?? [];
        const marked = getMarkedPriceAtTimestamp(priceSeries, tsUtc, leg.entryPrice);
        if (!Number.isFinite(marked.price) || marked.price <= 0) continue;
        markPrice = marked.price;
      }

      activePositions += 1;
      const rawReturnPct = ((markPrice - leg.entryPrice) / leg.entryPrice) * 100;
      const directedReturnPct = leg.direction === "SHORT" ? -rawReturnPct : rawReturnPct;
      const legPnlPct = leg.weight * leg.adrMultiplier * directedReturnPct;
      basketEquityPct += legPnlPct;
    }
```

**Why this works:**
- `tsMs <= entryMs`: After the `< entryMs` guard, this only triggers when `tsMs === entryMs`. Forces mark = entryPrice → rawReturn = 0% at entry. Correct.
- `tsMs >= exitMs`: After the `> exitMs` guard, this only triggers when `tsMs === exitMs`. Forces mark = exitPrice → rawReturn = exact weekly-close return. Correct.
- Intermediate: H1 bars mark-to-market with carry-forward fallback to entryPrice. Reveals honest intraweek journey.

#### 2b. Do NOT change `buildPriceSeries()` or `getMarkedPriceAtTimestamp()`

The current `barCloseUtc` indexing in `buildPriceSeries()` (line 71-76) is **semantically correct**: an H1 bar's close price is realized at `barCloseUtc`, so using that as the lookup timestamp means "at grid time T, find the most recent bar that closed at or before T." This gives the correct mark-to-market price.

Leave both functions untouched.

---

## Step 3: Re-run Verification

```bash
npx tsx scripts/verify-path-engine.ts
```

### Expected Results

1. **Return parity:** All three strategies (Dealer, Selector Frag3, Agreement) should show ≤0.5 percentage point difference from weekly-close baselines. The anchored entry/exit prices guarantee the path engine's total return per leg matches the weekly-close engine per leg. Any residual difference comes from floating-point accumulation across ~360 legs, which should be negligible.

2. **Path DD still higher than weekly-close DD:** This is correct and expected. The path engine reveals intraweek drawdowns between the weekly endpoints. A week that closes +5% may have visited -8% intraweek. This is the entire point.

3. **Data coverage:** Should remain 360/360 for Dealer, 345/345 for Frag3, 268/268 for Agreement. No change from current report.

4. **All three strategies should show PASS status.**

### If residual drift exceeds 0.5%

The only remaining source would be **ADR normalization mismatch**: the weekly-close engine applies ADR normalization as a post-processing step on `trade.returnPct` (lines 131-136 of weeklyHoldEngine.ts), while the path engine applies it per-bar as `leg.weight * leg.adrMultiplier * directedReturnPct`. Both use the same `adrMultiplier` from the same `loadWeeklyAdrMap()`. With anchored endpoints, the exit return is `weight * adrMultiplier * ((exitPrice - entryPrice) / entryPrice * 100)`, which equals `weight * adrMultiplier * pairReturnPct`. The weekly-close engine computes `returnPct * multiplier` where `returnPct` is already direction-adjusted. These are algebraically identical. So drift >0.5% after this fix would indicate a bug, not a design limitation.

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/performance/positionLedger.ts` | **MODIFY** — add `exitPrice` to `PositionLeg` type, populate from `trade.closePrice` |
| `src/lib/performance/basketPathEngine.ts` | **MODIFY** — anchor mark-to-market at entry/exit to ledger prices |
| `docs/PATH_ENGINE_VERIFICATION_2026-04-07.md` | **REGENERATE** — re-run verification after fix |

**2 files modified. 0 files created.**

---

## Validation Checklist

1. [ ] `PositionLeg` type includes `exitPrice: number`
2. [ ] `buildWeeklyHoldLedger` sets `exitPrice: trade.closePrice`
3. [ ] `computeBasketPath` forces `markPrice = leg.entryPrice` at entry time
4. [ ] `computeBasketPath` forces `markPrice = leg.exitPrice` at exit time
5. [ ] `computeBasketPath` uses H1 bars for all intermediate timestamps
6. [ ] `buildPriceSeries()` and `getMarkedPriceAtTimestamp()` are NOT modified
7. [ ] `npm run build` and `npm run lint` pass
8. [ ] Path verification shows ≤0.5% difference for all 3 strategies
9. [ ] Path verification shows 0 missing bar symbols

---

## Important Warnings

1. **Do NOT modify `pathBarLoader.ts`, `verify-path-engine.ts`, or `weeklyHoldEngine.ts`.** This fix is contained to positionLedger + basketPathEngine.

2. **Do NOT change `buildPriceSeries()` to use `barOpenUtc`.** The current `barCloseUtc` indexing is correct — the close price of an H1 bar is realized at its close time, not its open time.

3. **Do NOT add smoothing, interpolation, or blending between anchors and H1 bars.** The transition from anchor → H1 → anchor should be sharp. The H1 bars show the real intraweek journey; the anchors just pin the endpoints to match the baseline.

4. **The `exitPrice` comes from `trade.closePrice`** which is `pair_period_returns.close_price`. This is already on the `WeeklyHoldTrade` type (line 59 of weeklyHoldEngine.ts) and already populated in the trade-building logic (line 696). No changes needed upstream.

5. **File header standard applies** to any new code added to modified files.

6. **Do NOT modify `computeMultiWeekBasketPath()`.** The multi-week concatenation logic is correct — it chains weekly paths with carryover equity. Once per-week paths are anchored, the multi-week total will automatically match.

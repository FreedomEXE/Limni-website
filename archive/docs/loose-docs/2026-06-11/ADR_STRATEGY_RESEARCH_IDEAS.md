/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/

# ADR Strategy Research Ideas

> **Date**: 2026-03-27
> **Status**: Active research queue
> **Baseline**: 182 trades, +9.14% (9 weeks), 85.7% WR, -39% from week-close losers

## Baseline Results by Asset Class

| Asset Class | Trades | WR | Net Return | Notes |
|-------------|--------|-----|-----------|-------|
| FX | 127 | 86.6% | +6.71% | Backbone — solid |
| Indices | 31 | 83.9% | +4.03% | Solid |
| Commodities | 1 | 100% | +0.72% | Too few to judge |
| Crypto | 23 | 82.6% | **-2.33%** | Net loser — BTC -12.41% single trade |

---

## Research Queue (Priority Order)

### 1. Dynamic TP (from anchor, not from entry) — NEXT
**Concept**: Instead of TP = entry ± 0.25 ADR, calculate TP as a function of the
high/low since the trade started. TP adjusts to where price actually went.
**Why**: Current TP is static from entry. If price dips deep past entry, TP should
reflect the actual range traveled, not a fixed offset.
**Test Plan**: Run backtest with dynamic TP, compare vs static TP baseline.

### 2. Grid Entries (split risk across 3 levels)
**Concept**: Instead of full size at 1.0 ADR, split into:
- 1/3 size at 1.0 ADR
- 1/3 size at 1.5 ADR
- 1/3 size at 2.0 ADR
**Why**: Reduces damage from losers. Feb 6 BTC (-12.41%) would be ~-4% with 1/3 size.
**Test Plan**: Run after dynamic TP is tested. Compare grid vs single entry.

### 3. Rolling Anchor (no weekly reset)
**Concept**: Don't reset anchor at week boundary. Carry it across weeks for pairs
that maintain the same directional bias. The 90-pip Friday move that misses by
10 pips shouldn't reset to 0 on Sunday.
**Challenges**:
- COT/sentiment basket changes weekly — need boundary for signal changes
- Hybrid approach: carry anchor when same direction persists, reset on flip
- Need to define "start" for first-ever anchor per pair
**Test Plan**: Implement hybrid (carry anchor for same-direction weeks), backtest.

### 4. Break of Structure (1M confirmation)
**Concept**: Before triggering ADR entry, confirm with a lower-timeframe BOS
(break of structure) on 1M bars. Ensures momentum is in the trade direction.
**Challenges**: BOS detection requires swing high/low logic. 1M = 7,200 bars/day.
**Test Plan**: Define BOS algorithmically, add as filter to entry, backtest.

### 5. Engulfing Candlestick Confirmation
**Concept**: Require an engulfing candle pattern (H1 or H4) at the ADR entry zone
before triggering. Confirms buyer/seller commitment.
**Challenges**: H1 engulfing is noisy, H4 is more reliable but slower confirmation.
**Test Plan**: Add engulfing filter on H1 and H4, compare impact on fill rate + WR.

### 6. Stochastic RSI Confirmation
**Concept**: Use Stoch RSI oversold/overbought as additional confirmation for
LONG/SHORT entries. Only enter LONG when Stoch RSI is oversold, etc.
**Skepticism**: ADR dip-entry is already mean-reversion. Stoch may filter valid
entries in trending conditions. Most likely to be neutral or negative impact.
**Test Plan**: Add Stoch filter, backtest. Expect reduced fills.

---

## Key Insight from Parity Work (2026-03-26)

The Oanda API data matches TradingView exactly when:
1. M5 bars used (matches indicator's `request.security("5")`)
2. ADR from Oanda daily bars with `dailyAlignment=17` (FX) or `18` (indices/commodities)
3. Skip most recent daily bar (Pine uses `high[1..10]`, not `high[0..9]`)
4. `from`+`count` pagination (not `from`+`to` which silently drops recent data)
5. Anchor seeds from TP bar (not null)

**100% parity achieved across all 23 pairs.**

<!--
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: docs/bots/bitget-bot-strategy.md
 *
 * Description:
 * Complete strategy reference for the Bitget perpetual futures bot,
 * including entry logic, bias model, risk model, and validated backtest results.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
-->

# Bitget Perpetual Futures Bot Strategy

## 1. Strategy Overview
The system is a bias-filtered sweep strategy for BTC and ETH perpetuals. It sets weekly direction from COT + sentiment, waits for intraday liquidity sweeps in two session windows, requires BTC/ETH handshake confirmation for the primary mode, and uses staged leverage scaling with overnight hold so trades are not force-closed before the move completes.

## 2. Backtest Window and Data Constraints
- Backtest window: 5 canonical weeks
- Week anchors tested (UTC): `2026-01-19T00:00:00Z`, `2026-01-26T00:00:00Z`, `2026-02-02T00:00:00Z`, `2026-02-09T00:00:00Z`, `2026-02-16T00:00:00Z`
- Canonical trading week definition: Sunday 19:00 ET to Sunday 19:00 ET (from [`src/lib/weekAnchor.ts`](../../src/lib/weekAnchor.ts))
- Data used: COT snapshots, sentiment aggregates (with funding proxy fallback in code), Bitget candles
- Constraint: sentiment history scope is limited; this is why testing is currently constrained to 5 weeks
- Out of scope in this run: CoinAnk liquidation trigger as a historical edge source (not integrated into this v4 backtest path)
- Simulation caveats: no explicit fee/slippage model in `scripts/bitget-v2-backtest.ts`

## 3. The Edge: Weekly Bias
### 3.1 Inputs
- COT dealer positioning (`derivePairDirectionsByBase(..., "dealer")`)
- COT commercial positioning (`derivePairDirectionsByBase(..., "commercial")`)
- Sentiment direction (`getAggregatesForWeekStartWithBackfill(...)` -> `directionFromSentimentAggregate(...)`)
- Fallback if sentiment missing: funding-proxy direction from `fetchFundingHistory(...)` + `deriveFundingProxyDirection(...)`

### 3.2 Voting and Tiers
From `classifyTier(...)` in [`scripts/bitget-v2-backtest.ts`](../../scripts/bitget-v2-backtest.ts):

| Vote Outcome | Tier | Direction Rule |
| --- | --- | --- |
| 3 LONG or 3 SHORT | HIGH | Trade that direction |
| 2 LONG or 2 SHORT | MEDIUM | Trade majority direction |
| Anything else | NEUTRAL | Direction-neutral handling |

### 3.3 Direction Gating
From `allowedDirectionsForBias(...)`:
- HIGH and MEDIUM: only bias direction
- NEUTRAL: both directions allowed

Note: In the tested 5-week sample, BTC and ETH both resolved to `HIGH SHORT` every week, so executed trades were effectively high-confidence directional shorts.

### 3.4 Prior v3 Bias Validation
Prior study result used to justify keeping bias filter:
- Bias-filtered: `+84.71%`
- Unfiltered: `-46.17%`
- Bias-inverted: `-47.24%`

## 4. Entry Mechanics
### 4.1 Session Windows

| Window | Range Build | Entry Sweep Window |
| --- | --- | --- |
| Asia/London Range -> NY Entry | 00:00-13:00 UTC | 13:00-21:00 UTC (same day) |
| US Range -> Asia/London Entry | 13:00-21:00 UTC | 00:00-13:00 UTC (next day) |

Implemented by `buildDailyRanges(...)`, `buildUsSessionRanges(...)`, `nyCandleIndicesForDay(...)`, and `asiaLondonCandleIndicesForDay(...)`.

### 4.2 Sweep + Rejection + Displacement
From `detectSignalForWindow(...)`:
- Sweep threshold: `SWEEP_MIN_PCT = 0.1%`
- Neutral-only stronger sweep: `NEUTRAL_SWEEP_MIN_PCT = 0.3%`
- Rejection condition: close returns back through swept boundary
- Displacement body minimum: `DISPLACEMENT_BODY_MIN_PCT = 0.1%`

### 4.3 Handshake Entry (Primary Coupling)
From main loop + handshake checks:
- Both BTC and ETH must produce valid signals in the same session window
- Confirmation timestamps must be within 60 minutes (`HANDSHAKE_MAX_DELAY_MINUTES = 60`)
- Entry occurs on later confirmation timestamp
- Allocation split: 50/50 margin between BTC and ETH in handshake mode

Observed diagnostics:
- Handshake triggered: `8`
- Single-symbol miss: `6`
- Timing miss: `5`
- Trigger rate: `42.11%`

## 5. Risk Model: Scaling Leverage with Overnight Hold
Primary v4 candidate is `C_handshake_scaling_risk`.

### 5.1 Entry and Initial Risk
- Initial leverage: `5x`
- Initial stop distance: `10%` (`SCALING_INITIAL_STOP_PCT`)
- Initial position uses full strategy balance in aggregate (50/50 per symbol in handshake)

### 5.2 Scaling Ladder

| Favorable Move (Unlevered) | Leverage | Stop Behavior |
| --- | --- | --- |
| Entry | 5x | Fixed 10% stop |
| +1.0% | 10x | Keep fixed stop |
| +2.0% | 25x | Move stop to breakeven |
| +3.0% | 50x | Trailing stop active |
| +4.0% | 75x cap | Tighter trailing state |

### 5.3 Overnight Hold Rule
For variant C, scaling exits use full week indices instead of session-only indices. Positions are not force-closed at session end; exits are driven by stop/breakeven/trailing/week-close logic.

Critical finding from the sample: the 10% initial stop was never hit in the scaling-overnight configuration.

## 6. Backtest Results Summary (v4)
Source: [`docs/bots/bitget-v2-backtest-results.md`](./bitget-v2-backtest-results.md), [`docs/bots/backtest-trade-log.json`](./backtest-trade-log.json), [`docs/bots/backtest-weekly-summary.json`](./backtest-weekly-summary.json)

### 6.1 Strategy Comparison

| Strategy | Total Return | Win Rate | Avg R:R | Max DD | Trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| A) Handshake + Current Risk | 123.74% | 62.50% | 0.681 | 23.86% | 16 |
| B) Independent + Scaling Risk | 22.18% | 70.00% | 0.031 | 33.63% | 20 |
| C) Handshake + Scaling + Overnight Hold | 112.54% | 87.50% | 0.266 | 6.19% | 16 |
| D) v3 Baseline (Independent + Current Risk) | 182.25% | 50.00% | 0.710 | 45.96% | 30 |
| Daily NY Open Short | -34.25% | 44.00% | 0.131 | 79.78% | 50 |

Trade count context:
- 4 strategy variants (A-D): 82 trades
- Including daily baseline: 132 trades

### 6.2 Focus Variant C Details
- Return: `+112.54%`
- Win rate: `87.50%` (14 wins / 16 trades)
- Max drawdown: `6.19%`
- Exit reasons: `12 TRAILING_STOP`, `1 BREAKEVEN_STOP`, `3 WEEK_CLOSE`, `0 STOP_LOSS`
- Milestone hit rates:
  - +1.0%: `93.75%`
  - +2.0%: `87.50%`
  - +3.0%: `81.25%`
  - +4.0%: `62.50%`

Pair breakdown for variant C:

| Symbol | Trades | Win Rate | Net PnL USD | Avg Unlevered PnL % |
| --- | ---: | ---: | ---: | ---: |
| BTC | 8 | 87.50% | 771.49 | 2.780 |
| ETH | 8 | 87.50% | 353.91 | 2.530 |

Session-window breakdown for variant C:

| Session Window | Trades | Win Rate | Net PnL USD |
| --- | ---: | ---: | ---: |
| Asia/London Range -> NY Entry | 12 | 83.33% | 637.62 |
| US Range -> Asia/London Entry | 4 | 100.00% | 487.78 |

Only one negative trade was recorded in variant C (`2026-02-13`, BTC, `WEEK_CLOSE`, `-2.48%` unlevered).

## 7. Money Management (Operator Policy)
This is execution policy, not signal edge:
- Target account doubling cycles, then de-risk by extracting principal into stablecoins
- Continue operation with house-money profile after principal recovery
- Assume occasional strategy failure regime is possible and pre-commit extraction discipline

## 8. Future Enhancements (Not Yet Integrated)
- Funding-rate alignment filter at entry time
- Open-interest expansion/contraction filter
- CoinAnk liquidation zone and flush confirmation filter
- Slippage/fee model in backtests for more realistic live expectancy
- Hourly market data snapshots (funding, OI, liquidation) started on **February 26, 2026** to build a longer evaluation set before integrating any new gate logic.
  - This collection stream will enable future backtesting of:
    - Funding-rate alignment/reverse as an entry filter.
    - OI expansion/contraction as an entry filter.
    - Liquidation clusters as dynamic scaling milestone targets.
  - Current signal from reverse funding test:
    - Variant H delivered `+86.54%`, `90.00%` win rate, and `0.00%` max drawdown on `10` trades.
    - Sample is still too small for production gating decisions.

## 9. Appendix: Key Backtest Constants
From [`scripts/bitget-v2-backtest.ts`](../../scripts/bitget-v2-backtest.ts):

| Constant | Value |
| --- | --- |
| `MAX_ENTRIES_PER_SYMBOL_PER_WEEK` | `5` |
| `SWEEP_MIN_PCT` | `0.1` |
| `NEUTRAL_SWEEP_MIN_PCT` | `0.3` |
| `DISPLACEMENT_BODY_MIN_PCT` | `0.1` |
| `ATR_MULTIPLIER` | `1.5` |
| `MAX_STOP_DISTANCE_PCT` | `1.5` |
| `TRAIL_ACTIVATE_PCT` | `3` |
| `TRAIL_OFFSET_PCT` | `2` |
| `SCALING_INITIAL_LEVERAGE` | `5` |
| `SCALING_INITIAL_STOP_PCT` | `10` |
| `SCALING_MILESTONES` | `[1, 2, 3, 4]` |
| `HANDSHAKE_MAX_DELAY_MINUTES` | `60` |
| Tier leverage map | `HIGH 25x, MEDIUM 15x, NEUTRAL 10x` |
| Tier allocation map | `HIGH 48%, MEDIUM 30%, NEUTRAL 20%` |

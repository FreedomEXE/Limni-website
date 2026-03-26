/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/

# ADR Confirmation Research — Entry Filter Experiments

> **Status**: PENDING — Do not implement until parity fix (Phase 1-2) is complete
> **Priority**: After scanner-indicator parity is achieved
> **Owner**: Freedom_EXE + Codex

## Hypothesis

Adding a confirmation filter to ADR entries will:
1. Reduce false/weak trades (quick reversals that immediately draw down)
2. Improve win rate and reduce max drawdown per trade
3. Naturally improve scanner-indicator parity (slower signals are easier for both systems to agree on)

## Experiment 1: Stochastic RSI Filter

### Setup
- **Indicator**: Stochastic RSI
- **Settings**: Length 100, K 21, D 3
- **Timeframe**: 5M (same as trade engine anchor)
- **Rule**: ADR entry level must be touched AND Stoch RSI must be in oversold (LONG) or overbought (SHORT) zone
- **Zones**: Oversold < 20, Overbought > 80

### Expected Behavior
- ADR level is typically touched BEFORE Stoch RSI reaches extreme
- Waiting for Stoch RSI confirmation means the trade triggers later (or not at all)
- Quick V-shaped reversals (touch entry, bounce immediately) get filtered out
- These quick touches are exactly the trades that cause indicator-scanner mismatches

### What to Measure
- Trade count reduction (% of trades filtered)
- Win rate change (TP hit rate with vs without filter)
- Max drawdown change per trade
- P/L change (fewer trades but higher quality?)
- Parity improvement (do both systems agree more often?)

### Implementation Notes (PineScript)
```pine
// Stoch RSI confirmation
stochRsiLength = 100
stochRsiK = 21
stochRsiD = 3
[stochK, stochD] = ta.stoch(ta.rsi(close, stochRsiLength), stochRsiLength, stochRsiK, stochRsiD)

// Modified trigger: ADR entry touched AND Stoch RSI in extreme zone
bool longConfirmed = l5 <= longEntry and stochK < 20
bool shortConfirmed = h5 >= shortEntry and stochK > 80
```

### Risks
- Stoch RSI may lag too much, missing valid entries entirely
- In strong trends, Stoch RSI stays extreme for extended periods (less useful)
- Adds complexity to an otherwise simple system
- Need to ensure the 5M Stoch RSI is available via request.security("5") for TF independence

## Experiment 2: Break of Structure (BOS) Filter

### Setup
- After ADR entry level is touched, wait for a bullish/bearish engulfing candle or BOS
- BOS definition: price breaks above the most recent swing high (LONG) or below swing low (SHORT) on the 5M timeframe

### Expected Behavior
- Confirms that price is actually reversing, not just wicking through the entry
- More robust than Stoch RSI for trending markets
- Harder to implement programmatically (swing detection is subjective)

### What to Measure
- Same metrics as Experiment 1
- Additionally: how often does BOS confirm vs Stoch RSI? Do they agree?

## Experiment 3: Engulfing Candle Filter

### Setup
- After ADR entry level is touched, wait for a bullish (LONG) or bearish (SHORT) engulfing candle on 5M
- Engulfing: current candle's body fully encompasses previous candle's body in the opposite direction

### Expected Behavior
- Simple, objective confirmation
- Delays entry by 1-2 candles (5-10 minutes)
- Filters out doji/indecision touches

### Implementation Notes (PineScript)
```pine
bool bullishEngulfing = close > open and close > open[1] and open < close[1] and close > open[1]
bool bearishEngulfing = close < open and close < open[1] and open > close[1] and close < open[1]
```

## Experiment Priority

1. **Stoch RSI** — Freedom's initial observation, simplest to test
2. **Engulfing candle** — objective, easy to implement
3. **BOS** — most robust but most complex

## Backtest Framework

Once parity is achieved, run both the current system and the filtered version on the same historical data:
- Use the scanner's trade history (strategy_backtest_trades) as the baseline
- Apply each filter retroactively to see which trades would have been filtered
- Compare: total P/L, max DD, win rate, trade count, Sharpe ratio equivalent

This can be done via a script that reads from the DB and applies the filter logic — no need to re-run the full scanner.

---

*Proposed by Freedom_EXE. Documented by Nyx. Pending Codex implementation.*

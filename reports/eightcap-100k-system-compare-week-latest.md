# Eightcap 100k One-Week System Comparison

Generated: 2026-02-21T21:06:16.618Z
Target week: 2026-02-16T00:00:00.000Z
Account size: $100000.00

## Setup

- Account: 7936840 (Tyrell Tsolakis - USD 004)
- Broker: Eightcap Pty Ltd / Eightcap-Demo
- Sizing source: frozen_week_plan
- Lot map rows: 112
- Baseline equity used: $100000.00
- Account scale applied: 1.000000x
- Frozen plan week key: 2026-02-16T05:00:00.000Z

## Live Reference (V1 broker closed PnL)

- MT5 week key: 2026-02-16T05:00:00.000Z
- Closed PnL: +$65809.64 (+65.81%)
- Closed trades: 75

## Base Lot Map (No Reallocation)

### V1
- Margin used: +$55961.56
- Margin best-case (netted): +$41839.36
- Trades (legs): 91 (priced 91, wins 56)
- PnL on 100k: +$29641.85 (+29.64%)

### V2
- Margin used: +$23042.49
- Margin best-case (netted): +$20858.47
- Trades (legs): 44 (priced 44, wins 34)
- PnL on 100k: +$33321.30 (+33.32%)

### V3
- Margin used: +$37305.36
- Margin best-case (netted): +$24971.50
- Trades (legs): 62 (priced 62, wins 33)
- PnL on 100k: +$3005.25 (+3.01%)

## Normalized To V1 Margin Budget

- V1 margin budget target: +$55961.56

### V1 (1.00x)
- Margin used: +$55961.56
- Margin best-case (netted): +$41839.36
- Trades (legs): 91 (priced 91, wins 56)
- PnL on 100k: +$29641.85 (+29.64%)

### V2 (2.4286x)
- Margin used: +$55961.56
- Margin best-case (netted): +$50657.40
- Trades (legs): 44 (priced 44, wins 34)
- PnL on 100k: +$80924.93 (+80.92%)

### V3 (1.5001x)
- Margin used: +$55961.56
- Margin best-case (netted): +$37459.61
- Trades (legs): 62 (priced 62, wins 33)
- PnL on 100k: +$4508.16 (+4.51%)

## Assumptions

- Signals/returns are computed from the same weekly performance engine used by the app.
- Sizing uses Eightcap lot_map rows (frozen weekly plan when available, else live lot_map).
- USD PnL conversion uses lot_map.move_1pct_usd per leg; margin uses lot_map.margin_required per leg.
- Normalized scenario scales each system uniformly so margin used matches V1 base margin budget.
- This is a model-based week simulation, not a broker fill-by-fill replay for V2/V3.

JSON: `reports/eightcap-100k-system-compare-week-2026-02-21.json`
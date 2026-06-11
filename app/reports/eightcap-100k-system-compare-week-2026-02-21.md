# Eightcap 100k One-Week System Comparison

Generated: 2026-02-21T23:03:30.520Z
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
- Margin used: +$78936.88
- Margin best-case (netted): +$62626.58
- Trades (legs): 110 (priced 110, wins 69)
- PnL on 100k: +$44852.00 (+44.85%)

### V2
- Margin used: +$45820.12
- Margin best-case (netted): +$41642.54
- Trades (legs): 62 (priced 62, wins 44)
- PnL on 100k: +$42446.36 (+42.45%)

### V3
- Margin used: +$60181.45
- Margin best-case (netted): +$48048.73
- Trades (legs): 79 (priced 79, wins 46)
- PnL on 100k: +$15790.52 (+15.79%)

## Normalized To V1 Margin Budget

- V1 margin budget target: +$78936.88

### V1 (1.00x)
- Margin used: +$78936.88
- Margin best-case (netted): +$62626.58
- Trades (legs): 110 (priced 110, wins 69)
- PnL on 100k: +$44852.00 (+44.85%)

### V2 (1.7228x)
- Margin used: +$78936.88
- Margin best-case (netted): +$71739.93
- Trades (legs): 62 (priced 62, wins 44)
- PnL on 100k: +$73124.72 (+73.12%)

### V3 (1.3116x)
- Margin used: +$78936.88
- Margin best-case (netted): +$63023.02
- Trades (legs): 79 (priced 79, wins 46)
- PnL on 100k: +$20711.60 (+20.71%)

## Assumptions

- Signals/returns are computed from the same weekly performance engine used by the app.
- Sizing uses Eightcap lot_map rows (frozen weekly plan when available, else live lot_map).
- USD PnL conversion uses lot_map.move_1pct_usd per leg; margin uses lot_map.margin_required per leg.
- Normalized scenario scales each system uniformly so margin used matches V1 base margin budget.
- This is a model-based week simulation, not a broker fill-by-fill replay for V2/V3.

JSON: `reports/eightcap-100k-system-compare-week-2026-02-21.json`
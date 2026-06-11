# 5Y Range Filter Backtest

**Generated**: 2026-02-13T02:31:22.210Z
**Weeks analyzed**: 4
**Models**: blended, dealer, commercial, sentiment, antikythera
**Short rule**: keep SHORT only when distance_to_low > distance_to_high
**Long rule**: symmetric filter enabled

## Totals

- Baseline return: 340.34%
- Filtered return: 189.93%
- Delta: -150.42%
- Baseline max drawdown (weekly curve): 13.43%
- Filtered max drawdown (weekly curve): 5.70%
- Drawdown delta: -7.73%
- Signals: 199/389 kept (51.2% pass)

## By Model

| Model | Weeks | Baseline % | Filtered % | Delta % | Baseline MDD % | Filtered MDD % | Delta MDD % | Baseline Signals | Filtered Signals | Pass % | Baseline Win % | Filtered Win % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| blended | 4 | 64.54 | 38.58 | -25.96 | 1.28 | 0.00 | -1.28 | 86 | 50 | 58.1 | 45.3 | 44.0 |
| dealer | 4 | 71.90 | 42.31 | -29.58 | 1.28 | 0.00 | -1.28 | 78 | 40 | 51.3 | 48.7 | 50.0 |
| commercial | 3 | 41.96 | 27.90 | -14.06 | 20.78 | 11.17 | -9.61 | 60 | 37 | 61.7 | 41.7 | 43.2 |
| sentiment | 4 | 96.33 | 45.83 | -50.50 | 10.42 | 5.76 | -4.66 | 132 | 54 | 40.9 | 68.9 | 79.6 |
| antikythera | 4 | 65.62 | 35.30 | -30.31 | 0.46 | 0.00 | -0.46 | 33 | 18 | 54.5 | 60.6 | 66.7 |

## Diagnostics

- Symbols considered: 36
- Symbols with daily data: 36
- Symbols with hourly data: 36
- Missing entry prices: 0
- Missing 5Y ranges: 0

# 5Y Range Filter Backtest

**Generated**: 2026-02-13T02:31:18.966Z
**Weeks analyzed**: 4
**Models**: blended, dealer, commercial, sentiment, antikythera
**Short rule**: keep SHORT only when distance_to_low > distance_to_high
**Long rule**: not filtered

## Totals

- Baseline return: 340.34%
- Filtered return: 225.58%
- Delta: -114.77%
- Baseline max drawdown (weekly curve): 13.43%
- Filtered max drawdown (weekly curve): 11.84%
- Drawdown delta: -1.60%
- Signals: 338/389 kept (86.9% pass)

## By Model

| Model | Weeks | Baseline % | Filtered % | Delta % | Baseline MDD % | Filtered MDD % | Delta MDD % | Baseline Signals | Filtered Signals | Pass % | Baseline Win % | Filtered Win % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| blended | 4 | 64.54 | 37.90 | -26.63 | 1.28 | 8.14 | +6.86 | 86 | 82 | 95.3 | 45.3 | 45.1 |
| dealer | 4 | 71.90 | 44.01 | -27.89 | 1.28 | 5.66 | +4.38 | 78 | 76 | 97.4 | 48.7 | 47.4 |
| commercial | 3 | 41.96 | 31.12 | -10.84 | 20.78 | 13.62 | -7.15 | 60 | 43 | 71.7 | 41.7 | 41.9 |
| sentiment | 4 | 96.33 | 72.26 | -24.07 | 10.42 | 8.82 | -1.60 | 132 | 106 | 80.3 | 68.9 | 72.6 |
| antikythera | 4 | 65.62 | 40.28 | -25.34 | 0.46 | 0.46 | +0.00 | 33 | 31 | 93.9 | 60.6 | 58.1 |

## Diagnostics

- Symbols considered: 36
- Symbols with daily data: 36
- Symbols with hourly data: 36
- Missing entry prices: 0
- Missing 5Y ranges: 0

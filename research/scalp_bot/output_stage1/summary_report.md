# Limni Scalp Bot Backtest Report

## Assumptions
- Spread model: default 1.50 pips (per-pair overrides applied if present)
- Slippage: 0.20 pips per side
- Time stop: london

## Overall stats
- Trades: 3
- Net R: -0.74
- Profit factor: 0.52
- Max drawdown (R): -1.13
- Win rate: 33.3%
- Avg R/trade: -0.25
- Max consecutive losses: 2

## Stats by pair
| pair   |   count |       sum |      mean |
|:-------|--------:|----------:|----------:|
| EURUSD |       3 | -0.737285 | -0.245762 |

## Stats by month
| month   |   count |       sum |      mean |
|:--------|--------:|----------:|----------:|
| 2026-01 |       3 | -0.737285 | -0.245762 |

## Notes
- Dollar PnL uses dynamic risk sizing based on account equity and R multiples.

## Spread/slippage sensitivity
- base: trades=3, net_r=-0.74, profit_factor=0.52, max_dd_r=-1.13
- tight: trades=3, net_r=-0.53, profit_factor=0.63, max_dd_r=-1.08
- wide: trades=3, net_r=-0.93, profit_factor=0.44, max_dd_r=-1.16

## Data Coverage
- Pairs requested: 3
- Pairs found: 3
- % days skipped due to missing COT: 91.53%
- % days skipped due to missing sentiment: 2.21%

### Coverage by pair
| pair   |   bars | start      | end        |   trades |
|:-------|-------:|:-----------|:-----------|---------:|
| EURUSD |  36275 | 2025-08-01 | 2026-01-28 |        3 |
| GBPUSD |  36265 | 2025-08-01 | 2026-01-28 |        0 |
| USDJPY |  36265 | 2025-08-01 | 2026-01-28 |        0 |
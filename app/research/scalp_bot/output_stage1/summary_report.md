# Limni Scalp Bot Backtest Report

## Assumptions
- Spread model: default 1.50 pips (per-pair overrides applied if present)
- Slippage: 0.20 pips per side
- Time stop: london
- Sentiment missing policy: allow

## Overall stats
- Trades: 49
- Net R: -0.01
- Profit factor: 1.00
- Max drawdown (R): -6.92
- Win rate: 46.9%
- Avg R/trade: -0.00
- Max consecutive losses: 8

## Stats by pair
| pair   |   count |      sum |      mean |
|:-------|--------:|---------:|----------:|
| EURUSD |      19 | -6.9876  | -0.367769 |
| GBPUSD |      27 |  5.34281 |  0.197882 |
| USDJPY |       3 |  1.6303  |  0.543435 |

## Stats by month
| month   |   count |       sum |       mean |
|:--------|--------:|----------:|-----------:|
| 2024-07 |      12 | -1.04867  | -0.0873891 |
| 2024-08 |       7 | -0.895437 | -0.12792   |
| 2024-09 |       8 |  2.86368  |  0.35796   |
| 2024-10 |       6 |  2.15973  |  0.359955  |
| 2024-11 |      10 | -4.07736  | -0.407736  |
| 2024-12 |       6 |  0.983575 |  0.163929  |

## Notes
- Dollar PnL uses dynamic risk sizing based on account equity and R multiples.

## Spread/slippage sensitivity
- base: trades=49, net_r=-0.01, profit_factor=1.00, max_dd_r=-6.92
- tight: trades=49, net_r=0.43, profit_factor=1.02, max_dd_r=-6.56
- wide: trades=49, net_r=-2.03, profit_factor=0.91, max_dd_r=-8.58

## Data Coverage
- Pairs requested: 3
- Pairs found: 3
- % days skipped due to missing COT: 0.00%
- % days skipped due to missing sentiment: 71.20%

### Coverage by pair
| pair   |   bars | start      | end        |   trades |
|:-------|-------:|:-----------|:-----------|---------:|
| EURUSD |  37687 | 2024-07-01 | 2024-12-31 |       19 |
| GBPUSD |  37685 | 2024-07-01 | 2024-12-31 |       27 |
| USDJPY |  37673 | 2024-07-01 | 2024-12-31 |        3 |
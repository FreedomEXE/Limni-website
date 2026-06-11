# Counter-Trend Weekly Sweep Backtest Results

Generated: 2026-02-28T17:14:52.726Z

Test Period: 5 weeks (2026-01-19T00:00:00.000Z to 2026-02-16T00:00:00.000Z)

## Weekly Bias Summary

| Week | BTC Bias | ETH Bias |
|------|----------|----------|
| 2026-01-19 | HIGH SHORT | HIGH SHORT |
| 2026-01-26 | HIGH SHORT | HIGH SHORT |
| 2026-02-02 | HIGH SHORT | HIGH SHORT |
| 2026-02-09 | HIGH SHORT | HIGH SHORT |
| 2026-02-16 | HIGH SHORT | HIGH SHORT |

## Signal Diagnostics

- Total weekly sweep events detected (lowest thresholds): **635**
- By symbol: BTC=316, ETH=319
- By direction: LONG=16, SHORT=0

## Best by Total Return

**S1_D0.3_H480_ST15_NONE_TPON_QMULTIBAR**

| Metric | Value |
|--------|-------|
| Total Return | 7.109978% |
| Win Rate | 50% |
| Max Drawdown | 0% |
| Trades | 2 |
| Trades/Week | 0.4 |
| Avg Unlevered PnL | 2.369992% |

## Top 10 Parameter Sets by Return

| Rank | Params | Return | WR | DD | Trades | Signals |
|------|--------|--------|----|----|--------|---------|
| 1 | S0.3_D0.1_H60_ST8_NONE_TPOFF_QMULTIBAR | 7.109978% | 50% | 0% | 2 | 16 |
| 2 | S0.3_D0.1_H60_ST8_NONE_TPON_QMULTIBAR | 7.109978% | 50% | 0% | 2 | 16 |
| 3 | S0.3_D0.1_H60_ST10_NONE_TPOFF_QMULTIBAR | 7.109978% | 50% | 0% | 2 | 16 |
| 4 | S0.3_D0.1_H60_ST10_NONE_TPON_QMULTIBAR | 7.109978% | 50% | 0% | 2 | 16 |
| 5 | S0.3_D0.1_H60_ST15_NONE_TPOFF_QMULTIBAR | 7.109978% | 50% | 0% | 2 | 16 |
| 6 | S0.3_D0.1_H60_ST15_NONE_TPON_QMULTIBAR | 7.109978% | 50% | 0% | 2 | 16 |
| 7 | S0.3_D0.1_H240_ST8_NONE_TPOFF_QMULTIBAR | 7.109978% | 50% | 0% | 2 | 16 |
| 8 | S0.3_D0.1_H240_ST8_NONE_TPON_QMULTIBAR | 7.109978% | 50% | 0% | 2 | 16 |
| 9 | S0.3_D0.1_H240_ST10_NONE_TPOFF_QMULTIBAR | 7.109978% | 50% | 0% | 2 | 16 |
| 10 | S0.3_D0.1_H240_ST10_NONE_TPON_QMULTIBAR | 7.109978% | 50% | 0% | 2 | 16 |

## Quality Profile Comparison

| Profile | Best Return | Best WR | Trades (best) | Combos w/ Trades |
|---------|------------|---------|---------------|-----------------|
| MULTIBAR | 7.109978% | 50% | 2 | 216 |
| RAW | -18.596417% | 25% | 4 | 216 |
| RANGEPROP2 | -18.596417% | 25% | 4 | 216 |
| RANGEPROP5 | -18.596417% | 25% | 4 | 216 |
| RECLAIM05 | -24% | 0% | 2 | 216 |
| RECLAIM1 | -24% | 0% | 2 | 216 |
| VOLSPIKE | -24% | 0% | 2 | 216 |

## Sample Trade Log (First 20)

| # | Symbol | Dir | Entry | Exit | Unlev PnL | Exit Reason | Milestones |
|---|--------|-----|-------|------|-----------|-------------|------------|
| 1 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 2 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |
| 3 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 4 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |
| 5 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 6 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |
| 7 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 8 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |
| 9 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 10 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |
| 11 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 12 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |
| 13 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 14 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |
| 15 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 16 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |
| 17 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 18 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |
| 19 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 20 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |

## Recommendations

- Best variant only had 2 trades. Sample too small for statistical significance. Need more data.
- This is a FEASIBILITY STUDY with 5 bearish weeks. Results are directional only. Need 3-6 months of varied market conditions before deploying capital.

---
*Counter-Trend Weekly Sweep Backtest — Freedom_EXE / Limni Intelligence Platform*

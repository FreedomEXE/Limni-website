# Counter-Trend Weekly Sweep Backtest Results

Generated: 2026-02-28T15:55:08.149Z

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

**S1_D0.3_H480_ST8_NONE_TPON**

| Metric | Value |
|--------|-------|
| Total Return | -18.596417% |
| Win Rate | 25% |
| Max Drawdown | 24% |
| Trades | 4 |
| Trades/Week | 0.8 |
| Avg Unlevered PnL | -2.815004% |

## Best by Win Rate

**S1_D0.3_H480_ST15_NONE_TPON**

| Metric | Value |
|--------|-------|
| Total Return | -41.089512% |
| Win Rate | 25% |
| Max Drawdown | 45% |
| Trades | 4 |

## Top 10 Parameter Sets by Return

| Rank | Params | Return | WR | DD | Trades | Signals |
|------|--------|--------|----|----|--------|---------|
| 1 | S0.3_D0.1_H60_ST8_NONE_TPOFF | -18.596417% | 25% | 24% | 4 | 16 |
| 2 | S0.3_D0.1_H60_ST8_NONE_TPON | -18.596417% | 25% | 24% | 4 | 16 |
| 3 | S0.3_D0.1_H240_ST8_NONE_TPOFF | -18.596417% | 25% | 24% | 4 | 16 |
| 4 | S0.3_D0.1_H240_ST8_NONE_TPON | -18.596417% | 25% | 24% | 4 | 16 |
| 5 | S0.3_D0.1_H480_ST8_NONE_TPOFF | -18.596417% | 25% | 24% | 4 | 16 |
| 6 | S0.3_D0.1_H480_ST8_NONE_TPON | -18.596417% | 25% | 24% | 4 | 16 |
| 7 | S0.3_D0.2_H60_ST8_NONE_TPOFF | -18.596417% | 25% | 24% | 4 | 15 |
| 8 | S0.3_D0.2_H60_ST8_NONE_TPON | -18.596417% | 25% | 24% | 4 | 15 |
| 9 | S0.3_D0.2_H240_ST8_NONE_TPOFF | -18.596417% | 25% | 24% | 4 | 15 |
| 10 | S0.3_D0.2_H240_ST8_NONE_TPON | -18.596417% | 25% | 24% | 4 | 15 |

## Sample Trade Log (First 20)

| # | Symbol | Dir | Entry | Exit | Unlev PnL | Exit Reason | Milestones |
|---|--------|-----|-------|------|-----------|-------------|------------|
| 1 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 2 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |
| 3 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 4 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |
| 5 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 6 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |
| 7 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 8 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |
| 9 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 10 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |
| 11 | BTC | LONG | 76423.2 | 68780.88 | -10% | STOP_LOSS |  |
| 12 | ETH | LONG | 2298.23 | 2068.41 | -10% | STOP_LOSS |  |
| 13 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 14 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |
| 15 | BTC | LONG | 76423.2 | 68780.88 | -10% | STOP_LOSS |  |
| 16 | ETH | LONG | 2298.23 | 2068.41 | -10% | STOP_LOSS |  |
| 17 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 18 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |
| 19 | BTC | LONG | 76423.2 | 64959.72 | -15% | STOP_LOSS |  |
| 20 | ETH | LONG | 2298.23 | 1953.5 | -15% | STOP_LOSS |  |

## Recommendations

- Best return is negative. Counter-trend was fighting the trend across all tested weeks.
- Best variant only had 4 trades. Sample too small for statistical significance. Need more data.
- This is a FEASIBILITY STUDY with 5 bearish weeks. Results are directional only. Need 3-6 months of varied market conditions before deploying capital.

---
*Counter-Trend Weekly Sweep Backtest — Freedom_EXE / Limni Intelligence Platform*

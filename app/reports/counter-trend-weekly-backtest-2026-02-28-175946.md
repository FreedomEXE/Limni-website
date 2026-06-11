# Counter-Trend Weekly Sweep Backtest Results

Generated: 2026-02-28T17:59:46.356Z

Test Period: 26 weeks (2025-08-25T00:00:00.000Z to 2026-02-16T00:00:00.000Z)

Bias Mode: COT_ONLY | Grid: 2160 combos

## Weekly Bias Summary

| Week | BTC Bias | ETH Bias |
|------|----------|----------|
| 2025-08-25 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2025-09-01 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2025-09-08 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2025-09-15 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2025-09-22 | MEDIUM SHORT | MEDIUM SHORT |
| 2025-09-29 | MEDIUM SHORT | MEDIUM SHORT |
| 2025-10-06 | MEDIUM SHORT | MEDIUM SHORT |
| 2025-10-13 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2025-10-20 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2025-10-27 | MEDIUM SHORT | MEDIUM SHORT |
| 2025-11-03 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2025-11-10 | MEDIUM SHORT | MEDIUM SHORT |
| 2025-11-17 | MEDIUM SHORT | MEDIUM SHORT |
| 2025-11-24 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2025-12-01 | MEDIUM SHORT | MEDIUM SHORT |
| 2025-12-08 | MEDIUM SHORT | MEDIUM SHORT |
| 2025-12-15 | MEDIUM SHORT | MEDIUM SHORT |
| 2025-12-22 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2025-12-29 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2026-01-05 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2026-01-12 | NEUTRAL NEUTRAL | MEDIUM SHORT |
| 2026-01-19 | MEDIUM SHORT | MEDIUM SHORT |
| 2026-01-26 | MEDIUM SHORT | MEDIUM SHORT |
| 2026-02-02 | MEDIUM SHORT | MEDIUM SHORT |
| 2026-02-09 | MEDIUM SHORT | MEDIUM SHORT |
| 2026-02-16 | MEDIUM SHORT | MEDIUM SHORT |

## Signal Diagnostics

- Total weekly sweep events detected (lowest thresholds): **2958**
- By symbol: BTC=1524, ETH=1434
- By direction: LONG=71, SHORT=64

## Best by Total Return

**S0.3_D0.3_H480_ST15_NONE_TPON_QMULTIBAR**

| Metric | Value |
|--------|-------|
| Total Return | 43.258495% |
| Win Rate | 75% |
| Max Drawdown | 0% |
| Trades | 8 |
| Trades/Week | 0.3 |
| Avg Unlevered PnL | 3.192214% |

## Best by Win Rate

**S0.3_D0.3_H60_ST15_NONE_TPON_QMULTIBAR**

| Metric | Value |
|--------|-------|
| Total Return | 38.369343% |
| Win Rate | 83.3% |
| Max Drawdown | 0% |
| Trades | 6 |

## Top 10 Parameter Sets by Return

| Rank | Params | Return | WR | DD | Trades | Signals |
|------|--------|--------|----|----|--------|---------|
| 1 | S0.3_D0.1_H240_ST8_NONE_TPOFF_QMULTIBAR | 43.258495% | 75% | 0% | 8 | 135 |
| 2 | S0.3_D0.1_H240_ST8_NONE_TPON_QMULTIBAR | 43.258495% | 75% | 0% | 8 | 135 |
| 3 | S0.3_D0.1_H240_ST10_NONE_TPOFF_QMULTIBAR | 43.258495% | 75% | 0% | 8 | 135 |
| 4 | S0.3_D0.1_H240_ST10_NONE_TPON_QMULTIBAR | 43.258495% | 75% | 0% | 8 | 135 |
| 5 | S0.3_D0.1_H240_ST15_NONE_TPOFF_QMULTIBAR | 43.258495% | 75% | 0% | 8 | 135 |
| 6 | S0.3_D0.1_H240_ST15_NONE_TPON_QMULTIBAR | 43.258495% | 75% | 0% | 8 | 135 |
| 7 | S0.3_D0.1_H480_ST8_NONE_TPOFF_QMULTIBAR | 43.258495% | 75% | 0% | 8 | 135 |
| 8 | S0.3_D0.1_H480_ST8_NONE_TPON_QMULTIBAR | 43.258495% | 75% | 0% | 8 | 135 |
| 9 | S0.3_D0.1_H480_ST10_NONE_TPOFF_QMULTIBAR | 43.258495% | 75% | 0% | 8 | 135 |
| 10 | S0.3_D0.1_H480_ST10_NONE_TPON_QMULTIBAR | 43.258495% | 75% | 0% | 8 | 135 |

## Quality Profile Comparison

| Profile | Best Return | Best WR | Trades (best) | Combos w/ Trades |
|---------|------------|---------|---------------|-----------------|
| RAW | 8.876457% | 62.5% | 10 | 216 |
| RECLAIM05 | -15.357338% | 50% | 6 | 216 |
| RECLAIM1 | -24% | 0% | 2 | 216 |
| HAMMER | — | — | 0 | 0 |
| MULTIBAR | 43.258495% | 83.3% | 8 | 216 |
| VOLSPIKE | -15.357338% | 50% | 6 | 216 |
| RANGEPROP2 | 8.876457% | 62.5% | 10 | 216 |
| RANGEPROP5 | -2.24066% | 50% | 6 | 216 |
| MODERATE | — | — | 0 | 0 |
| STRICT | — | — | 0 | 0 |

## Sample Trade Log (First 20)

| # | Symbol | Dir | Entry | Exit | Unlev PnL | Exit Reason | Milestones |
|---|--------|-----|-------|------|-----------|-------------|------------|
| 1 | BTC | LONG | 107455.6 | 110500 | 2.83317% | WEEK_CLOSE | 2 |
| 2 | ETH | LONG | 3754.97 | 3838.11 | 2.214164% | TRAILING_STOP | 2,4 |
| 3 | BTC | LONG | 85471 | 90896.69 | 6.347985% | TRAILING_STOP | 2,4,6 |
| 4 | ETH | LONG | 2790.84 | 2987.51 | 7.046803% | TRAILING_STOP | 2,4,6 |
| 5 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 6 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |
| 7 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 8 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |
| 9 | BTC | LONG | 107455.6 | 110500 | 2.83317% | WEEK_CLOSE | 2 |
| 10 | ETH | LONG | 3754.97 | 3838.11 | 2.214164% | TRAILING_STOP | 2,4 |
| 11 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 12 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |
| 13 | BTC | LONG | 76423.2 | 70309.34 | -8% | STOP_LOSS |  |
| 14 | ETH | LONG | 2298.23 | 2114.37 | -8% | STOP_LOSS |  |
| 15 | BTC | LONG | 107455.6 | 110500 | 2.83317% | WEEK_CLOSE | 2 |
| 16 | ETH | LONG | 3754.97 | 3838.11 | 2.214164% | TRAILING_STOP | 2,4 |
| 17 | BTC | LONG | 85471 | 90896.69 | 6.347985% | TRAILING_STOP | 2,4,6 |
| 18 | ETH | LONG | 2790.84 | 2987.51 | 7.046803% | TRAILING_STOP | 2,4,6 |
| 19 | BTC | LONG | 76505.6 | 76505.6 | 0% | BREAKEVEN_STOP | 2 |
| 20 | ETH | LONG | 2226.2 | 2331.72 | 4.739985% | TRAILING_STOP | 2,4,6 |

## Recommendations

- Best variant only had 8 trades. Sample too small for statistical significance. Need more data.
- This is a FEASIBILITY STUDY with 5 bearish weeks. Results are directional only. Need 3-6 months of varied market conditions before deploying capital.

---
*Counter-Trend Weekly Sweep Backtest — Freedom_EXE / Limni Intelligence Platform*

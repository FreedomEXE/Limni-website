# Fiveers V1 Universal - Swap vs No-Swap (5 Weeks)

Generated: 2026-02-24T19:50:25.982Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Account: 26043051 (B-100K Tyrell Tsolakis)

## Totals
| Scenario | PnL | Arithmetic Return | Compounded Return |
| --- | ---: | ---: | ---: |
| No swap | +$2493.62 | +83.12% | +99.79% |
| With estimated swap | +$2200.30 | +73.34% | +83.16% |
| Swap delta | -$293.32 | -9.78% | n/a |

## Weekly
| Week | Trades | Priced | No Swap PnL | Est Swap | With Swap PnL | No Swap Return | With Swap Return |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-01-19 | 99 | 99 | +$1506.89 | -$54.86 | +$1452.03 | +50.23% | +48.40% |
| 2026-01-26 | 98 | 80 | -$358.77 | -$52.06 | -$410.83 | -11.96% | -13.69% |
| 2026-02-02 | 102 | 102 | +$356.67 | -$60.97 | +$295.70 | +11.89% | +9.86% |
| 2026-02-09 | 109 | 109 | +$247.59 | -$62.68 | +$184.91 | +8.25% | +6.16% |
| 2026-02-16 | 109 | 109 | +$741.24 | -$62.75 | +$678.49 | +24.71% | +22.62% |

## Estimated Swap Drag By Symbol (Top)
| Symbol | Estimated Swap Drag |
| --- | ---: |
| BTCUSD | -$59.83 |
| WTIUSD | -$56.00 |
| NIKKEIUSD | -$43.90 |
| ETHUSD | -$17.05 |
| XAGUSD | -$16.50 |
| XAUUSD | -$13.65 |
| GBPJPY | -$9.46 |
| EURCHF | -$5.80 |
| GBPAUD | -$5.69 |
| USDJPY | -$5.19 |
| NZDJPY | -$5.04 |
| CHFJPY | -$4.90 |

## Swap Calibration
- Closed rows used: 25
- Open rows used: 28
- Bucket sample floor: 1
- Source counts: symbol+side=347, symbol=69, asset=83
- Global fallback: rate_per_lot_day=-9.494564, hold_days_avg=3.2048

## Assumptions
- Exact same 5-week window as floor-clamped universal compare report.
- Exact same V1 universal leg generation and lot-map scaling logic used by existing compare script.
- No-swap scenario equals existing simulation style (spread/commission/swap excluded).
- With-swap scenario subtracts estimated swap per priced leg only.
- Swap estimates are calibrated from this account's own mt5_closed_positions (swap / lot-days).
- Rate lookup priority: symbol+side -> symbol -> asset class -> global fallback.
- Hold days are estimated from historical average hold-time in the same calibration bucket.
- This is a swap-impact estimate, not a broker tick-by-tick replay.

JSON: `reports/fiveers-5week-universal-swap-vs-noswap-2026-02-24.json`
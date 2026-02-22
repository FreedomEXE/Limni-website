# Eightcap 100k - Universal vs Tiered (5 Weeks)

Generated: 2026-02-21T23:23:00.997Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Account: 7936840 (Tyrell Tsolakis - USD 004)

## Totals By Version

### V1
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Universal | +$479957.29 | +479.96% | +2372.27% | +$383309.33 | 500 | 62.00% | +0.96% |
| Tiered (base) | +$150095.55 | +150.10% | +248.52% | +$83303.88 | 117 | 73.50% | +1.28% |
| Tiered (scaled to Universal margin) | +$674436.57 | +674.44% | +5076.00% | +$383309.33 | 117 | 73.50% | +5.76% |

### V2
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Universal | +$330593.69 | +330.59% | +996.29% | +$222107.99 | 282 | 70.57% | +1.17% |
| Tiered (base) | +$145445.21 | +145.45% | +230.15% | +$85896.75 | 130 | 73.85% | +1.12% |
| Tiered (scaled to Universal margin) | +$362100.48 | +362.10% | +1084.50% | +$222107.99 | 130 | 73.85% | +2.79% |

### V3
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Universal | +$359048.26 | +359.05% | +1172.95% | +$291832.82 | 350 | 62.00% | +1.03% |
| Tiered (base) | +$131513.49 | +131.51% | +209.47% | +$77677.60 | 118 | 75.42% | +1.11% |
| Tiered (scaled to Universal margin) | +$495378.97 | +495.38% | +2434.89% | +$291832.82 | 118 | 75.42% | +4.20% |

## Weekly Breakdown

### V1 Weekly
| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-01-19 | +175.73% | +71.85% | 4.229x | +303.85% | T1=2, T2=7, T3=20 |
| 2026-01-26 | +132.69% | +15.75% | 4.472x | +70.45% | T1=2, T2=5, T3=17 |
| 2026-02-02 | +73.23% | +10.89% | 4.698x | +51.15% | T1=2, T2=5, T3=18 |
| 2026-02-09 | +50.78% | +20.70% | 4.783x | +98.99% | T1=3, T2=7, T3=15 |
| 2026-02-16 | +47.52% | +30.91% | 4.853x | +150.00% | T1=3, T2=7, T3=14 |

### V2 Weekly
| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-01-19 | +140.33% | +74.78% | 2.343x | +175.18% | T1=11, T2=21, T3=0 |
| 2026-01-26 | +78.08% | +20.15% | 2.343x | +47.20% | T1=11, T2=21, T3=0 |
| 2026-02-02 | +47.92% | +16.68% | 2.662x | +44.40% | T1=9, T2=19, T3=0 |
| 2026-02-09 | +20.22% | +2.93% | 2.817x | +8.26% | T1=10, T2=14, T3=0 |
| 2026-02-16 | +44.05% | +30.91% | 2.817x | +87.07% | T1=10, T2=14, T3=0 |

### V3 Weekly
| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-01-19 | +118.70% | +53.76% | 3.772x | +202.81% | T1=2, T2=11, T3=14 |
| 2026-01-26 | +123.64% | +35.13% | 3.772x | +132.52% | T1=2, T2=11, T3=14 |
| 2026-02-02 | +65.12% | +15.45% | 3.673x | +56.75% | T1=2, T2=11, T3=12 |
| 2026-02-09 | +33.66% | +14.46% | 3.952x | +57.13% | T1=3, T2=12, T3=6 |
| 2026-02-16 | +17.93% | +12.72% | 3.631x | +46.18% | T1=3, T2=16, T3=9 |

## Assumptions
- Universal systems use existing model baskets (V1/V2/V3) with raw leg summation.
- Tiered systems use per-pair vote classification and execute one directional trade per classified pair.
- Tier 3 uses strict directional winner rule for systems with >=3 voters.
- Weekly USD move conversion uses lot_map.move_1pct_usd; margin uses lot_map.margin_required.
- Weekly lot map source = frozen weekly plan when available, else current live lot map fallback.
- Normalized tiered mode rescales tiered each week to match that version's universal margin usage.

JSON: `reports/eightcap-100k-5week-universal-vs-tiered-2026-02-21.json`
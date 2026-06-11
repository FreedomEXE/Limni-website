# Eightcap 3k - Universal vs Tiered (5 Weeks, MT5 0.01 Floor-Clamped)

Generated: 2026-02-23T11:18:31.860Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Account: 7936840 (Tyrell Tsolakis - USD 004)

## Totals By Version

### V1
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Universal | +$14015.45 | +467.18% | +2233.89% | +$11237.40 | 518 | 61.97% | +0.90% |
| Tiered (base) | +$4265.76 | +142.19% | +222.59% | +$2410.58 | 114 | 71.05% | +1.25% |
| Tiered (scaled to Universal margin) | +$19538.67 | +651.29% | +3996.39% | +$11237.40 | 114 | 71.05% | +5.71% |

### V2
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Universal | +$9808.45 | +326.95% | +978.23% | +$6542.24 | 301 | 70.76% | +1.09% |
| Tiered (base) | +$4365.62 | +145.52% | +225.27% | +$2476.51 | 126 | 75.40% | +1.15% |
| Tiered (scaled to Universal margin) | +$11294.54 | +376.48% | +1095.77% | +$6542.24 | 126 | 75.40% | +2.99% |

### V3
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Universal | +$10244.37 | +341.48% | +1049.34% | +$8567.25 | 367 | 61.58% | +0.93% |
| Tiered (base) | +$3580.14 | +119.34% | +180.64% | +$2314.36 | 126 | 73.02% | +0.95% |
| Tiered (scaled to Universal margin) | +$12825.09 | +427.50% | +1721.93% | +$8567.25 | 126 | 73.02% | +3.39% |

## Combined Tiered (V1 + V2 + V3)
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade | Static Max DD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Stacked (independent) | +$12211.52 | +407.05% | +1451.31% | +$7201.45 | 366 | 73.22% | +1.11% | +0.00% |
| De-duplicated (vote-weighted) | +$12227.34 | +407.58% | +1543.67% | +$7229.39 | 163 | 68.10% | +2.50% | +0.00% |

## Combined Tiered Weekly
| Week | Stacked | De-dup Weighted | Margin (Stacked) | Margin (De-dup) | De-dup Pairs | Ties Skipped | Weight Sum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-01-19 | +203.58% | +184.37% | +$1508.18 | +$1517.85 | 36 | 0 | 93 |
| 2026-01-26 | +49.99% | +81.05% | +$1485.90 | +$1494.36 | 36 | 0 | 89 |
| 2026-02-02 | +46.30% | +50.27% | +$1416.23 | +$1418.74 | 35 | 0 | 76 |
| 2026-02-09 | +36.19% | +38.55% | +$1395.57 | +$1399.22 | 34 | 0 | 72 |
| 2026-02-16 | +70.98% | +53.35% | +$1395.57 | +$1399.22 | 34 | 0 | 72 |

## Weekly Breakdown

### V1 Weekly
| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-01-19 | +176.72% | +74.81% | 4.443x | +332.40% | T1=2, T2=9, T3=17 |
| 2026-01-26 | +119.31% | +7.20% | 4.642x | +33.42% | T1=2, T2=7, T3=15 |
| 2026-02-02 | +72.70% | +11.69% | 4.745x | +55.46% | T1=2, T2=6, T3=16 |
| 2026-02-09 | +48.95% | +19.29% | 4.743x | +91.51% | T1=3, T2=7, T3=15 |
| 2026-02-16 | +49.51% | +29.20% | 4.743x | +138.50% | T1=2, T2=8, T3=15 |

### V2 Weekly
| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-01-19 | +141.62% | +78.31% | 2.477x | +194.00% | T1=13, T2=19, T3=0 |
| 2026-01-26 | +66.11% | +11.07% | 2.477x | +27.43% | T1=13, T2=19, T3=0 |
| 2026-02-02 | +48.03% | +17.49% | 2.723x | +47.61% | T1=10, T2=16, T3=0 |
| 2026-02-09 | +20.18% | +3.21% | 2.779x | +8.92% | T1=10, T2=14, T3=0 |
| 2026-02-16 | +51.00% | +35.45% | 2.779x | +98.52% | T1=10, T2=14, T3=0 |

### V3 Weekly
| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-01-19 | +113.38% | +50.46% | 3.453x | +174.22% | T1=2, T2=15, T3=16 |
| 2026-01-26 | +117.32% | +31.72% | 3.453x | +109.53% | T1=2, T2=15, T3=16 |
| 2026-02-02 | +64.60% | +17.13% | 3.777x | +64.69% | T1=2, T2=13, T3=11 |
| 2026-02-09 | +32.71% | +13.69% | 3.957x | +54.18% | T1=3, T2=13, T3=7 |
| 2026-02-16 | +13.46% | +6.34% | 3.926x | +24.88% | T1=2, T2=14, T3=7 |

## Assumptions
- Universal systems use existing model baskets (V1/V2/V3) with raw leg summation.
- Tiered systems use per-pair vote classification and execute one directional trade per classified pair.
- Tier 3 uses strict directional winner rule for systems with >=3 voters.
- Weekly USD move conversion uses lot_map.move_1pct_usd; margin uses lot_map.margin_required.
- Weekly lot map source = frozen weekly plan when available, else current live lot map fallback.
- Normalized tiered mode rescales tiered each week to match that version's universal margin usage.
- Combined tiered de-dup mode nets duplicate pair exposures across Tiered V1/V2/V3 and sizes by winning system count (1x/2x/3x).
- MT5 minimum lot floor applied per symbol/trade leg: 0.01 with lot step 0.01.

JSON: `reports/eightcap-3k-5week-floor-clamped-compare-2026-02-23.json`
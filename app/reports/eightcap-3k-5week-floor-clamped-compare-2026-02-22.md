# Eightcap 3k - Universal vs Tiered (5 Weeks, MT5 0.01 Floor-Clamped)

Generated: 2026-02-22T15:21:55.052Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Account: 7936840 (Tyrell Tsolakis - USD 004)

## Totals By Version

### V1
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Universal | +$14282.74 | +476.09% | +2375.60% | +$11051.62 | 500 | 63.00% | +0.95% |
| Tiered (base) | +$4514.19 | +150.47% | +242.20% | +$2430.69 | 117 | 74.36% | +1.29% |
| Tiered (scaled to Universal margin) | +$20075.90 | +669.20% | +4310.88% | +$11051.62 | 117 | 74.36% | +5.72% |

### V2
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Universal | +$9802.54 | +326.75% | +977.45% | +$6351.26 | 282 | 71.63% | +1.16% |
| Tiered (base) | +$4368.19 | +145.61% | +224.82% | +$2501.27 | 130 | 74.62% | +1.12% |
| Tiered (scaled to Universal margin) | +$10766.10 | +358.87% | +997.99% | +$6351.26 | 130 | 74.62% | +2.76% |

### V3
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Universal | +$10525.07 | +350.84% | +1148.62% | +$8395.16 | 350 | 63.14% | +1.00% |
| Tiered (base) | +$3732.17 | +124.41% | +194.22% | +$2184.06 | 118 | 76.27% | +1.05% |
| Tiered (scaled to Universal margin) | +$14396.09 | +479.87% | +2295.22% | +$8395.16 | 118 | 76.27% | +4.07% |

## Combined Tiered (V1 + V2 + V3)
| Mode | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade | Static Max DD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Stacked (independent) | +$12614.55 | +420.49% | +1559.90% | +$7116.02 | 365 | 75.07% | +1.15% | +0.00% |
| De-duplicated (vote-weighted) | +$12645.04 | +421.50% | +1677.86% | +$7137.00 | 160 | 71.88% | +2.63% | +0.00% |

## Combined Tiered Weekly
| Week | Stacked | De-dup Weighted | Margin (Stacked) | Margin (De-dup) | De-dup Pairs | Ties Skipped | Weight Sum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-01-19 | +204.15% | +185.23% | +$1455.15 | +$1461.35 | 35 | 0 | 88 |
| 2026-01-26 | +52.62% | +83.31% | +$1426.87 | +$1431.86 | 34 | 0 | 83 |
| 2026-02-02 | +40.22% | +44.32% | +$1427.85 | +$1432.74 | 35 | 0 | 78 |
| 2026-02-09 | +36.05% | +38.38% | +$1386.80 | +$1388.06 | 33 | 0 | 70 |
| 2026-02-16 | +87.44% | +70.25% | +$1419.35 | +$1422.99 | 33 | 0 | 76 |

## Weekly Breakdown

### V1 Weekly
| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-01-19 | +175.72% | +76.18% | 4.195x | +319.59% | T1=2, T2=7, T3=20 |
| 2026-01-26 | +120.98% | +7.68% | 4.432x | +34.02% | T1=2, T2=5, T3=17 |
| 2026-02-02 | +69.58% | +10.60% | 4.636x | +49.17% | T1=2, T2=5, T3=18 |
| 2026-02-09 | +48.90% | +19.25% | 4.715x | +90.75% | T1=3, T2=7, T3=15 |
| 2026-02-16 | +60.92% | +36.77% | 4.778x | +175.66% | T1=3, T2=7, T3=14 |

### V2 Weekly
| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-01-19 | +140.62% | +78.52% | 2.311x | +181.48% | T1=11, T2=21, T3=0 |
| 2026-01-26 | +67.78% | +11.55% | 2.311x | +26.69% | T1=11, T2=21, T3=0 |
| 2026-02-02 | +44.90% | +15.61% | 2.609x | +40.73% | T1=9, T2=19, T3=0 |
| 2026-02-09 | +20.14% | +3.16% | 2.754x | +8.70% | T1=10, T2=14, T3=0 |
| 2026-02-16 | +53.31% | +36.77% | 2.754x | +101.26% | T1=10, T2=14, T3=0 |

### V3 Weekly
| Week | Universal | Tiered | Tiered Scale->Universal | Tiered Norm | Tier Counts |
| --- | ---: | ---: | ---: | ---: | --- |
| 2026-01-19 | +112.38% | +49.46% | 3.871x | +191.46% | T1=2, T2=11, T3=14 |
| 2026-01-26 | +119.00% | +33.39% | 3.871x | +129.27% | T1=2, T2=11, T3=14 |
| 2026-02-02 | +61.48% | +14.00% | 3.754x | +52.56% | T1=2, T2=11, T3=12 |
| 2026-02-09 | +32.66% | +13.64% | 4.028x | +54.95% | T1=3, T2=12, T3=6 |
| 2026-02-16 | +25.32% | +13.91% | 3.713x | +51.63% | T1=3, T2=16, T3=9 |

## Assumptions
- Universal systems use existing model baskets (V1/V2/V3) with raw leg summation.
- Tiered systems use per-pair vote classification and execute one directional trade per classified pair.
- Tier 3 uses strict directional winner rule for systems with >=3 voters.
- Weekly USD move conversion uses lot_map.move_1pct_usd; margin uses lot_map.margin_required.
- Weekly lot map source = frozen weekly plan when available, else current live lot map fallback.
- Normalized tiered mode rescales tiered each week to match that version's universal margin usage.
- Combined tiered de-dup mode nets duplicate pair exposures across Tiered V1/V2/V3 and sizes by winning system count (1x/2x/3x).
- MT5 minimum lot floor applied per symbol/trade leg: 0.01 with lot step 0.01.

JSON: `reports/eightcap-3k-5week-floor-clamped-compare-2026-02-22.json`
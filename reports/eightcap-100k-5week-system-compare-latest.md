# Eightcap 100k Five-Week System Comparison

Generated: 2026-02-21T22:43:09.331Z
Weeks: 2026-01-19T00:00:00.000Z, 2026-01-26T00:00:00.000Z, 2026-02-02T00:00:00.000Z, 2026-02-09T00:00:00.000Z, 2026-02-16T00:00:00.000Z
Account: 7936840 (Tyrell Tsolakis - USD 004)

## Totals (Base Sizing)

| System | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V1 | +$477288.05 | +477.29% | +2327.54% | +$383309.33 | 500 | 62.00% | +0.95% |
| V2 | +$328992.15 | +328.99% | +984.10% | +$222107.99 | 282 | 70.57% | +1.17% |
| V3 | +$130979.64 | +130.98% | +208.00% | +$77677.60 | 118 | 75.42% | +1.11% |

## Totals (V2/V3 Scaled To V1 Weekly Margin)

| System | PnL | Return (arith) | Return (compounded) | Margin Used | Trades | Win Rate | Avg/Trade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V1 | +$477288.05 | +477.29% | +2327.54% | +$383309.33 | 500 | 62.00% | +0.95% |
| V2 | +$570434.47 | +570.43% | +3348.64% | +$383309.33 | 282 | 70.57% | +2.02% |
| V3 | +$648050.25 | +648.05% | +4749.06% | +$383309.33 | 118 | 75.42% | +5.49% |

## Weekly Breakdown

| Week | V1 Base | V2 Base | V3 Base | V2 Scale->V1 | V3 Scale->V1 | V2 Norm | V3 Norm |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-01-19 | +175.73% | +140.33% | +53.76% | 1.746x | 4.958x | +245.01% | +266.54% |
| 2026-01-26 | +132.69% | +78.08% | +35.13% | 1.741x | 4.944x | +135.96% | +173.70% |
| 2026-02-02 | +73.23% | +47.92% | +15.45% | 1.703x | 4.841x | +81.60% | +74.79% |
| 2026-02-09 | +50.78% | +20.22% | +14.46% | 1.718x | 5.188x | +34.74% | +74.99% |
| 2026-02-16 | +44.85% | +42.45% | +12.18% | 1.723x | 4.763x | +73.12% | +58.02% |

## Notes
- V1 and V2 use existing basket model definitions from performance snapshots.
- V3 is agreement-tier based (dealer + commercial + sentiment), all tiers included with 1x weight.
- Weekly USD move conversion uses lot_map.move_1pct_usd; margin uses lot_map.margin_required.
- Weekly lot map source = frozen weekly plan when available, else current live lot map fallback.
- Normalized mode rescales V2/V3 each week to match that week's V1 margin usage.
- Returns are arithmetic and compounded across the 5 independent weeks.

JSON: `reports/eightcap-100k-5week-system-compare-2026-02-21.json`
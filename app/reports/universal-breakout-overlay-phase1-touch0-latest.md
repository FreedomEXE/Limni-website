# Universal Breakout Overlay Phase 1

Generated: 2026-02-23T10:43:06.439Z
Weeks: 5
Breakout basis: touch
Breakout buffer: 0.0000%

## Ranked Variants (Breakout Compounded Return)
| Rank | Variant | Baseline Comp % | Breakout Comp % | Delta Comp % | Baseline Worst Wk % | Breakout Worst Wk % | Trigger Rate % |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | triplet_antikythera | 645.50 | 283.87 | -361.62 | 17.71 | -0.43 | 64.76 |
| 2 | triplet_tier1 | 586.36 | 273.12 | -313.24 | 12.07 | -0.21 | 61.54 |
| 3 | v2_tier1 | 136.74 | 74.16 | -62.58 | 7.37 | -0.21 | 64.29 |
| 4 | v2_antikythera | 133.36 | 72.02 | -61.33 | 7.37 | -0.21 | 64.71 |
| 5 | v1_antikythera | 126.17 | 70.74 | -55.42 | 7.37 | -0.21 | 67.44 |
| 6 | v3_antikythera | 101.17 | 63.18 | -37.98 | 2.14 | 0.00 | 54.55 |
| 7 | v1_tier1 | 101.17 | 63.18 | -37.98 | 2.14 | 0.00 | 54.55 |
| 8 | v3_tier1 | 101.17 | 63.18 | -37.98 | 2.14 | 0.00 | 54.55 |

## Assumptions
- Phase-1 universe only: Antikythera (V1/V2/V3) and Tier1 (V1/V2/V3), plus triplet composites.
- Weekly entry anchor uses canonical week open (Sunday 19:00 ET, UTC-normalized).
- Breakout rule: LONG waits for prior-week high breach; SHORT waits for prior-week low breach.
- Breakout basis=touch; buffer=0.0000%.
- If no breakout occurs during week window, trade is skipped (0 contribution for breakout variant).
- Baseline = immediate entry at week open and hold to week close.
- Returns are summed across trades per week (same style as existing basket model aggregation).
- Costs/slippage/spread/commission/swap not included in this first-pass overlay test.

JSON: `reports/universal-breakout-overlay-phase1-2026-02-23.json`
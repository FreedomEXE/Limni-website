# Universal Breakout Overlay Phase 1

Generated: 2026-02-23T10:39:27.963Z
Weeks: 5
Breakout basis: close
Breakout buffer: 0.0000%

## Ranked Variants (Breakout Compounded Return)
| Rank | Variant | Baseline Comp % | Breakout Comp % | Delta Comp % | Baseline Worst Wk % | Breakout Worst Wk % | Trigger Rate % |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | triplet_antikythera | 645.50 | 288.07 | -357.43 | 17.71 | -0.43 | 60.95 |
| 2 | triplet_tier1 | 578.51 | 271.33 | -307.17 | 12.07 | -0.21 | 58.90 |
| 3 | v2_antikythera | 133.36 | 73.35 | -60.01 | 7.37 | -0.21 | 60.78 |
| 4 | v2_tier1 | 133.36 | 73.35 | -60.01 | 7.37 | -0.21 | 60.78 |
| 5 | v1_antikythera | 126.17 | 72.07 | -54.09 | 7.37 | -0.21 | 62.79 |
| 6 | v3_antikythera | 101.17 | 63.18 | -37.98 | 2.14 | 0.00 | 54.55 |
| 7 | v1_tier1 | 101.17 | 63.18 | -37.98 | 2.14 | 0.00 | 54.55 |
| 8 | v3_tier1 | 101.17 | 63.18 | -37.98 | 2.14 | 0.00 | 54.55 |

## Assumptions
- Phase-1 universe only: Antikythera (V1/V2/V3) and Tier1 (V1/V2/V3), plus triplet composites.
- Weekly entry anchor uses canonical week open (Sunday 19:00 ET, UTC-normalized).
- Breakout rule: LONG waits for prior-week high breach; SHORT waits for prior-week low breach.
- Breakout basis=close; buffer=0.0000%.
- If no breakout occurs during week window, trade is skipped (0 contribution for breakout variant).
- Baseline = immediate entry at week open and hold to week close.
- Returns are summed across trades per week (same style as existing basket model aggregation).
- Costs/slippage/spread/commission/swap not included in this first-pass overlay test.

JSON: `reports/universal-breakout-overlay-phase1-2026-02-23.json`
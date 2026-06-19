# Gate 34 Dealer Source-Rule Fixed-Band Audit

Generated: 2026-06-14

## Scope

- Dealer source only.
- FX 28-pair Weekly Hold.
- Source-rule candidates are research-only; runtime strategy logic was not changed.
- Exit tested here: market-week fixed `TP 1.2x ADR / SL 2.45x ADR`.
- Week-close rows are included as the no-fixed-exit baseline for each source rule.
- Skipped/abstained source-rule rows are emitted as neutral evidence with `sourceRuleReason`; they are not dropped from the pair-level receipt.

## Source Rules

| Source Rule | Meaning |
| --- | --- |
| current | Existing Dealer algorithm |
| neutral_only | Trade only neutral/tiebreaker Dealer rows; direct opposed-bias abstains |
| direct_delta_confirmed | Direct opposed-bias rows trade only when Dealer delta agrees |
| direct_delta_override | Direct opposed-bias rows use Dealer delta direction |
| direct_raw_delta_leg_ratio0p75 | Direct rows require raw direction + delta agreement and both legs have Dealer directional ratio >= 0.75 |

## 2024

Receipt: `app/reports/data-verification/weekly-hold-source-rule-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-52w-20260614-212000.md`

| Source Rule / Exit | ADR | Weekly W/L/F | ADR DD |
| --- | ---: | ---: | ---: |
| Current / week close | -169.48% | 22/30/0 | 181.46% |
| Current / TP1.2 SL2.45 | -130.81% | 22/30/0 | 137.78% |
| Neutral-only / week close | +4.00% | 25/27/0 | 41.76% |
| Neutral-only / TP1.2 SL2.45 | -64.90% | 21/31/0 | 76.04% |
| Direct delta confirmed / week close | -101.16% | 22/30/0 | 122.48% |
| Direct delta confirmed / TP1.2 SL2.45 | -109.11% | 16/36/0 | 121.96% |
| Direct delta override / week close | -32.83% | 23/29/0 | 75.19% |
| Direct delta override / TP1.2 SL2.45 | -90.16% | 23/29/0 | 110.11% |
| Raw+delta+leg ratio / week close | -78.38% | 21/31/0 | 104.24% |
| Raw+delta+leg ratio / TP1.2 SL2.45 | -98.19% | 16/36/0 | 107.33% |

Takeaway: 2024 is still not fixed. Fixed TP/SL improves current Dealer versus week-close, but all source-rule candidates remain losing. Delta override is the least bad week-close source rule, but the fixed band worsens it.

## Clean 2025

Receipt: `app/reports/data-verification/weekly-hold-source-rule-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-39w-20260614-212530.md`

| Source Rule / Exit | ADR | Weekly W/L/F | ADR DD |
| --- | ---: | ---: | ---: |
| Current / week close | +21.33% | 16/23/0 | 50.34% |
| Current / TP1.2 SL2.45 | +34.46% | 20/19/0 | 34.02% |
| Neutral-only / week close | +5.64% | 19/20/0 | 43.00% |
| Neutral-only / TP1.2 SL2.45 | +11.06% | 23/16/0 | 26.33% |
| Direct delta confirmed / week close | +58.08% | 18/21/0 | 31.87% |
| Direct delta confirmed / TP1.2 SL2.45 | +26.90% | 23/16/0 | 32.95% |
| Direct delta override / week close | +94.82% | 21/18/0 | 37.32% |
| Direct delta override / TP1.2 SL2.45 | +51.42% | 23/16/0 | 27.54% |
| Raw+delta+leg ratio / week close | +48.92% | 18/21/0 | 33.23% |
| Raw+delta+leg ratio / TP1.2 SL2.45 | +24.47% | 23/16/0 | 32.21% |

Takeaway: Delta source rules are better than current on week-close, but fixed TP/SL cuts the delta edge. The fixed band improves current and neutral-only by reducing drawdown and increasing weekly wins.

## Current 2026

Receipt: `app/reports/data-verification/weekly-hold-source-rule-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-23w-20260614-211242.md`

| Source Rule / Exit | ADR | Weekly W/L/F | ADR DD |
| --- | ---: | ---: | ---: |
| Current / week close | +73.70% | 17/6/0 | 29.28% |
| Current / TP1.2 SL2.45 | +79.01% | 17/6/0 | 12.54% |
| Neutral-only / week close | +43.71% | 16/7/0 | 18.96% |
| Neutral-only / TP1.2 SL2.45 | +38.85% | 15/8/0 | 9.24% |
| Direct delta confirmed / week close | +74.25% | 15/8/0 | 27.29% |
| Direct delta confirmed / TP1.2 SL2.45 | +76.02% | 17/6/0 | 9.17% |
| Direct delta override / week close | +74.81% | 14/9/0 | 30.10% |
| Direct delta override / TP1.2 SL2.45 | +74.37% | 18/5/0 | 14.07% |
| Raw+delta+leg ratio / week close | +80.82% | 15/8/0 | 17.14% |
| Raw+delta+leg ratio / TP1.2 SL2.45 | +64.00% | 17/6/0 | 8.82% |

Takeaway: 2026 is forgiving. Current + fixed band is strongest on total ADR. Direct-delta-confirmed has nearly the same return with lower drawdown. Spread-quality filtering gives the lowest drawdown but gives up too much return.

## Clean 2025 + Current 2026

Receipt: `app/reports/data-verification/weekly-hold-source-rule-exit-sweep/fx-28pair-dealer-weekly-hold-fixed-band-sweep-62w-20260614-213803.md`

| Source Rule / Exit | ADR | Weekly W/L/F | ADR DD |
| --- | ---: | ---: | ---: |
| Current / week close | +95.03% | 33/29/0 | 50.34% |
| Current / TP1.2 SL2.45 | +113.48% | 37/25/0 | 34.02% |
| Neutral-only / week close | +49.34% | 35/27/0 | 43.00% |
| Neutral-only / TP1.2 SL2.45 | +49.90% | 38/24/0 | 26.33% |
| Direct delta confirmed / week close | +132.33% | 33/29/0 | 31.87% |
| Direct delta confirmed / TP1.2 SL2.45 | +102.93% | 40/22/0 | 32.95% |
| Direct delta override / week close | +169.63% | 35/27/0 | 37.32% |
| Direct delta override / TP1.2 SL2.45 | +125.79% | 41/21/0 | 27.54% |
| Raw+delta+leg ratio / week close | +129.74% | 33/29/0 | 33.23% |
| Raw+delta+leg ratio / TP1.2 SL2.45 | +88.48% | 40/22/0 | 32.21% |

Takeaway: in the clean 2025 + current 2026 stitched window, the best source rule is still `direct_delta_override`. The best fixed-band variant is also `direct_delta_override / TP1.2 SL2.45`, but the fixed band cuts return versus week-close while reducing drawdown and improving weekly W/L.

## Current Read

1. The fixed-band route does not solve 2024 source failure.
2. The direct-opposed raw Dealer branch remains too unstable to promote as-is.
3. Dealer delta is the strongest source-rule improvement lead.
4. Spread/leg-ratio cleanliness is useful as risk-quality metadata, but it is not enough to rescue weak years.
5. For future composite systems, abstain/neutral decisions must remain pair-level evidence with reason metadata; they should not disappear from source outputs.

## Receipts Not Used As Canonical

- A first stitched source-rule run wrote a 61-week receipt because generic source-date exclusion did not recreate the exact clean stitched week list. The canonical stitched receipt is the explicit 62-week run listed above.

# Gate 34 COT Source Opportunity Audit

Generated: 2026-06-15

## Purpose

This gate answers whether the current COT direction source creates real
tradable opportunity before optimizing exits.

Freedom's corrected diagnostic:

- Week-close is not the primary FX test.
- Basket TP, trailing stops, and pair exits are secondary until the source is
  proven to create favorable excursion.
- The audit must also preserve source-feature evidence so the COT source
  algorithm can be improved later.

This is source diagnostics only. It does not promote a live baseline and does
not tune exits.

## Implementation

New audit script:

`app/scripts/verification/audit-cot-source-opportunity.ts`

Package command:

```powershell
npm run verification:audit-cot-source-opportunity -- --receipt <receipt.json>
```

The script reuses the fixed-band exporter's `buildBaseWeek` function so it uses
the exact same COT Faces source implementation and COT/path data as the existing
Gate 34 receipts.

For each pair/week row, it records:

- selected COT Faces direction;
- opposite direction;
- source tier;
- source reason;
- parsed source features such as pair score, base score, quote score,
  multipliers, agreement/conflict weights, Dealer/Commercial/Non-commercial
  pair directions, OI direction, and all face direction/gap fields;
- selected-direction max favorable excursion and max adverse excursion in ADR;
- opposite-direction max favorable excursion and max adverse excursion in ADR;
- whether selected or opposite hit `+0.75 ADR before -1 ADR`;
- whether selected or opposite hit `+1 ADR before -1 ADR`;
- whether selected or opposite hit `+1 ADR before -1.5 ADR`;
- opportunity-cost flags where the opposite side passed and selected failed;
- selected-advantage flags where selected passed and opposite failed;
- weekly basket path opportunity from the selected directions.

## Receipts

Full 28 current 2026:

- Source receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-cot-faces-weekly-hold-fixed-band-sweep-23w-20260615-213436.json`
- Opportunity audit:
  `app/reports/data-verification/weekly-hold-source-opportunity/fx-28pair-cot-faces-v1-forced-source-opportunity-23w-20260615-220111.md`

Full 28 clean 2019:

- Source receipt:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-cot-faces-weekly-hold-fixed-band-sweep-43w-20260615-213257.json`
- Opportunity audit:
  `app/reports/data-verification/weekly-hold-source-opportunity/fx-28pair-cot-faces-v1-forced-source-opportunity-43w-20260615-221532.md`

Smoke-test receipt:

- `app/reports/data-verification/weekly-hold-source-opportunity/fx-10pair-cot-faces-v1-forced-source-opportunity-1w-20260615-220006.md`

## Headline Result

`+1 ADR before -1 ADR` selected-vs-opposite source diagnostic:

| Window | Rows | Selected Pass | Opposite Pass | Selected Rate | Opposite Rate | Opportunity Cost |
|---|---:|---:|---:|---:|---:|---:|
| Clean 2019 full 28 | 1204 | 504 | 500 | 41.86% | 41.53% | 500 |
| Current 2026 full 28 | 644 | 264 | 255 | 40.99% | 39.60% | 255 |

Read:

- The selected COT Faces direction barely beats the opposite side on the core
  source-opportunity diagnostic.
- This is not strong enough to declare the source good and move to exit
  optimization.
- Positive basket rows from the fixed-band sweep are likely being driven by
  exit shape, timing, diversification, and pair concentration more than by a
  clearly superior direction source.

## Basket Opportunity

| Window | Weeks | Positive Close | Basket +10 Before -10 |
|---|---:|---:|---:|
| Clean 2019 full 28 | 43 | 20 | 17 |
| Current 2026 full 28 | 23 | 11 | 9 |

Read:

- Basket opportunity exists, but it is not stable enough to prove source edge.
- Basket-level management may later help, but optimizing basket TP now would
  risk fitting exits around a weak or misinterpreted source.

## Worst Pair Opportunity Cost

Clean 2019 highest opportunity-cost pairs:

| Pair | Rows | Selected +1/-1 | Opposite +1/-1 | Opp Cost | Avg Selected Close |
|---|---:|---:|---:|---:|---:|
| NZDCHF | 43 | 14 | 23 | 23 | -0.209 ADR |
| NZDJPY | 43 | 18 | 22 | 22 | +0.011 ADR |
| AUDCHF | 43 | 14 | 21 | 21 | -0.486 ADR |
| AUDNZD | 43 | 15 | 20 | 20 | -0.369 ADR |
| GBPNZD | 43 | 17 | 20 | 20 | -0.227 ADR |
| USDCHF | 43 | 20 | 20 | 20 | -0.104 ADR |
| CHFJPY | 43 | 15 | 20 | 20 | -0.006 ADR |

Current 2026 highest opportunity-cost pairs:

| Pair | Rows | Selected +1/-1 | Opposite +1/-1 | Opp Cost | Avg Selected Close |
|---|---:|---:|---:|---:|---:|
| EURAUD | 23 | 5 | 14 | 14 | -0.338 ADR |
| EURGBP | 23 | 7 | 14 | 14 | -0.201 ADR |
| NZDCHF | 23 | 5 | 13 | 13 | -0.472 ADR |
| EURNZD | 23 | 5 | 13 | 13 | -0.421 ADR |
| GBPNZD | 23 | 4 | 13 | 13 | -0.291 ADR |
| USDJPY | 23 | 8 | 12 | 12 | -0.282 ADR |
| GBPJPY | 23 | 5 | 12 | 12 | -0.005 ADR |

Read:

- NZD/CHF and NZD/JPY trouble appears in both windows.
- Several bad pairs have the opposite side producing more clean +1 ADR
  opportunities than the selected source side.
- This supports source-algorithm review before exit optimization.

## Tier Read

The dominant tier remains the corrected Commercial-conflict bucket.

| Window | Tier | Rows | Selected +1/-1 | Opposite +1/-1 | Avg Selected Close |
|---|---|---:|---:|---:|---:|
| Clean 2019 | `cot_faces_dealer_noncomm_commercial_conflict` | 1019 | 414 | 445 | -0.151 ADR |
| Current 2026 | `cot_faces_dealer_noncomm_commercial_conflict` | 572 | 235 | 226 | +0.001 ADR |

Read:

- In clean 2019, the dominant tier is directionally worse than its opposite on
  the +1/-1 diagnostic.
- In current 2026, the dominant tier is almost flat versus its opposite.
- The current COT Faces source is therefore not just an exit problem.

## Decision

COT Faces v1 remains alive as a research lead, but the next work should be
source-algorithm review, not exit optimization.

Do not move directly to basket TP, pair trailing stops, or ADR Grid. Those may
matter later, but the current source opportunity audit shows that the selected
direction is not meaningfully better than the opposite side.

Recommended next gate:

1. Review the COT Faces source formula and face signs.
2. Compare alternate source interpretations using the same opportunity audit.
3. Focus first on tiers and pairs with high opposite-side opportunity cost.
4. Only return to exit design once a source variant shows clear selected-side
   opportunity advantage over the opposite side.

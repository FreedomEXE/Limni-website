# Active Systems

v1 baseline active strategy selections are driven by `src/lib/performance/strategyConfig.ts` and `src/lib/performance/strategySelection.ts`.

## Signal Models

| Signal model | Config id | Structure | Card breakdown | Semantics |
|---|---:|---|---|---|
| Tandem | `tandem` | Multi-source sleeve portfolio | `per_model` | Dealer, Commercial, Sentiment, and Strength run as separate sleeves. |
| Tiered | `tiered_4w` | Tiered composite | `tiers` | Four-source weighted tier system; Tier 1/2 strength determines participation. |
| Agreement | `agree_3of4` | Agreement filter | `asset_class` | Trades when 3+ of 4 sources align; selective tie handling. |
| Selector | `selector` | Multi-source selector sleeve view | `per_model` | Shows Selector and Selector Selective as separate sleeves via display labels. |

The individual source models are:

- `dealer` - COT dealer/intermediary positioning.
- `commercial` - COT commercial/hedger positioning.
- `sentiment` - contrarian retail sentiment.
- `strength` - multi-timeframe currency strength composite.

## Entry Styles And Risk Overlays

| Entry style | Config id | Strategy family | Notes |
|---|---:|---|---|
| Weekly Hold | `weekly_hold` | `weekly_hold` | Enter at week open and exit at week close. |
| ADR Grid | `adr_grid` | `adr_grid` | 0.20 ADR close-and-rearm grid. |

| Risk overlay | Config id | Applies to | Notes |
|---|---:|---|---|
| None | `none` | all entry styles | No additional risk overlay. |
| Pair Fill Cap | `pair_fill_cap` | ADR Grid | Limits active grid fills per pair; enforced and auditable in ledger. |

## Visible Bootstrap Variants

Visible app selections combine the four signal models with valid entry/risk combinations:

- `tandem-weekly_hold-none`
- `tandem-adr_grid-none`
- `tandem-adr_grid-pair_fill_cap`
- `tiered_4w-weekly_hold-none`
- `tiered_4w-adr_grid-none`
- `tiered_4w-adr_grid-pair_fill_cap`
- `agree_3of4-weekly_hold-none`
- `agree_3of4-adr_grid-none`
- `agree_3of4-adr_grid-pair_fill_cap`
- `selector-weekly_hold-none`
- `selector-adr_grid-none`
- `selector-adr_grid-pair_fill_cap`

The selector, tandem, and tiered display grouping rules are documented in [`src/lib/basket/basketHierarchy.ts`](../../src/lib/basket/basketHierarchy.ts) for Basket hierarchy work.

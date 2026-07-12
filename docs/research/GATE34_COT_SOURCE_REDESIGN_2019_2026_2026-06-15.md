# Gate 34 COT Source Redesign - First Outer-Window Test

Generated: 2026-06-15

## Scope

Gate 34 remains `weekly-hold-engine-research`, but this is a deliberate scope
pivot from Dealer-only source tuning into COT source redesign.

Frozen areas remain:

- No Commercial standalone promotion.
- No Sentiment or Strength source work.
- No tandem/tiered/composite system work.
- No ADR Grid parity or Pair Fill Cap redesign.
- No release canon or live strategy promotion.

## Hypothesis

Dealer and Commercial may be better treated as components of one COT source
instead of separate standalone systems.

Commercial losing by itself does not make it useless. In this pass it is used as
COT context: confirmation, contradiction, and forced-vote evidence around the
Dealer ratio/delta read.

## Research Rule

Added research-only source rule:

`cot_combined_v1_forced28`

The rule always emits all 28 FX pair rows for every selected week and stores a
source tier/reason per row.

Per pair, v1 evaluates:

- Dealer directional ratio from Dealer net versus Dealer spread.
- Dealer delta normalized by open interest.
- Dealer net normalized by open interest.
- Commercial net normalized by open interest.
- Commercial delta normalized by open interest.

Tier priority:

1. `cot_ratio_delta_commercial_confirmed`
2. `cot_ratio_delta_confirmed`
3. `cot_ratio_commercial_confirmed`
4. `cot_delta_raw_commercial_confirmed`
5. `cot_weighted_forced`
6. `cot_low_confidence_forced`
7. `cot_tie_forced`

Weighted forced vote:

```txt
dealer_ratio        2.00
dealer_delta_oi     1.25
dealer_raw_oi       1.00
commercial_oi       0.75
commercial_delta_oi 0.50
```

Exact ties are forced by explicit tiebreakers and recorded in the row reason.

## Test Order

Freedom selected an outside-in year order:

1. Clean 2019 and current 2026.
2. Clean 2020 and clean 2025.
3. Clean 2021 and clean 2024.
4. Clean 2022 and clean 2023.

This note covers step 1 only.

## First Results

Exit setup was deliberately narrow:

- Week close.
- Market-week ADR band `TP 1.0x / SL 2.0x`.

### Clean 2019

Receipt:

`app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-cot-weekly-hold-fixed-band-sweep-43w-20260615-184746.md`

| Variant | Raw | ADR | ADR DD | Weekly PF | Trade PF ADR | Weekly W/L |
|---|---:|---:|---:|---:|---:|---:|
| COT v1 Week Close | -7.56% | -39.64% | 83.93% | 0.82 | 0.95 | 18/25/0 |
| COT v1 TP1.0 SL2.0 | +5.40% | +3.64% | 35.50% | 1.03 | 1.01 | 22/21/0 |

Read:

- COT v1 materially improves the 2019 weakness versus the rejected Dealer-only
  forced baselines, but week-close is still negative.
- The simple ADR band made 2019 slightly positive and cut drawdown, but the
  edge is thin.

Tier counts on week-close rows:

| Tier | Rows |
|---|---:|
| `cot_ratio_commercial_confirmed` | 331 |
| `cot_ratio_delta_commercial_confirmed` | 297 |
| `cot_ratio_delta_confirmed` | 252 |
| `cot_weighted_forced` | 244 |
| `cot_delta_raw_commercial_confirmed` | 41 |
| `cot_low_confidence_forced` | 39 |

### Current 2026

Receipt:

`app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-cot-weekly-hold-fixed-band-sweep-23w-20260615-184937.md`

| Variant | Raw | ADR | ADR DD | Weekly PF | Trade PF ADR | Weekly W/L |
|---|---:|---:|---:|---:|---:|---:|
| COT v1 Week Close | +33.24% | +58.87% | 39.89% | 1.97 | 1.19 | 15/8/0 |
| COT v1 TP1.0 SL2.0 | +29.37% | +42.56% | 24.18% | 1.89 | 1.22 | 15/8/0 |

Read:

- COT v1 is positive in 2026, but weaker than current Dealer in the same 2026
  sample.
- The simple ADR band reduced 2026 drawdown but also reduced return versus
  week-close.

Tier counts on week-close rows:

| Tier | Rows |
|---|---:|
| `cot_ratio_commercial_confirmed` | 186 |
| `cot_ratio_delta_commercial_confirmed` | 162 |
| `cot_ratio_delta_confirmed` | 161 |
| `cot_weighted_forced` | 92 |
| `cot_low_confidence_forced` | 31 |
| `cot_delta_raw_commercial_confirmed` | 12 |

## Decision

Do not promote COT v1.

The first outside-window test is useful because it shows the combined COT premise
can reduce the 2019 Dealer-only failure, especially with a simple ADR-based
exit. But it also gives up too much of the current 2026 Dealer edge.

This is a live research lead, not a baseline.

Next step: run the same COT v1 rule on clean 2020 and clean 2025 before changing
weights, adding more COT fields, or widening the exit sweep.

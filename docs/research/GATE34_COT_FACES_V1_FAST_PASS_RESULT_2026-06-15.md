# Gate 34 COT Faces v1 Fast-Pass Result

Generated: 2026-06-15

## Scope

This note records the first fast-pass test for the COT Faces architecture:

`docs/research/GATE34_COT_FACES_V1_ARCHITECTURE_2026-06-15.md`

This is research-only. It does not promote a live baseline.

## Fast-Pass Basket

```txt
EURUSD
GBPUSD
USDJPY
USDCHF
AUDUSD
USDCAD
AUDCAD
EURJPY
GBPCHF
NZDJPY
```

## Rule Tested

`cot_faces_v1_forced`

The rule combines:

- Dealer net/OI and current weekly Dealer delta/OI.
- Commercial net/OI and current weekly Commercial delta/OI.
- Non-commercial net/OI and current weekly Non-commercial delta/OI.
- Non-reportable net/OI and current weekly Non-reportable delta/OI.
- Asset manager net/OI and current weekly Asset manager delta/OI.
- Leveraged money net/OI and current weekly Leveraged money delta/OI.
- Confidence modifiers from Dealer spread cleanliness, Non-commercial spread
  cleanliness, OI change, and concentration.

Every tested pair row emits a forced LONG/SHORT direction plus source tier and
source reason.

## Receipts

Valid COT Faces receipts:

- 2019:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-cot-faces-weekly-hold-fixed-band-sweep-43w-20260615-193918.md`
- 2026:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-cot-faces-weekly-hold-fixed-band-sweep-23w-20260615-194024.md`
- 2020:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-cot-faces-weekly-hold-fixed-band-sweep-52w-20260615-204509.md`
- Clean 2025:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-cot-faces-weekly-hold-fixed-band-sweep-39w-20260615-205838.md`
- Full 28 clean 2019 ADR target grid:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-cot-faces-weekly-hold-fixed-band-sweep-43w-20260615-213257.md`
- Full 28 current 2026 ADR target grid:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-28pair-cot-faces-weekly-hold-fixed-band-sweep-23w-20260615-213436.md`

Same-basket current Dealer comparison receipts:

- 2019:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-dealer-weekly-hold-fixed-band-sweep-43w-20260615-195530.md`
- 2026:
  `app/reports/data-verification/weekly-hold-exit-sweep/fx-10pair-dealer-weekly-hold-fixed-band-sweep-23w-20260615-195642.md`

## Summary

### COT Faces v1

| Window | Exit | ADR | ADR DD | Return/DD | Weekly PF | Trade PF ADR | Weekly W/L |
|---|---|---:|---:|---:|---:|---:|---:|
| Clean 2019 | Week close | -16.30% | 42.35% | -0.38 | 0.89 | 0.94 | 19/24/0 |
| Clean 2019 | TP1.0 SL2.0 | +18.33% | 17.23% | 1.06 | 1.28 | 1.12 | 26/17/0 |
| Current 2026 | Week close | +15.00% | 17.42% | 0.86 | 1.58 | 1.13 | 16/7/0 |
| Current 2026 | TP1.0 SL2.0 | +15.54% | 14.80% | 1.05 | 1.76 | 1.23 | 15/8/0 |

### Same-Basket Current Dealer

| Window | Exit | ADR | ADR DD | Return/DD | Weekly PF | Trade PF ADR | Weekly W/L |
|---|---|---:|---:|---:|---:|---:|---:|
| Clean 2019 | Week close | -43.63% | 50.54% | -0.86 | 0.71 | 0.85 | 18/25/0 |
| Clean 2019 | TP1.0 SL2.0 | +8.92% | 18.87% | 0.47 | 1.13 | 1.06 | 23/20/0 |
| Current 2026 | Week close | -3.65% | 36.91% | -0.10 | 0.92 | 0.97 | 10/13/0 |
| Current 2026 | TP1.0 SL2.0 | +5.32% | 21.85% | 0.24 | 1.19 | 1.07 | 14/9/0 |

## Continuation - Clean 2020 And Clean 2025

This was run before the full 28-pair target-band qualification. Keep it as
secondary evidence only. The corrected gate order is:

1. COT Faces v1 full 28-pair target-band behavior on the original validation
   windows.
2. Pair-level failure review.
3. Only then continue into more years such as clean 2020, clean 2025, clean
   2021, and clean 2024.

After the fresh-eyes metadata correction, the same 10-pair basket was run on
clean 2020 and clean pre-shutdown 2025 using the explicit week lists from the
existing Dealer receipts.

| Window | Exit | ADR | ADR DD | Return/DD | Weekly PF | Trade PF ADR | Weekly W/L |
|---|---|---:|---:|---:|---:|---:|---:|
| Clean 2020 | Week close | +38.46% | 35.75% | 1.08 | 1.27 | 1.13 | 30/22/0 |
| Clean 2020 | TP1.0 SL2.0 | -17.40% | 37.69% | -0.46 | 0.81 | 0.91 | 26/26/0 |
| Clean 2025 | Week close | -45.78% | 59.84% | -0.77 | 0.54 | 0.79 | 16/23/0 |
| Clean 2025 | TP1.0 SL2.0 | +3.02% | 21.29% | 0.14 | 1.06 | 1.02 | 19/20/0 |

Read:

- Clean 2020 supports the COT Faces source premise on week-close behavior, but
  the simple TP1.0/SL2.0 market-week band damages the result.
- Clean 2025 rejects the week-close source as-is; TP1.0/SL2.0 cuts drawdown and
  turns the sample slightly positive, but the edge is thin.
- The exit layer is not a stable universal rescue rule. It helps 2019 and clean
  2025, is roughly neutral in current 2026, and hurts clean 2020.
- The source remains alive, but it is not ready for promotion or full 28-pair
  qualification without further outside-window checks.

Corrected tier read:

- The corrected `cot_faces_dealer_noncomm_commercial_conflict` tier carries
  clean 2020 week-close (`+34.60%` ADR across `408` rows) but fails clean 2025
  week-close (`-58.04%` ADR across `339` rows).
- In TP1.0/SL2.0, the same corrected conflict tier is negative in clean 2020
  (`-16.56%` ADR) and near flat/slightly negative in clean 2025 (`-1.11%`
  ADR).
- Dealer+Commercial confirmation is not the 2020 carrier; it is negative in
  clean 2020 week-close (`-12.59%` ADR) but positive in clean 2025 week-close
  (`+8.05%` ADR). This argues for regime/tier analysis before any weight edit.

## Full 28-Pair Target-Band Sweep

Freedom corrected the diagnostic on 2026-06-15: week-close is a poor primary
test for FX because pairs oscillate. The real question is whether COT Faces can
catch an ADR target before unacceptable drawdown across the full 28-pair FX
universe. These receipts therefore use the full FX universe and a target-band
grid:

- TP multiples: `0.5`, `0.75`, `1`, `1.25`, `1.5`.
- SL multiples: `1`, `1.5`, `2`, `2.5`.
- Anchor: `market_week`.

### Full 28 Summary

| Window | Variant | ADR | ADR DD | Return/DD | Weekly PF | Weekly W/L | Negative Pairs |
|---|---|---:|---:|---:|---:|---:|---:|
| Clean 2019 | Week close | -113.38% | 131.29% | -0.86 | 0.69 | 20/23/0 | - |
| Clean 2019 | TP1.0 SL2.0 | +21.68% | 35.08% | 0.62 | 1.15 | 23/20/0 | 13/28 |
| Clean 2019 | TP0.75 SL1.0 | +41.28% | 19.04% | 2.17 | 1.54 | 25/18/0 | 10/28 |
| Clean 2019 | TP0.75 SL1.5 | +34.43% | 24.92% | 1.38 | 1.35 | 25/18/0 | 10/28 |
| Current 2026 | Week close | +16.47% | 42.79% | 0.38 | 1.38 | 11/12/0 | - |
| Current 2026 | TP1.0 SL2.0 | +30.05% | 34.60% | 0.87 | 1.60 | 15/8/0 | 14/28 |
| Current 2026 | TP1.5 SL2.5 | +56.57% | 30.98% | 1.83 | 1.95 | 14/9/0 | 13/28 |
| Current 2026 | TP0.75 SL1.5 | +13.86% | 27.23% | 0.51 | 1.40 | 13/10/0 | 13/28 |

Read:

- Full 28 does not immediately kill COT Faces v1 at basket level.
- Week-close should not drive the pass/fail decision.
- The original `TP1.0 / SL2.0` candidate is positive in both full 28 windows,
  but the return/DD is weak in clean 2019.
- The best 2019 exit shape is tight-stop target capture (`TP0.75 / SL1.0`);
  that same variant is negative in current 2026.
- The best 2026 exit shape is wider target/wider stop (`TP1.5 / SL2.5`);
  that same shape fails clean 2019.
- `TP0.75 / SL1.5` is positive in both windows, but it still leaves roughly
  half of pairs negative in current 2026 and is not a clean qualification.
- Pair-level concentration is now the blocker: positive basket totals are
  hiding too many negative pairs.

Worst full 28 pair drags:

- Clean 2019 `TP1.0 / SL2.0`: `USDCHF` `-8.38` ADR, `CHFJPY` `-8.15`,
  `AUDCHF` `-7.61`, `GBPNZD` `-7.34`.
- Current 2026 `TP1.0 / SL2.0`: `NZDCHF` `-7.74` ADR, `NZDJPY` `-6.29`,
  `EURGBP` `-4.66`, `GBPJPY` `-4.37`, `GBPUSD` `-4.23`.
- Current 2026 best basket row `TP1.5 / SL2.5` still has 13 negative pairs,
  led by `EURAUD`, `GBPNZD`, `EURGBP`, `NZDUSD`, `NZDCAD`, `NZDJPY`, and
  `NZDCHF`.

## Source Opportunity Audit

After the full 28-pair target-band sweep, Freedom raised the missing source
question: are we recording enough evidence to improve the COT direction
algorithm later, and is selected COT Faces materially better than the opposite
side before exits are optimized?

Dedicated audit note:

`docs/research/GATE34_COT_SOURCE_OPPORTUNITY_AUDIT_2026-06-15.md`

The audit records parsed COT Faces source features plus selected-vs-opposite
path opportunity for every pair/week row.

Core diagnostic: `+1 ADR before -1 ADR`.

| Window | Rows | Selected Pass | Opposite Pass | Selected Rate | Opposite Rate | Opportunity Cost |
|---|---:|---:|---:|---:|---:|---:|
| Clean 2019 full 28 | 1204 | 504 | 500 | 41.86% | 41.53% | 500 |
| Current 2026 full 28 | 644 | 264 | 255 | 40.99% | 39.60% | 255 |

Read:

- Selected COT Faces barely beats the opposite side on the source-opportunity
  diagnostic.
- The dominant corrected tier,
  `cot_faces_dealer_noncomm_commercial_conflict`, is worse than the opposite
  side in clean 2019 and almost flat in current 2026.
- This means the next gate should review source interpretation and alternate
  source variants before optimizing exits.

## Pair Contribution - COT Faces TP1.0 SL2.0

### Clean 2019

| Pair | ADR Contribution | W/L/F |
|---|---:|---:|
| AUDUSD | +7.77% | 30/12/0 |
| USDJPY | +6.43% | 29/14/0 |
| GBPCHF | +3.80% | 30/13/0 |
| GBPUSD | +3.72% | 29/14/0 |
| USDCAD | +3.53% | 29/14/0 |
| AUDCAD | +2.54% | 30/12/0 |
| EURJPY | +1.48% | 30/12/0 |
| EURUSD | -0.63% | 28/15/0 |
| NZDJPY | -1.94% | 25/17/0 |
| USDCHF | -8.38% | 25/18/0 |

### Current 2026

| Pair | ADR Contribution | W/L/F |
|---|---:|---:|
| AUDCAD | +11.48% | 21/2/0 |
| AUDUSD | +6.33% | 18/5/0 |
| GBPCHF | +5.27% | 16/7/0 |
| EURJPY | +3.41% | 16/7/0 |
| USDCHF | +3.07% | 17/6/0 |
| USDCAD | +0.41% | 13/10/0 |
| EURUSD | -0.95% | 13/9/0 |
| USDJPY | -2.97% | 14/9/0 |
| GBPUSD | -4.23% | 13/10/0 |
| NZDJPY | -6.29% | 13/10/0 |

## Tier Contribution - COT Faces TP1.0 SL2.0

### Clean 2019

| Tier | ADR Contribution | Rows | W/L/F |
|---|---:|---:|---:|
| `cot_faces_dealer_noncomm_confirmed` | +12.52% | 393 | 258/135/0 |
| `cot_faces_broad_alignment` | +4.03% | 10 | 9/1/0 |
| `cot_faces_low_confidence_forced` | +2.38% | 8 | 7/1/0 |
| `cot_faces_dealer_leads_commercial_conflicts` | +1.12% | 3 | 3/0/0 |
| `cot_faces_oi_confirmed` | +0.32% | 1 | 1/0/0 |
| `cot_faces_dealer_commercial_confirmed` | -0.06% | 8 | 6/2/0 |
| `cot_faces_weighted_forced` | -0.26% | 2 | 1/1/0 |
| `cot_faces_speculative_crowding_warning` | -1.72% | 1 | 0/1/0 |

### Current 2026

| Tier | ADR Contribution | Rows | W/L/F |
|---|---:|---:|---:|
| `cot_faces_dealer_noncomm_confirmed` | +12.68% | 208 | 138/70/0 |
| `cot_faces_dealer_commercial_confirmed` | +1.28% | 12 | 9/3/0 |
| `cot_faces_oi_confirmed` | +1.14% | 2 | 2/0/0 |
| `cot_faces_broad_alignment` | +1.09% | 3 | 3/0/0 |
| `cot_faces_speculative_crowding_warning` | +0.94% | 1 | 1/0/0 |
| `cot_faces_weighted_forced` | +0.06% | 2 | 1/1/0 |
| `cot_faces_dealer_leads_commercial_conflicts` | -1.64% | 1 | 0/1/0 |

## CTO Read

COT Faces v1 passes the first 10-pair fast-pass screen, but the full 28-pair
target-band sweep is not a clean qualification.

It beats current Dealer on the same 10-pair basket in both clean 2019 and
current 2026, especially when using the simple ADR-based `TP1.0 / SL2.0` exit.
The improvement is risk-adjusted, not just headline return:

- 2019 return/DD improved from current Dealer `0.47` to COT Faces `1.06`.
- 2026 return/DD improved from current Dealer `0.24` to COT Faces `1.05`.

Fresh-eyes metadata correction: the strongest tier was originally labelled
`cot_faces_dealer_noncomm_confirmed`, but in these receipts that bucket is
Commercial-conflict by construction because Dealer+Commercial confirmation is
classified first. Future receipts split that case as
`cot_faces_dealer_noncomm_commercial_conflict`. Direction scoring is unchanged.

That is still an important finding, but the correct read is narrower:
Dealer+Non-commercial agreement over Commercial conflict carried the first
fast-pass basket. It is not broad COT agreement, and the full 28-pair target
receipts now show that pair-level failures must be reviewed before changing
weights or continuing year sweeps.

Risks:

- 2026 profit is meaningfully helped by AUD-linked pairs, especially `AUDCAD`
  and `AUDUSD`.
- `USDCHF` is a major 2019 drag.
- `NZDJPY` is a major 2026 drag.
- Full 28 basket totals are positive on several target-band variants, but too
  many individual pairs remain negative.
- The best target/stop shape is not stable between clean 2019 and current 2026.

Decision:

- Keep `cot_faces_v1_forced` alive.
- Do not promote.
- Do not use week-close as the primary diagnostic.
- Treat clean 2020/2025 as out-of-order secondary evidence for now.
- Do not continue year sweeps until the full 28-pair pair-failure profile is
  reviewed.
- The source opportunity audit now shows selected COT Faces is barely better
  than the opposite side, so the next comparison should inspect source
  interpretation, face signs, tier gating, and alternate source variants before
  basket TP or pair trailing stops.

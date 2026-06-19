# Gate 38: Dealer / Commercial Grid Agreement

Date: 2026-06-16
Status: current-2026 run complete, research-only

## Scope

Goal: test whether app-style Dealer + Commercial agreement is a cleaner ADR
Grid side selector than COT Faces, and whether Strength helps as confirmation
or fade.

Window: 23 closed displayed weeks, `2026-01-05` through `2026-06-08`.
The partial/current `2026-06-15` week was excluded.

ADR Grid terms stayed fixed:

- 0.20 ADR spacing
- 0.20 ADR TP
- 1.0 ADR reset
- 0.20 ADR reset-entry buffer
- no SL
- no costs, margin, slippage, or spread

This did not change live strategy logic.

## Receipts

Full matrix:

- Markdown:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-110356.md`
- JSON:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-110356.json`
- CSV:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-110356.csv`
- Pair qualification CSV:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-110356-pair-qualifications.csv`

Calibration receipt:

- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-4w-20260616-105142.md`

## Calibration

The four manual reference weeks were run first with only
`dealer_commercial_agreement_selected`.

| Week | Manual Reference | Script Raw % | Script ADR | Pair Sides | Read |
|---|---:|---:|---:|---:|---|
| `2026-05-18` | `+4.61` | `+2.78` | `+4.06` | 9 | ADR close |
| `2026-05-25` | `+10.62` | `+5.25` | `+9.94` | 9 | ADR close |
| `2026-06-01` | `+3.84` | `+3.95` | `+7.42` | 6 | raw close, ADR not close |
| `2026-06-08` | `+10.26` | `+7.42` | `+10.59` | 5 | ADR close |

Calibration caveat:

The strict app-style Dealer/Commercial agreement definition is coherent and
uses canonical `basketSource` Dealer and Commercial directions. Three manual
values align with the ADR-normalized output; `2026-06-01` aligns with raw
percent instead. The expanded run therefore uses ADR for scoring as requested,
but exact manual/app display parity should be treated as scale-ambiguous until
the manual reference surface is identified.

## Result Matrix

| Variant | Pair Sides | Total Raw % | Total ADR | Worst Path DD | R/DD | Week-Close ADR | W/L | Max Active | Worst Pair | Worst Currency |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| `dealer_commercial_agreement_friday_strength_agree` | 100 | `+51.65` | `+84.07` | `-20.74` | `4.05` | `-28.78` | 18/2 | 34 | AUDUSD `-4.38` | NZD `-16.53` |
| `dealer_commercial_agreement_open_strength_agree` | 143 | `+89.03` | `+132.01` | `-34.58` | `3.82` | `-31.18` | 21/2 | 49 | GBPUSD `+0.60` | JPY `-29.36` |
| `dealer_commercial_agreement_selected` | 235 | `+80.52` | `+138.57` | `-54.47` | `2.54` | `-133.85` | 20/3 | 56 | NZDUSD `-44.84` | JPY `-51.99` |
| `cot_faces_v1_commercial_delta_contrarian_selected` | 644 | `+180.99` | `+254.12` | `-176.40` | `1.44` | `-370.01` | 19/4 | 123 | NZDUSD `-28.66` | JPY `-78.58` |
| `dealer_commercial_agreement_friday_open_fade_agree` | 37 | `+10.25` | `+25.18` | `-18.90` | `1.33` | `-18.79` | 14/2 | 28 | AUDUSD `-6.38` | GBP `-9.00` |
| `dealer_commercial_agreement_friday_strength_fade_agree` | 101 | `+17.07` | `+30.60` | `-55.80` | `0.55` | `-85.97` | 16/3 | 50 | NZDUSD `-44.00` | USD `-51.17` |
| `cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree` | 129 | `+30.55` | `+37.60` | `-84.68` | `0.44` | `-32.55` | 17/4 | 48 | NZDJPY `-33.50` | JPY `-37.81` |
| `dealer_commercial_agreement_open_strength_fade_agree` | 92 | `-8.51` | `+6.57` | `-56.68` | `0.12` | `-102.66` | 19/4 | 50 | NZDUSD `-47.45` | USD `-54.66` |
| `cot_faces_v1_commercial_delta_contrarian_open_strength_fade_agree` | 296 | `+25.03` | `+16.74` | `-181.86` | `0.09` | `-205.45` | 17/6 | 123 | NZDUSD `-36.25` | JPY `-41.34` |

Note: Friday-strength rows have zero selected sides in some early weeks because
Friday frozen Strength snapshots were unavailable; weekly W/L excludes flat
zero-side weeks.

## Read

Dealer + Commercial agreement is cleaner than COT commercial-delta in current
2026 on risk-adjusted ADR Grid behavior. It gives up headline ADR (`+138.57`
vs `+254.12`) but cuts worst path DD from `-176.40` to `-54.47`, week-close
drag from `-370.01` to `-133.85`, max active fills from `123` to `56`, and
raises R/DD from `1.44` to `2.54`.

Strength helps as confirmation, not fade:

- Open-strength agreement keeps most of the Dealer/Commercial ADR (`+132.01`)
  while improving R/DD to `3.82` and reducing week-close drag to `-31.18`.
- Friday-strength agreement is the best risk-adjusted row at `4.05` R/DD, with
  only `100` pair sides and `34` max active fills, but it is more selective and
  has missing early-week Friday snapshots.
- Open-strength fade and Friday-strength fade are materially weaker. They do
  not validate Strength as a fade layer for this Dealer/Commercial backbone.
- Friday/open-fade agreement is clean but too selective and low-return to be
  the main result from this run.

COT Faces commercial-delta remains useful as an attribution comparison, but in
this matrix it is not the cleaner grid-side backbone. It produces the highest
ADR, but the drawdown, week-close loss, active exposure, and concentration are
too large versus app-style Dealer/Commercial agreement.

No live promotion. Next useful work is a focused failure/concentration breakout
for the top Dealer/Commercial rows, especially the `2026-01-19` stress week,
JPY/NZD/USD concentration, and the Friday-snapshot coverage gap.

## Strength Definition Addendum

Freedom challenged the open-Strength interpretation after the focused COT/App
comparison. The earlier open-Strength fade read came from a smaller and
different slice; it should not be treated as the current definition of
Strength.

Follow-up receipt:

- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-121932.md`

Current-2026 closed-week result:

| Variant | Pair Sides | Total ADR | Worst Path DD | R/DD | Week-Close ADR | W/L |
|---|---:|---:|---:|---:|---:|---:|
| `cot_faces_v1_commercial_delta_contrarian_strength_open_canonical_agree` | 348 | `+237.39` | `-38.91` | `6.10` | `-164.57` | 19/4 |
| `cot_faces_v1_commercial_delta_contrarian_open_friday_strength_agree` | 146 | `+113.61` | `-18.91` | `6.01` | `-65.57` | 19/2 |
| `dealer_commercial_agreement_open_friday_strength_agree` | 63 | `+58.88` | `-12.46` | `4.73` | `-9.99` | 14/3 |
| `dealer_commercial_agreement_friday_strength_agree` | 100 | `+84.07` | `-20.74` | `4.05` | `-28.78` | 18/2 |
| `dealer_commercial_agreement_open_strength_agree` | 143 | `+132.01` | `-34.58` | `3.82` | `-31.18` | 21/2 |
| `cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree` | 129 | `+37.60` | `-84.68` | `0.44` | `-32.55` | 17/4 |
| `dealer_commercial_agreement_open_strength_fade_agree` | 92 | `+6.57` | `-56.68` | `0.12` | `-102.66` | 19/4 |
| `cot_faces_v1_commercial_delta_contrarian_open_strength_fade_agree` | 296 | `+16.74` | `-181.86` | `0.09` | `-205.45` | 17/6 |

Definition read:

- In this source-gated current-2026 window, open canonical Strength behaves
  better as go-with confirmation than as a fade.
- Friday frozen Strength also behaves better as go-with confirmation.
- Combining open + Friday go-with improves risk quality for both source
  families, but cuts trade count and headline return.
- COT commercial-delta plus open Strength has the strongest R/DD among these
  rows, but still carries high week-close drag and NZD concentration.
- Dealer/Commercial plus open + Friday Strength is the cleanest inventory row,
  with the smallest week-close drag and max active footprint, but much lower
  total ADR.

Working definition until contradicted by broader proof: Strength is a
confirmation layer, not a fade layer. Keep `strength_open_canonical` and
`strength_friday_snapshot` separate because they have different coverage and
selectivity; when both agree with the source side, the row is cleaner but more
selective. No live promotion.

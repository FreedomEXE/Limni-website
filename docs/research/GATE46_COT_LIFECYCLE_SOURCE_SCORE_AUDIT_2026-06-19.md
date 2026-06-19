# Gate 46: COT Lifecycle Source-Score Audit

Date: 2026-06-19

## Objective

Test whether a currency-level COT lifecycle / exhaustion score can explain the
conflicting Gate 44 seven-year source-model results before any stop, TP, runner,
grid-entry, or pair-filter tuning.

## Dataset

- Dataset ID: `479624d1-f6a2-4928-82f1-981137762bdc`
- Dataset hash: `cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36`
- Receipt: `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/gate46-cot-lifecycle-source-score-audit-372w-20260619T170102.md`

## Method

This was a read-only overlay on the Gate 44 research matrix warehouse. It did
not rerun price-path simulation and did not change execution rules.

For each currency/report date, compute rolling empirical percentiles:

`TEI = (crowd_percentile + (100 - commercial_percentile) + (100 - dealer_raw_long_minus_short_percentile)) / 3`

`score = abs(TEI - 50) * 2`

Primary crowd leg:

- `noncomm_net`

Sensitivity leg:

- `lev_money_net`

Selected-side polarity:

- `long_currency_TEI - short_currency_TEI`
- Negative means the selected trade side fades the crowded/exhausted spread.
- Positive means the selected trade side goes with the crowded/exhausted spread.

## Result

The exact 156-snapshot non-commercial slice starts on `2021-12-28` because local
COT history starts on `2019-01-08`.

Exact 156-snapshot selected-side polarity:

| Bucket | Pair Sides | ADR | Avg ADR |
| --- | ---: | ---: | ---: |
| fade_extreme | 11337 | 1565.61 | 0.1381 |
| fade_lean | 10799 | 3530.51 | 0.3269 |
| neutral_mixed | 58142 | 14399.97 | 0.2477 |
| with_lean | 14943 | 606.72 | 0.0406 |
| with_extreme | 15863 | -2624.20 | -0.1654 |

Exact 156-snapshot score regime:

| Bucket | Pair Sides | ADR | Avg ADR |
| --- | ---: | ---: | ---: |
| low_continuation | 19018 | 4508.23 | 0.2371 |
| neutral | 65717 | 14312.07 | 0.2178 |
| high_exhaustion | 26349 | -1341.68 | -0.0509 |

## Interpretation

Do not read this as "always fade COT." The cleaner read is:

- Avoid selected sides that go with crowded COT extremes.
- Prefer neutral lifecycle zones or selected sides that fade a crowded lean.
- Friday frozen Strength remains the best current direction candidate, but it
  should be filtered by COT lifecycle before any v3 promotion.
- COT Faces still has edge evidence, but selected and opposite rows both working
  in places shows that raw COT side is not yet clean enough by itself.

## Caveats

- This is source/path evidence on ADR Grid execution, not a finished trading
  system.
- Week-close mark-to-market in the Gate 44 matrix is poor, so exit design remains
  a later gate.
- A full seven-year 156-week COT lifecycle score requires pre-2019 COT warmup
  history.
- No stops, TP, runners, grid entries, pair filters, Pine verifier, or release
  canon were touched.

## Recommended Next Gate

Gate 47: real-value-regime-research.

Research BPR / monthly bank positioning and interest-rate real-value regime as
separate overlays first, then combine them. The purpose is to test whether a
macro regime layer improves the source stack:

Friday frozen Strength direction -> COT Lifecycle quality filter -> BPR/rates
real-value regime -> ADR Grid execution.

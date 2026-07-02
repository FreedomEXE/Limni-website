# Gate 90C 2019 Close-Mode Non-Stoch Band Scorecard

Generated: 2026-07-02

## Purpose

Answer Freedom's follow-up after the first 2019 close-mode check:

- remove stochastic-only variants from the matrix;
- test a wider static ADR / MA / spacing band;
- express result metrics as percentages of starting balance where applicable;
- decide whether a static setting is enough or whether weekly adaptive grid
  selection is required before MT5 build work.

This is still Gate 90C research evidence only. It is not promotion evidence and
does not reopen MT5 EA refactor, red-news blackout, broad COT/Candidate B
redesign, app/live integration, or live-readiness.

## Scope

- Span: `2019-04-14..2019-12-30`
- Universe: all 28 FX pairs
- Mode: close-mode execution tape
- Session: New York daily window
- Signal clock: ADR event
- Target: David MA reversion
- Target ADR: `1`
- Minimum MA expansion: `0.10 ADR`
- Grid adds: adverse-only
- David RSI: `50/60/40`
- Summary-only: yes

## Matrix

Stoch variants were removed.

Activation rules:

- `raw_both`
- `david_contra`
- `candidate_b`
- `candidate_b_david_contra_confirm`
- `candidate_b_david_contra_conflict_candidate`

Settings:

- ADR bricks: `0.05`, `0.075`, `0.10`
- David MA periods: `50`, `75`
- Spacing: `0.20`, `0.30`

Total: `3` ADR bricks x `2` MA periods x `2` spacings x `5` activation rules =
`60` summary rows.

Aggregate artifacts:

- `docs/research/gates/gate90/artifacts/gate90c-close-band-2019-nonstoch-scorecard.csv`
- `docs/research/gates/gate90/artifacts/gate90c-close-band-2019-nonstoch-scorecard.json`

## Top Return Rows

| Cell | Rule | Return % | Max DD % | Return/DD | Fills | Close events | Win % | Avg win % | Avg loss % | Max open | Max depth |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `adr0075_ma50_s2` | `candidate_b` | `17.01` | `-7.70` | `2.209` | `21,960` | `12,783` | `84.17` | `0.0116` | `-0.0531` | `90` | `14` |
| `adr005_ma50_s2` | `candidate_b` | `16.42` | `-5.71` | `2.876` | `26,286` | `16,509` | `84.87` | `0.0081` | `-0.0389` | `86` | `15` |
| `adr010_ma50_s2` | `candidate_b` | `15.51` | `-8.17` | `1.898` | `19,354` | `10,715` | `81.96` | `0.0148` | `-0.0592` | `101` | `14` |
| `adr0075_ma75_s2` | `candidate_b` | `14.13` | `-7.65` | `1.847` | `19,800` | `11,116` | `82.69` | `0.0138` | `-0.0588` | `102` | `14` |
| `adr005_ma75_s2` | `candidate_b` | `13.96` | `-6.78` | `2.059` | `23,743` | `14,303` | `84.59` | `0.0097` | `-0.0468` | `84` | `15` |
| `adr010_ma50_s2` | `candidate_b_david_contra_conflict_candidate` | `13.57` | `-3.40` | `3.991` | `10,290` | `5,674` | `81.99` | `0.0155` | `-0.0572` | `94` | `14` |
| `adr005_ma50_s2` | `candidate_b_david_contra_conflict_candidate` | `11.61` | `-2.99` | `3.883` | `13,973` | `8,770` | `85.10` | `0.0084` | `-0.0388` | `63` | `15` |
| `adr005_ma75_s2` | `candidate_b_david_contra_conflict_candidate` | `11.16` | `-2.10` | `5.314` | `12,256` | `7,421` | `84.75` | `0.0097` | `-0.0441` | `58` | `15` |

## Best By Variant

| Rule | Best return cell | Return % | Max DD % | Fills | Max open | Best return/DD cell | Return/DD | Return % | Max DD % |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| `candidate_b` | `adr0075_ma50_s2` | `17.01` | `-7.70` | `21,960` | `90` | `adr005_ma50_s2` | `2.876` | `16.42` | `-5.71` |
| `candidate_b_david_contra_conflict_candidate` | `adr010_ma50_s2` | `13.57` | `-3.40` | `10,290` | `94` | `adr005_ma75_s2` | `5.314` | `11.16` | `-2.10` |
| `raw_both` | `adr005_ma75_s2` | `9.10` | `-17.25` | `47,571` | `135` | `adr005_ma75_s2` | `0.528` | `9.10` | `-17.25` |
| `candidate_b_david_contra_confirm` | `adr0075_ma50_s2` | `8.93` | `-5.76` | `11,184` | `51` | `adr005_ma50_s2` | `1.688` | `8.71` | `-5.16` |
| `david_contra` | `adr0075_ma50_s2` | `8.81` | `-11.47` | `23,415` | `142` | `adr0075_ma75_s3` | `0.796` | `6.77` | `-8.50` |

## Read

The wider non-stoch matrix changes the read from "pick one static aggressive
setting" to "build an adaptive setup selector."

`candidate_b` owns the highest return rows, but its best rows still carry large
session-flatten drag and can push max open near or above the current comfort
line. It is a strong return engine in this 2019 close-mode surface, not enough
by itself to define a live build.

`candidate_b_david_contra_conflict_candidate` is the best balanced family in
this run. Its leading balanced row, ADR `0.05` / MA75 / spacing `0.20`, returned
`11.16%` with `-2.10%` max drawdown, `12,256` fills, max open `58`, and max
depth `15`. The ADR `0.10` / MA50 / spacing `0.20` row returned `13.57%` with
`-3.40%` max drawdown and only `10,290` fills, but max open reached `94`.

`david_contra` alone is not leading in this 2019 close-mode band. It produced
weaker risk-adjusted results and higher max-open pressure than the Candidate B
conflict family.

Static widening helped cadence and depth versus the original aggressive
ADR `0.025` / MA25 / spacing `0.10` cell, but it did not solve selection. The
best return cell and best balanced cell are different settings.

## Decision Implication

Do not start MT5 build implementation from one static ADR / MA / spacing tuple.

Next research should build a weekly adaptive grid-profile selector that chooses
from a small allowed set of profiles using regime math:

- recent ADR percentile or ADR z-score;
- weekly range expansion/compression z-score;
- MA distance/expansion z-score;
- recent fill pressure, max depth, and flatten drag;
- Candidate B / David conflict-agreement class.

The live-bound candidate should be a profile selector with guardrails, not a
free optimizer. The aggressive ADR `0.025` / MA25 / spacing `0.10` profile
should stay benchmark/research-only unless later evidence proves it can be
bounded by the selector.

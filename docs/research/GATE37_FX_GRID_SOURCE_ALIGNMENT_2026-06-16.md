# Gate 37: FX Grid Source Alignment

Date: 2026-06-16
Status: active research planning

## Why This Gate Exists

Gate 36 started as a 28-pair FX basket pressure probe and ended as an ADR Grid
side-selection problem. The tail of Gate 36 is materially different from its
start, so this gate resets the research surface around one question:

Can COT Faces, Friday-frozen strength, and Sunday/open strength fade identify a
smaller set of ADR Grid sides that preserves harvest while reducing stale
inventory?

This remains research-only. Do not change live strategy logic, tune ADR Grid
terms, add stop loss, add costs/margin, add pair clustering, or promote any
selector from the five-week sample.

## Carry-Forward From Gate 36

Useful Gate 36 findings:

- A blind fully hedged ADR Grid can harvest many TPs, but stale active inventory
  creates dangerous week-close drag.
- The five-week hedged baseline was profitable, so any profitable selector in
  the same window may still be sample-window luck.
- COT Faces became the first constructive source lead as a grid-side permission
  layer, especially in the `2026-06-01` stress week.
- `cot_faces_v1_commercial_delta_contrarian` is the preferred COT variant for
  the next tests because it is slightly stronger in the five-week matrix, but it
  remains the same COT Faces family rather than a proven new model.
- Open canonical strength was bad as selected direction and strong as a fade in
  the five-week sample.
- Friday frozen strength was much better as selected direction than open
  canonical strength and is operationally cleaner because it is known before the
  weekend.

Important caution:

The five-week window is not enough. The fully hedged baseline also made money,
which means profitability alone does not prove the selector. Gate 37 must score
risk-adjusted behavior, stale inventory, and pair/currency concentration before
any expansion of scope.

## Current Timing Concern

The Gate 36h receipt split strength into:

- `strength_open_canonical`: current week-open resolver, including prior 1w/1m
  fallback. In the tested receipts this is near Sunday open / pre-entry.
- `strength_friday_snapshot`: latest 1h/4h/24h strength snapshot at or before
  Friday 17:00 New York.

The ADR Grid receipt starts execution at Sunday 20:00 New York. That makes the
Sunday/open strength fade theoretically pre-entry, but operationally tight.
Friday frozen strength is easier to lock and review before trading starts.

## Trade Qualification Counts

In the side-selector audit, `selectedPairs` means pair-side grid engines allowed
to run for that variant. It is not the same as order fills. One selected pair
side can create many ADR Grid fills during the week.

The full universe has 28 pairs:

- Fully hedged baseline: 56 pair-side engines per week, because it runs LONG and
  SHORT for every pair.
- COT selected / opposite: 28 pair-side engines per week, because COT chooses
  one side for every pair. This is a side selector, not a pair filter.
- Open canonical strength selected / fade: 28 pair-side engines per week in the
  five-week receipt. This is also one side per pair, not a pair filter.
- Friday frozen strength selected / fade: 25, 25, 27, 27, and 28 pair-side
  engines across the five weeks because not every pair had a qualifying Friday
  strength snapshot.
- COT/strength agreement and disagreement rows are real filters. They reduce
  the number of pair-side engines.

Key five-week counts from the Gate 36h receipt:

| Variant | 2026-05-11 | 2026-05-18 | 2026-05-25 | 2026-06-01 | 2026-06-08 | Total | Avg / Week |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fully hedged baseline | 56 | 56 | 56 | 56 | 56 | 280 | 56.0 |
| COT commercial-delta selected | 28 | 28 | 28 | 28 | 28 | 140 | 28.0 |
| Open canonical strength fade | 28 | 28 | 28 | 28 | 28 | 140 | 28.0 |
| Friday frozen strength selected | 25 | 25 | 27 | 27 | 28 | 132 | 26.4 |
| COT commercial-delta when open strength disagrees | 13 | 8 | 19 | 16 | 7 | 63 | 12.6 |
| COT commercial-delta + Friday strength agree | 16 | 14 | 10 | 15 | 18 | 73 | 14.6 |

Current answer:

The best constrained Gate 36h rows do not force 28 pairs. The preferred
commercial-delta COT variant by itself still chooses one side on all 28 pairs,
but the disagreement/agreement filters cut exposure to roughly 13-15 pair sides
per week in the five-week sample.

## Next Hypothesis

Freedom's next question is whether the tradable signal is:

1. go with Friday frozen strength;
2. fade Sunday/open canonical strength;
3. only trade when those two agree.

In pair terms:

- Friday says LONG.
- Open canonical strength says SHORT.
- Fading open canonical strength also says LONG.
- That pair qualifies for the combined Friday-strength / Sunday-fade selector.

This is cleaner than treating Sunday/open strength as a standalone source,
because it turns the Sunday signal into a crowding/staleness condition and asks
Friday strength to confirm the actual side before the weekend.

## Next Test Matrix

Run this before any ADR Grid tuning:

| Variant | Purpose |
|---|---|
| Friday frozen strength selected | Current operationally clean strength baseline |
| Open canonical strength fade | Current strongest standalone five-week strength row |
| Friday selected when it agrees with open-strength fade | Tests the combined timing/fade hypothesis |
| Friday selected when it does not agree with open-strength fade | Isolates leftover Friday directional signal |
| Open-strength fade when it does not agree with Friday | Isolates leftover fade signal |
| COT commercial-delta selected | Current preferred COT baseline |
| COT commercial-delta + Friday/open-fade agreement | Tests whether COT improves the combined strength signal |
| COT commercial-delta when Friday/open-fade disagrees | Checks if COT still matters outside the combined strength agreement |

Score each row by:

- final ADR;
- worst path drawdown ADR;
- return over drawdown;
- week-close ADR loss;
- selected pair-side count;
- max active fills;
- active-fill age;
- worst pair contribution;
- worst currency contribution;
- weekly win/loss count.

First expansion should stay current-2026 closed weeks. Do not jump to broad
2019-current until the exact source and timing definitions survive current
2026.

## Same-Period Quick Pass

Receipt:

`app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-5w-20260616-073833.md`

The side-selector audit was extended in-place with the combined Friday/open-fade
rows. Same input period as Gate 36h: displayed weeks `2026-05-11` through
`2026-06-08`.

Key results:

| Variant | Pair Sides | Avg / Week | Total ADR | Worst Path DD | R/DD | Week-Close ADR | W/L | Max Active |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Open canonical strength fade | 140 | 28.0 | `+155.51` | `-25.45` | `6.11` | `-23.08` | 5/0 | 75 |
| Friday frozen strength selected | 132 | 26.4 | `+123.45` | `-32.33` | `3.82` | `-32.47` | 5/0 | 85 |
| Friday strength + open strength fade agree | 65 | 13.0 | `+77.09` | `-27.81` | `2.77` | `-4.01` | 5/0 | 59 |
| Friday strength outside open-fade agreement | 67 | 13.4 | `+46.37` | `-20.70` | `2.24` | `-28.46` | 4/1 | 57 |
| Open strength fade outside Friday agreement | 75 | 15.0 | `+78.42` | `-13.30` | `5.90` | `-19.07` | 4/1 | 55 |
| COT commercial-delta selected | 140 | 28.0 | `+93.23` | `-19.93` | `4.68` | `-79.85` | 5/0 | 73 |
| COT commercial-delta when open strength disagrees | 63 | 12.6 | `+77.73` | `-12.81` | `6.07` | `-0.06` | 5/0 | 43 |
| COT commercial-delta + Friday/open-fade agree | 34 | 6.8 | `+42.84` | `-10.59` | `4.05` | `-0.06` | 5/0 | 34 |
| COT commercial-delta outside Friday/open-fade agreement | 106 | 21.2 | `+50.39` | `-22.55` | `2.23` | `-79.79` | 3/2 | 69 |

Weekly selected pair-side counts:

| Variant | 2026-05-11 | 2026-05-18 | 2026-05-25 | 2026-06-01 | 2026-06-08 |
|---|---:|---:|---:|---:|---:|
| Friday strength + open strength fade agree | 18 | 11 | 8 | 19 | 9 |
| Friday strength outside open-fade agreement | 7 | 14 | 19 | 8 | 19 |
| Open strength fade outside Friday agreement | 10 | 17 | 20 | 9 | 19 |
| COT commercial-delta + Friday/open-fade agree | 11 | 4 | 5 | 11 | 3 |

Interpretation:

- The combined Friday-strength / open-strength-fade agreement does create a
  real filter: `65` pair sides total, `13.0` per week.
- It keeps the weekly record at `5/0` and cuts week-close drag to `-4.01` ADR,
  but the path drawdown is worse than the COT/open-strength-disagreement slice.
- Adding commercial-delta COT on top makes the filter very selective: only `34`
  pair sides total, `6.8` per week. It is clean on week-close loss and max
  active fills, but gives up too much ADR in this five-week sample to treat as
  the current leader.
- The strongest risk-adjusted Gate 37 shape is still commercial-delta COT when
  open canonical strength disagrees: `+77.73` ADR, `-12.81` worst path DD,
  `6.07` R/DD, `-0.06` week-close ADR, `43` max active fills.
- The Friday/open-fade idea remains useful because it is operationally cleaner
  and reduces exposure, but it should travel into the larger current-2026 test
  as a comparison row rather than replacing the COT/open-disagreement lead.

## Freedom Alignment Note

Freedom clarified the intended research posture after the same-period quick
pass:

- The goal is not simply to select the best five-week row.
- Current app Performance still uses the older split-source style: Dealer,
  Commercial, Sentiment, and Strength are separate, less complex layers than
  the COT Faces work.
- In the current visible app window, Dealer and Commercial are positive,
  Sentiment is clearly losing and remains abandoned for now, and Strength is
  losing materially as a standalone layer.
- The strength-fade work should be treated as a candidate future Strength-layer
  upgrade: make Strength more robust and operationally usable, not just add a
  one-off filter to COT.
- COT Faces and commercial-delta COT also still need broader proof; prior COT
  work looked much better in current 2026 than in older windows, so no source
  layer should be promoted from a narrow local win.
- Sunday/open fade alone is not desirable as the final product shape because it
  is operationally tight. Friday frozen strength plus open-strength fade
  agreement is the cleaner weekend-prep model: prepare from Friday strength, but
  greenlight only when the Sunday/open fade filter agrees.

For the next test and handoff, focus on three core rows:

| Row | Role |
|---|---|
| `cot_faces_v1_commercial_delta_contrarian_selected` | COT baseline using the preferred sophisticated COT variant |
| `strength_friday_snapshot_open_canonical_fade_agree` | Strength-layer upgrade candidate |
| `cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree` | Combined robust thesis row |

The broader attribution rows can remain available, but they are no longer the
center of the next handoff. If the larger test needs later decomposition, emit
pair-level qualification metadata for each selected side: COT direction, Friday
strength direction, open canonical strength direction, open-fade direction,
agreement state, selected side, and exclusion reason.

## Full Current 2026 Core Run

Receipt:

`app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-080233.md`

Generated missing hedged ADR Grid receipts for the current-2026 closed weeks
before `2026-05-11`; no current/partial `2026-06-15` week was included. The
selected receipt window is 23 closed displayed weeks, `2026-01-05` through
`2026-06-08`. ADR Grid terms stayed fixed: 0.20 ADR spacing/TP, 1.0 ADR reset,
0.20 ADR reset-entry buffer, no SL, no costs, no margin.

Core-row result:

| Variant | Pair Sides | Total ADR | Worst Path DD | R/DD | Week-Close ADR | W/L | Max Active | Worst Pair | Worst Currency |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `cot_faces_v1_commercial_delta_contrarian_selected` | 644 | `+254.12` | `-176.40` | `1.44` | `-370.01` | 19/4 | 123 | NZDUSD `-28.66` | JPY `-78.58` |
| `strength_friday_snapshot_open_canonical_fade_agree` | 264 | `+34.66` | `-116.46` | `0.30` | `-116.23` | 15/6 | 114 | NZDJPY `-30.40` | JPY `-52.89` |
| `cot_faces_v1_commercial_delta_contrarian_friday_open_fade_agree` | 129 | `+37.60` | `-84.68` | `0.44` | `-32.55` | 17/4 | 48 | NZDJPY `-33.50` | JPY `-37.81` |

Pair qualification metadata:

- JSON receipt includes `pairQualifications`.
- CSV:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-080233-pair-qualifications.csv`
- Rows: `1,932` (`23 weeks * 28 pairs * 3 variants`).
- Friday/open-fade state across the 644 pair-weeks: `264` agreement, `272`
  disagreement, `108` missing Friday strength.
- Combined COT + Friday/open-fade selected `129` of the `264` agreement
  pair-weeks; the remaining agreement exclusions were COT not confirming the
  Friday/open-fade side.

Read:

The larger current-2026 window does not validate the five-week robust thesis.
Commercial-delta COT selected remains positive but carries large drawdown and
week-close drag. The Friday/open-fade Strength upgrade collapses on
risk-adjusted behavior over the larger window, and adding COT reduces exposure
and week-close drag but still leaves weak `R/DD`. Do not promote live strategy
logic from this result.

## Next Chat Prompt

```txt
Continue Limni / Poseidon in C:\Users\User\Documents\GitHub\limni-website.

Recovery first:
1. Read C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_SESSION.md
2. Read C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_CKB.md
3. Read AGENTS.md
4. Read docs/backlog/CURRENT_WORK.md
5. Read docs/BACKTEST_CANONICAL_PROTOCOL.md
6. Read docs/research/GATE37_FX_GRID_SOURCE_ALIGNMENT_2026-06-16.md

Current gate:
Gate 37: fx-grid-source-alignment.

Latest receipt:
app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-23w-20260616-080233.md

Full current-2026 core run result:
- COT commercial-delta selected: +254.12 ADR, -176.40 DD, 1.44 R/DD,
  -370.01 week-close ADR, 644 pair-sides, 19/4 weeks.
- Friday strength + open-strength fade agree: +34.66 ADR, -116.46 DD,
  0.30 R/DD, -116.23 week-close ADR, 264 pair-sides, 15/6 weeks.
- COT commercial-delta + Friday/open-fade agree: +37.60 ADR, -84.68 DD,
  0.44 R/DD, -32.55 week-close ADR, 129 pair-sides, 17/4 weeks.

Read:
The larger current-2026 window does not validate the Friday/open-fade robust
Strength thesis. Next decision is whether to park that Strength upgrade or use
the emitted pair-qualification CSV for breakouts around the failure drivers
before testing any adjacent source shape. Keep ADR Grid terms frozen and do not
promote live strategy logic.
```

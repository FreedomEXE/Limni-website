# Gate 47: Real-Value Regime Research Handoff

Date: 2026-06-19

## Starting Point

Gate 44 produced a reusable seven-year ADR Grid research matrix warehouse.
Gate 45 passed the warehouse with caveats.
Gate 46 found that COT lifecycle is useful as a source-quality filter:
selected sides going with crowded COT extremes underperformed, while neutral
or fade-lean lifecycle zones performed materially better.

## Candidate v3 Stack

Do not model the stack as many equal sources. Use layers:

1. Direction source: Friday frozen Strength selects the weekly side.
2. Positioning filter: COT Lifecycle interprets Dealer, Commercial, and
   Non-Commercial positioning as one COT model.
3. Macro regime filter: BPR / monthly bank direction plus real-value rates
   decides whether the higher-timeframe backdrop allows or prioritizes the
   trade.
4. Execution: ADR Grid.

Dealer and Commercial are no longer top-level standalone sources in this
framing. They are ingredients in COT Lifecycle.

Sentiment remains parked until deeper historical data exists.

Pair fill cap is not the v3 risk pillar. The third conceptual slot is the
BPR + real-value macro regime layer.

## Gate 47 Objective

Build and test a higher-timeframe currency regime overlay against the existing
Gate 44 seven-year warehouse before any stop, TP, runner, grid-entry, or
pair-filter optimization.

## Required Separation

Test the macro components separately before combining:

1. BPR / monthly bank positioning direction.
2. Interest-rate real-value regime.
3. Combined BPR + real-value regime.

The goal is to learn whether each component carries independent signal and
whether the combined filter improves win rate, drawdown, year stability, or
source-quality segmentation.

## Hard Rules

- Do not tune stops, TP, runners, grid entries, or pair filters.
- Do not modify release canon.
- Do not touch Pine verifier.
- Do not delete generated evidence.
- Treat Gate 44 top rows as source-model evidence, not stop-policy proof.
- Keep BPR and real-value-rates as data contracts before UI work.

## Existing Evidence To Review

- `docs/research/GATE44_REUSABLE_SEVEN_YEAR_MATRIX_DATASET_2026-06-18.md`
- `docs/research/GATE45_SEVEN_YEAR_MATRIX_REVIEW_AND_ACCURACY_AUDIT_HANDOFF_2026-06-19.md`
- `docs/research/GATE46_COT_LIFECYCLE_SOURCE_SCORE_AUDIT_2026-06-19.md`
- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-model-matrix-read-372w-20260619-134630.md`
- `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/gate46-cot-lifecycle-source-score-audit-372w-20260619T170102.md`

## Suggested First Slice

Start with a read-only warehouse overlay, not a new backtest:

1. Define currency/month BPR direction rows.
2. Define currency/week or currency/month real-value-rate rows.
3. Join each row to Gate 44 week/pair decisions by currency exposure.
4. Bucket existing pair ADR contributions by:
   - BPR supports selected side
   - BPR opposes selected side
   - BPR neutral/missing
   - real-value supports selected side
   - real-value opposes selected side
   - real-value neutral/missing
5. Only after separate evidence exists, test combined BPR + real-value logic.

## Decision Needed After First Slice

If BPR and real-value regime do not add stability or improve bad lifecycle
pockets, do not promote them into v3.

If they improve source quality, then the v3 model becomes:

Friday frozen Strength direction -> COT Lifecycle filter -> BPR/rates regime
filter -> ADR Grid execution.

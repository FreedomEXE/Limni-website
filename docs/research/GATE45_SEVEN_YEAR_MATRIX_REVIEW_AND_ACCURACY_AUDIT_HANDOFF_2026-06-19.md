# Gate 45 Seven-Year Matrix Review And Accuracy Audit Handoff

Date: 2026-06-19

Status: handoff for the next agent. This is a review/audit gate, not a new
optimization or strategy-tuning gate.

## Objective

Audit the Gate 44 seven-year matrix work for accuracy, robustness, modularity,
future-proofing, and metadata depth before using the results as a foundation
for stop, runner, TP, grid, or pair-filter optimization.

The question is not "can we find a better parameter." The question is:

```txt
Is the source/path warehouse trustworthy enough that future strategy research
can build on it without rerunning or doubting market/source truth?
```

## Gate 44 State To Review

Gate 44 produced a reusable source/path warehouse and broad source-model matrix.

Key files:

- `app/src/lib/research/localM1Warehouse.ts`
- `app/src/lib/strength/historicalStrength.ts`
- `app/src/lib/performance/pathBarLoader.ts`
- `app/src/lib/research/matrixDataset.ts`
- `app/scripts/verification/export-strength-history-context.ts`
- `app/scripts/verification/export-research-matrix-dataset-contract.ts`
- `app/scripts/verification/export-fx-hedged-adr-grid-week.ts`
- `app/scripts/verification/audit-fx-hedged-adr-grid-side-selectors.ts`
- `database/migrations/027_strength_history_snapshots.sql`
- `database/migrations/028_research_matrix_warehouse.sql`
- `docs/research/GATE44_REUSABLE_SEVEN_YEAR_MATRIX_DATASET_2026-06-18.md`

Important generated evidence:

- Local M1 coverage:
  `app/reports/data-verification/local-m1-warehouse/local-m1-year-coverage-summary-20260619-093609.md`
- Local Strength summary:
  `app/reports/data-verification/local-strength-history/local-strength-weekly-context-summary-20260619-061120.md`
- Latest-valid receipt list:
  `app/reports/data-verification/fx-hedged-adr-grid-batch-logs/latest-valid-receipts-2019-2026-20260619-082149.txt`
- Source coverage:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-coverage-372w-20260619-122837.md`
- Broad matrix receipt:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-372w-20260619-134630.md`
- Broad matrix read:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-model-matrix-read-372w-20260619-134630.md`
- Broad matrix logs:
  `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/logs/gate44-seven-year-all-source-models-20260619-093110.out.log`

Broad dataset:

```txt
dataset_id:   479624d1-f6a2-4928-82f1-981137762bdc
dataset_hash: cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
weeks: 372
variants: 35
source_contexts: 10,416
trade_opportunities: 222,769
pair_decisions: 364,560
variant_week_results: 13,020
trade_events: 0
stop_events: 0
JSON-to-DB parity: 13,020/13,020, mismatches 0
```

Top source-model rows by return / worst-path DD, before any stop/TP/runner
tuning:

| Rank | Variant | Total ADR | Worst Path DD | R/DD | Week-Close ADR |
|---:|---|---:|---:|---:|---:|
| 1 | Open canonical strength fade | `+1005.18` | `-228.13` | `4.41` | `-8310.13` |
| 2 | Friday frozen strength when it disagrees with COT Faces | `+744.11` | `-185.53` | `4.01` | `-4318.14` |
| 3 | COT Faces when Open canonical strength disagrees | `+620.06` | `-155.18` | `4.00` | `-4024.63` |
| 4 | Friday frozen strength when it disagrees with COT Faces commercial-delta contrarian | `+731.62` | `-188.37` | `3.88` | `-4376.99` |
| 5 | Friday frozen strength + open canonical strength fade agree | `+698.41` | `-189.90` | `3.68` | `-3995.66` |
| 6 | COT commercial-delta + open strength fade agree | `+536.94` | `-163.03` | `3.29` | `-4009.11` |

## Required Review Questions

1. Accuracy:
   - Reproduce JSON-to-DB parity for the broad matrix.
   - Confirm the dataset hash behavior is correct: same base dataset hash can
     receive more variant runs when source/path inputs are unchanged.
   - Verify that source-context timestamps are correct for Friday and
     market-open Strength.
   - Verify that market-open Strength is FX market-truth open, not the later
     execution window.
   - Reconcile known missing/partial coverage rows instead of hiding them.

2. Robustness:
   - Confirm the local SQLite M1 path is isolated behind env switches and does
     not alter production DB behavior by default.
   - Confirm broad matrix runs do not require full trade-event persistence.
   - Confirm memory use is bounded enough for future source-model passes.
   - Identify remaining bottlenecks and whether they matter before optimization.

3. Modularity and future-proofing:
   - Check whether raw M1, derived Strength, source contexts, grid receipts,
     matrix warehouse, and analysis reads are separated cleanly.
   - Check whether later stops/runners/TP/grid/pair-filter logic can reuse the
     warehouse without rebuilding market/source truth.
   - Check whether metadata is rich enough for year/regime, pair/currency,
     bad-week, source-agreement, source-fade, and coverage attribution.

4. Result interpretation:
   - Do not overclaim the top rows. The source-model leaders have strong
     realized ADR but severe week-close drag.
   - Treat the result as source-model evidence, not stop-policy proof.
   - Decide whether open Strength fade and source-disagreement rows are real
     enough to justify the next optimization gate.

## Frozen During Gate 45

- No stop/TP/runner/grid tuning.
- No pair-filter optimization.
- No release canon changes.
- No Pine verifier changes.
- No deletion of generated evidence without approval.
- No broad strategy mutation until the matrix accuracy audit passes.

## Expected Gate 45 Output

Produce a review document that says one of:

- `PASS`: Gate 44 warehouse and source-model results are trustworthy enough to
  build on.
- `PASS WITH CAVEATS`: specific known caveats must be carried into optimization.
- `FAIL`: do not optimize yet; fix the identified data, source, path, or
  warehouse issue first.

The review should include:

- parity proof commands and outputs;
- source/path coverage caveats;
- metadata sufficiency notes;
- speed/memory bottleneck notes;
- a clear recommendation for the next gate.


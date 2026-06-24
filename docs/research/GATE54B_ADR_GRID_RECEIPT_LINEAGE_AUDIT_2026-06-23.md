# Gate 54B ADR/Grid Receipt Lineage Audit

Date: 2026-06-23

Status: `FAIL_CLOSED_ORIGINAL_BASE_RECEIPTS_NOT_PRESERVED`

## Objective

Audit ADR/Grid and Gate 44 matrix receipt lineage without source mutation,
backfill, outcome grids, selector comparisons, or system selection.

Question:

```text
Were the original ADR/Grid receipts preserved well enough to use the legacy
matrix path for Gate 54 source readiness?
```

## Paths Searched

| Path / source | Result | Read |
|---|---:|---|
| `.git/info/exclude` | found | `app/reports/data-verification/` is locally excluded. Generated receipts can exist locally without appearing in normal git status. |
| `.gitignore` | found | Global `*.json` and `data/` ignores exist; `app/reports/data-verification/` is not ignored there. |
| `app/reports/data-verification/fx-hedged-adr-grid` | absent | This is the default receipt dir expected by the Gate 54 coverage manifest command. |
| `app/reports/data-verification/fx-hedged-adr-grid-side-selectors` | present | Four Markdown summary/read receipts are present and tracked. |
| `app/reports/data-verification/research-matrix-coverage` | absent | Gate 44 docs cite this coverage-manifest path, but it is not present locally now. |
| `app/reports/data-verification/fx-hedged-adr-grid-batch-logs` | absent | Gate 45 docs cite a latest-valid receipt list there, but it is not present locally now. |
| `app/reports/data-verification/local-m1-warehouse` | absent | Gate 45 docs cite local M1 summary receipts there, but they are not present locally now. |
| `app/reports/data-verification/local-strength-history` | absent | Gate 45 docs cite local Strength summary receipts there, but they are not present locally now. |
| Git history for `fx-hedged-adr-grid*` | partial | Commit `00790be Add seven-year research warehouse tooling` added only four side-selector Markdown receipts. |

## Expected Base Receipt Contract

The no-write Gate 54 coverage smoke reads base ADR grid receipts from:

```text
app/reports/data-verification/fx-hedged-adr-grid
```

For each included week, `export-research-matrix-dataset-contract.ts` expects
JSON receipts with:

```text
scope.weekOpenUtc or scope.weekLabel
scope.expectedPairCount = 28
coverage.missingSymbols = []
coverage.defaultAdrSymbols = []
coverage.pathPoints > 0
```

If the directory is absent or JSON parsing fails, the manifest correctly reports
missing or invalid receipts.

Gate 54 smoke result:

```text
validReceipts=0/23
blockers=missing_or_invalid_receipt:23
```

Classification:

```text
base_weekly_adr_grid_json_lineage = not_preserved_locally
```

## Preserved Matrix Summary Lineage

The following tracked Markdown receipts are present:

| Path | SHA-256 |
|---|---|
| `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-side-selectors-372w-20260619-134630.md` | `F3C9B4C665D5D1D77940E690412447F53A8A1B7A0DC60816479B7D1DBDE8C4BA` |
| `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-coverage-372w-20260619-122837.md` | `475BFDFA016443A02CD710A6361DAA4DA68C74BD3D22C97A5741FA111FDB716F` |
| `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/fx-28pair-hedged-adr-grid-source-model-matrix-read-372w-20260619-134630.md` | `15F1EBED5C406569318B6CD63B93BFFCEC6AF98F0F817E5A02B7958971C52C7F` |
| `app/reports/data-verification/fx-hedged-adr-grid-side-selectors/gate46-cot-lifecycle-source-score-audit-372w-20260619T170102.md` | `9EC432765C4F65F7D217CE1061450C121A84966014900C78B3E09A30DA70BA3F` |

Git lineage:

```text
00790be Add seven-year research warehouse tooling
```

Read:

```text
matrix_summary_markdown_lineage = preserved
matrix_json_receipt_lineage = not_preserved_locally
base_weekly_grid_json_lineage = not_preserved_locally
```

The tracked Markdown receipts are useful institutional evidence, but they are
not substitutes for the original per-week ADR/Grid JSON receipts expected by the
coverage manifest.

## Gate 44 Matrix Relation

Gate 44 docs preserve the broad matrix identity:

```text
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

Gate 44 also cites original receipts that are not present now:

```text
app/reports/data-verification/fx-hedged-adr-grid/fx-28pair-hedged-adr-grid-2026-06-08-20260616-033849.json
app/reports/data-verification/research-matrix-coverage/research-matrix-coverage-manifest-2019-2026-20260619-002530.json
app/reports/data-verification/research-matrix-coverage/research-matrix-coverage-manifest-2019-2026-20260619-002530.md
app/reports/data-verification/fx-hedged-adr-grid-batch-logs/latest-valid-receipts-2019-2026-20260619-082149.txt
app/reports/data-verification/local-m1-warehouse/local-m1-year-coverage-summary-20260619-093609.md
app/reports/data-verification/local-strength-history/local-strength-weekly-context-summary-20260619-061120.md
```

Decision boundary:

```text
Gate 44 matrix identity is documented.
Original base/source receipt lineage is incomplete in the current workspace.
Do not treat reconstructed receipts as original receipts.
```

## M1 Blocker Classification

Gate 54 current-window smoke:

```text
weeksChecked: 24
pairs: 28
weakRows: 29
priorFreezeWeek: 2025-12-29T00:00:00.000Z
priorFreezeWeakRows: 28/28 partial
includedWeakRow: CADCHF, 2026-02-16T00:00:00.000Z, partial, coveragePct=88.53, expectedBars=7200, actualBars=6374
```

Gate 44 already classified `2026-02-16` CADCHF `88.53%` as a known partial.
The `2025-12-29` year-end freeze weakness also matches Gate 44's earlier
market/holiday/provider coverage classification pattern.

Current M1 classification:

| Weakness | Classification | Action |
|---|---|---|
| `2025-12-29` all 28 pairs partial | `rollover_freeze_week_edge_case / market_holiday_provider_fact` | Carry as caveat. No backfill yet. |
| `2026-02-16` CADCHF 88.53% | `known_single_pair_partial_below_90_threshold` | Carry as caveat. No backfill yet. |

No evidence in this audit proves a strategy failure, source-side direction
failure, or need for immediate backfill.

## Gate 54B Decision

```text
Gate 54B ADR/Grid receipt lineage audit: ACCEPT
Legacy baseline source readiness: NOT YET
Original weekly ADR/Grid JSON receipts: NOT PRESERVED LOCALLY
Matrix summary Markdown lineage: PARTIALLY PRESERVED
M1 blockers: CLASSIFIED, NOT BACKFILLED
System selection: NOT AUTHORIZED
Optimization: PAUSED
```

## Next Authorized Work

Next Gate 54 proof should be controlled reconstruction, not original-lineage
claim:

```text
Gate 54C: Controlled No-Write Matrix Identity Reconstruction Proof
```

It should prove:

```text
Can current DB/source state reproduce the locked Gate 44 matrix identity or an
explicitly new reconstruction identity, while preserving the distinction between
original receipts and reconstructed receipts?
```

Required boundaries:

- no outcome grids;
- no selector comparison;
- no source mutation;
- no M1 backfill;
- no BPR/RRP work;
- reconstructed receipts must be labelled reconstructed, not original.

# Gate 50 Macro Regime Join Coverage Receipt

Generated: 2026-06-20T04:37:36.012Z

## Result

- Promotion grade: FAIL
- Pair-week contexts expected: 10416
- Pair-week contexts joinable: 0
- Pair-week contexts blocked: 10416
- Required source families: bpr, rate, inflation, real_rate_pressure, valuation

## Matrix Control

- Dataset id: 479624d1-f6a2-4928-82f1-981137762bdc
- Dataset hash: cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
- Weeks: 372
- Pairs: 28
- Source context rows: 10416
- Week id hash: 54e26e0cc3718d86b53496fc977dfcdd7c9d8841bbaa21defdb3fc4832ba21aa

## Macro Dataset

- Selection mode: latest_unpinned
- Regime dataset id: 97266ab2-6feb-4962-936b-a47d73c06684
- Dataset hash: 3131935ee881bfde850440a272fec06f1de5d3c3710a50e64d23552a0fed4cc0
- Promotion manifest id: none
- Contract manifest hash: none

## Promotion Blockers

| Blocker | Count |
|---|---:|
| macro_dataset_not_pinned | 1 |
| macro_dataset_selection_not_unique_without_dataset_id_or_hash | 1 |
| macro_dataset_missing_promotion_manifest_id | 1 |
| macro_dataset_missing_contract_manifest_hash | 1 |
| missing_required_source_family:bpr | 1 |
| missing_required_source_family:rate | 1 |
| missing_required_source_family:inflation | 1 |
| missing_required_source_family:real_rate_pressure | 1 |
| no_macro_weekly_snapshot_manifests_for_matrix_weeks | 1 |
| missing_weekly_snapshot_manifest | 372 |
| pair_week_join_coverage_incomplete | 1 |

## Files

- JSON: app/reports/data-verification/macro-regime/gate50-macro-join-coverage-current-20260620.json
- Markdown: app/reports/data-verification/macro-regime/gate50-macro-join-coverage-current-20260620.md

No P&L, trade filtering, stop, TP, runner, grid-entry, or macro regime decision is computed by this receipt.

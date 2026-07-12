# Gate 50 Macro Regime Join Coverage Receipt

Generated: 2026-06-20T05:15:23.909Z

## Result

- Join receipt status: FAIL
- Promotion grade: FAIL
- Diagnostic only: true
- Promotion eligible: false
- Feature bundle: real_rate_pressure_attribution_v1
- Pair-week contexts expected: 10416
- Pair-week contexts joinable: 0
- Pair-week contexts blocked: 10416
- Resolved join-map hash: 17d4186afff5eb91616f3ab49778e9acbd9988d39ff3134dc8dcf9e376166461
- Required source families: rate, inflation, real_rate_pressure

## Matrix Control

- Dataset id: 479624d1-f6a2-4928-82f1-981137762bdc
- Dataset hash: cb3dfbd8b4725da3b4c3fdf60e3326810261f7d1334402dcac8a0391b1cadc36
- Weeks: 372
- Pairs: 28
- Source context rows: 10416
- Week id hash: 54e26e0cc3718d86b53496fc977dfcdd7c9d8841bbaa21defdb3fc4832ba21aa

## Macro Dataset

- Selection mode: pinned_regime_dataset_id
- Regime dataset id: a403b126-9f65-4a35-b353-0b9dcc986bd0
- Dataset hash: b184c49fbedc202dad061366ca6dbc25478470230549847fe56b420aa8647ca8
- Promotion manifest id: none
- Contract manifest hash: none

## Promotion Blockers

| Blocker | Count |
|---|---:|
| macro_dataset_missing_promotion_manifest_id | 1 |
| macro_dataset_missing_contract_manifest_hash | 1 |
| missing_required_source_family:real_rate_pressure | 1 |
| unexpected_macro_source_family:real_value | 1 |
| no_macro_weekly_snapshot_manifests_for_matrix_weeks | 1 |
| missing_weekly_snapshot_manifest | 372 |
| pair_week_join_coverage_incomplete | 1 |

## Files

- JSON: app/reports/data-verification/macro-regime/gate50-macro-join-coverage-feature-bundle-rrp-20260620.json
- Markdown: app/reports/data-verification/macro-regime/gate50-macro-join-coverage-feature-bundle-rrp-20260620.md

No P&L, trade filtering, stop, TP, runner, grid-entry, or macro regime decision is computed by this receipt.

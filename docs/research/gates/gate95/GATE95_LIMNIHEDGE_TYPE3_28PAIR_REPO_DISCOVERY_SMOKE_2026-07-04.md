# Gate 95 LimniHedge Type 3 28-Pair Repo Discovery

Date: 2026-07-04

Verdict: `PASS_GATE95_SMOKE_OR_BOUNDED_SUBSET_REPLAY_RESEARCH_ONLY_NO_PROMOTION`

## Scope

Gate 95 implements the outside-review contract as a repo-only first pass: Type 3 entry grammar across the selected Gate 74B universe, Candidate B as a direction overlay, fixed ADR movement streams as replay surfaces, and Triangle/Q/Katarakti-style geometry as shadow context only.

Run mode: `smoke_or_bounded_subset`. A smoke/bounded-subset pass validates the runner and receipts; it is not the all-28 Gate 95 result.

Frozen: no MT5 EA mutation, no live MT5 trading, no broad MT5 optimization, no David profile optimization, no LRMG direction promotion, no Katarakti hard gate in the primary matrix, no app/runtime promotion.

## Accepted Reviewer Recommendations

- Gate 92 is sufficient to stop using MT5 as the Type 3 research driver while keeping the EA reference-only.
- Gate 93 and Gate 94 reject hard Triangle/movement exact filters as direct entry replacements.
- Run exactly 5 candle streams by 5 direction modes before adding variants.
- Treat Candidate B as agreement/fade/reporting context only; it does not initiate Gate 95 trades.
- Keep movement, Triangle/Q, LRMG, and Katarakti as risk/quality shadow receipts in the first matrix.
- Make terminal liquidation, open inventory, hold time, pair concentration, costs, and split stability blocking evidence.

## Rejected Or Deferred Reviewer Recommendations

- No MT5 EA mutation, live MT5 trading, or app/runtime promotion.
- No broad optimizer, David parameter optimization, or extra matrix families before first scorecard review.
- No hard Katarakti, Q, LRMG, Triangle, or exact movement-candle gate in the primary 25 variants.
- No Candidate B standalone trigger and no closed-PF-only success claim.

## Config

- Config hash: `EF0AAE1F625F5B0B345430D181E994B4E417889C9A662E9B10FDC9D0E1CD1898`
- Price bundle: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Candidate B source: `candidate_b_macro_anchor_with_cot_warning`
- Date range: `2025-01-01T00:00:00.000Z` to `2026-05-31T23:59:59.999Z`
- Candle streams: `time_h1`, `adr_event_0_025`, `adr_event_0_05`, `adr_event_0_075`, `adr_event_0_10`
- Direction modes: `type3_both_no_direction`, `type3_long_only`, `type3_short_only`, `candidate_b_agreement_strict`, `candidate_b_fade_strict`

## Variant Summary

| variant_id | closed_trades | open_inventory_rows | terminal_liquidations | net_usd_model | profit_factor | win_pct | expectancy_usd_model | avg_hold_hours | max_hold_hours | max_simultaneous_open | balance_dd_usd_model | equity_dd_usd_model | pair_count_traded |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_candidate_b_agreement_strict | 4593 | 508 | 508 | -10077903.05 | 0.201671 | 88.939691 | -2194.18747 | 498.636257 | 5379.116667 | 616 | 0 | -11744987.242381 | 1 |
| adr_event_0_025_candidate_b_fade_strict | 3981 | 96 | 96 | -1419362.26 | 0.619839 | 97.764381 | -356.534103 | 231.546561 | 9918.25 | 212 | 0 | -2100004.960663 | 1 |
| adr_event_0_025_type3_both_no_direction | 8574 | 604 | 604 | -11497265.31 | 0.297118 | 93.037089 | -1340.945336 | 374.623652 | 9918.25 | 695 | 0 | -13198348.241584 | 1 |
| adr_event_0_025_type3_long_only | 4530 | 17 | 17 | 2766102.57 | 1332.34525 | 99.779249 | 610.618669 | 48.981838 | 1361.566111 | 139 | 0 | -340477.089737 | 1 |
| adr_event_0_025_type3_short_only | 4044 | 587 | 587 | -14263367.88 | 0.127903 | 85.484669 | -3527.044482 | 739.400461 | 9918.25 | 695 | 0 | -14704244.778349 | 1 |
| adr_event_0_05_candidate_b_agreement_strict | 1849 | 189 | 189 | -2981940.87 | 0.272103 | 89.778259 | -1612.731675 | 403.404666 | 5383.633333 | 195 | 0 | -3634678.305013 | 1 |
| adr_event_0_05_candidate_b_fade_strict | 144 | 0 | 0 | 88824.97 |  | 100 | 616.840097 | 100.568657 | 1369.999444 | 32 | 0 | -60242.198098 | 1 |
| adr_event_0_05_type3_both_no_direction | 1993 | 189 | 189 | -2893115.89 | 0.293785 | 90.516809 | -1451.638682 | 381.523891 | 5383.633333 | 195 | 0 | -3634678.305013 | 1 |
| adr_event_0_05_type3_long_only | 691 | 0 | 0 | 450633.78 |  | 100 | 652.147294 | 59.539459 | 1369.999444 | 37 | 0 | -83610.704956 | 1 |
| adr_event_0_05_type3_short_only | 1302 | 189 | 189 | -3343749.67 | 0.183784 | 85.483871 | -2568.164112 | 552.408102 | 5383.633333 | 195 | 0 | -3634678.305013 | 1 |
| adr_event_0_075_candidate_b_agreement_strict | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| adr_event_0_075_candidate_b_fade_strict | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| adr_event_0_075_type3_both_no_direction | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| adr_event_0_075_type3_long_only | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| adr_event_0_075_type3_short_only | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| adr_event_0_10_candidate_b_agreement_strict | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| adr_event_0_10_candidate_b_fade_strict | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| adr_event_0_10_type3_both_no_direction | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| adr_event_0_10_type3_long_only | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| adr_event_0_10_type3_short_only | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| time_h1_candidate_b_agreement_strict | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| time_h1_candidate_b_fade_strict | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| time_h1_type3_both_no_direction | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| time_h1_type3_long_only | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| time_h1_type3_short_only | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |

## Validation

| check | value | expected | passed |
|---|---|---|---|
| outside_review_converted_to_bounded_gate95_contract | 25 variants; geometry/Katarakti shadow only; no MT5 mutation | bounded reviewer plan | true |
| gate92_parity_guard_passed | PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY | PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY | true |
| gate92_validation_failures | 0 | 0 | true |
| gate74b_price_bundle | gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 | gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 | true |
| gate74b_manifest_status | complete | complete | true |
| run_mode | smoke_or_bounded_subset | full_gate95_matrix or smoke_or_bounded_subset | true |
| selected_pair_count | 1 | 28 for full run; lower only for explicit smoke | true |
| variant_count | 25 | 25 | true |
| entry_candidates_materialized | 6526 | >0 | true |
| admission_rows_materialized | 32630 | entries x 5 direction modes per stream | true |
| trade_exit_rows_materialized | 31701 | >0 for non-empty candidate set | true |
| terminal_open_inventory_receipted | 2379 | >=0 explicit ledger | true |
| mt5_ea_mutated_by_gate95_script | repo-side research only | reference-only EA | true |
| gate95_config_hash | EF0AAE1F625F5B0B345430D181E994B4E417889C9A662E9B10FDC9D0E1CD1898 | non-empty | true |

## Interpretation Boundary

This is research evidence only. The lifecycle replay uses reconstructed canonical candles and modeled commission, with swap unavailable instead of borrowed from saved MT5 reports. Any promising row still needs narrower Gate 96 lifecycle, cost, and inventory proof before MT5 or live work.

## Artifacts

- config: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/gate95-config.json`
- coverageJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/coverage.rows.json`
- coverageCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/coverage.rows.csv`
- variantConfigJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/variant-config.rows.json`
- variantConfigCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/variant-config.rows.csv`
- entryCandidatesJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/type3-entry-candidates.rows.json`
- entryCandidatesCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/type3-entry-candidates.rows.csv`
- admissionsJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/type3-entry-admissions.rows.json`
- admissionsCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/type3-entry-admissions.rows.csv`
- exitsJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/trade-exits.rows.json`
- exitsCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/trade-exits.rows.csv`
- inventoryJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/open-inventory.rows.json`
- inventoryCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/open-inventory.rows.csv`
- terminalJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/terminal-liquidations.rows.json`
- terminalCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/terminal-liquidations.rows.csv`
- yearlyJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/yearly-summary.rows.json`
- yearlyCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/yearly-summary.rows.csv`
- monthlyJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/monthly-summary.rows.json`
- monthlyCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/monthly-summary.rows.csv`
- pairJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/pair-summary.rows.json`
- pairCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/pair-summary.rows.csv`
- splitJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/split-summary.rows.json`
- splitCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/split-summary.rows.csv`
- candidateBucketJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/candidate-b-bucket-summary.rows.json`
- candidateBucketCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/candidate-b-bucket-summary.rows.csv`
- movementBucketJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/movement-bucket-summary.rows.json`
- movementBucketCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/movement-bucket-summary.rows.csv`
- kataraktiBucketJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/katarakti-bucket-summary.rows.json`
- kataraktiBucketCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/katarakti-bucket-summary.rows.csv`
- geometryJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/geometry-shadow-summary.rows.json`
- geometryCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/geometry-shadow-summary.rows.csv`
- validationJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/validation.rows.json`
- validationCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/validation.rows.csv`
- metricsJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/metric-definitions.rows.json`
- metricsCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/command-receipt.json`
- runSummary: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/gate95-run-summary.json`
- shaManifest: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/gate95-sha256.txt`
- report: `docs/research/gates/gate95/GATE95_LIMNIHEDGE_TYPE3_28PAIR_REPO_DISCOVERY_SMOKE_2026-07-04.md`
- variantSummary: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-smoke/variant-summary.rows.json`

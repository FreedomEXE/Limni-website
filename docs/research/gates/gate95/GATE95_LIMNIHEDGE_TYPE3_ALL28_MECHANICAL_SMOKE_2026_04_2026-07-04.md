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

- Config hash: `7A9BB5E61FE3AE26FC1D78DAED2D1B1CF7EAE6484C07ECA4C79B85755BF1C539`
- Price bundle: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Candidate B source: `candidate_b_macro_anchor_with_cot_warning`
- Date range: `2026-04-01T00:00:00.000Z` to `2026-04-30T23:59:59.999Z`
- Candle streams: `time_h1`, `adr_event_0_025`, `adr_event_0_05`, `adr_event_0_075`, `adr_event_0_10`
- Direction modes: `type3_both_no_direction`, `type3_long_only`, `type3_short_only`, `candidate_b_agreement_strict`, `candidate_b_fade_strict`

## Variant Summary

| variant_id | closed_trades | open_inventory_rows | terminal_liquidations | net_usd_model | profit_factor | win_pct | expectancy_usd_model | avg_hold_hours | max_hold_hours | max_simultaneous_open | balance_dd_usd_model | equity_dd_usd_model | pair_count_traded |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_candidate_b_agreement_strict | 325 | 68 | 68 | 223542.56 |  | 100 | 687.823249 | 2.350432 | 13.15 | 78 | 0 | -134419.921381 | 2 |
| adr_event_0_025_candidate_b_fade_strict | 194 | 28 | 28 | 142846.21 |  | 100 | 736.32065 | 1.851071 | 13.15 | 65 | 0 | -155303.105097 | 1 |
| adr_event_0_025_type3_both_no_direction | 519 | 96 | 96 | 366388.76 |  | 100 | 705.951372 | 2.163773 | 13.15 | 78 | 0 | -155303.105097 | 3 |
| adr_event_0_025_type3_long_only | 519 | 96 | 96 | 366388.76 |  | 100 | 705.951372 | 2.163773 | 13.15 | 78 | 0 | -155303.105097 | 3 |
| adr_event_0_025_type3_short_only | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
| adr_event_0_05_candidate_b_agreement_strict | 148 | 42 | 42 | 69851.85 | 3.949479 | 90.540541 | 471.97194 | 3.276967 | 13.333333 | 45 | 0 | -122211.129743 | 2 |
| adr_event_0_05_candidate_b_fade_strict | 145 | 40 | 40 | 74735.84 | 2914.785243 | 95.172414 | 515.419612 | 3.519253 | 12.966667 | 28 | 0 | -52122.391573 | 3 |
| adr_event_0_05_type3_both_no_direction | 293 | 82 | 82 | 144587.69 | 7.098579 | 92.832765 | 493.473348 | 3.396869 | 13.333333 | 45 | 0 | -122211.129743 | 5 |
| adr_event_0_05_type3_long_only | 293 | 82 | 82 | 144587.69 | 7.098579 | 92.832765 | 493.473348 | 3.396869 | 13.333333 | 45 | 0 | -122211.129743 | 5 |
| adr_event_0_05_type3_short_only | 0 | 0 | 0 | 0 |  | 0 |  |  |  | 0 | 0 | 0 | 0 |
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
| selected_pair_count | 28 | 28 for full run; lower only for explicit smoke | true |
| variant_count | 25 | 25 | true |
| entry_candidates_materialized | 233 | >0 | true |
| admission_rows_materialized | 1165 | entries x 5 direction modes per stream | true |
| trade_exit_rows_materialized | 2436 | >0 for non-empty candidate set | true |
| terminal_open_inventory_receipted | 534 | >=0 explicit ledger | true |
| mt5_ea_mutated_by_gate95_script | repo-side research only | reference-only EA | true |
| gate95_config_hash | 7A9BB5E61FE3AE26FC1D78DAED2D1B1CF7EAE6484C07ECA4C79B85755BF1C539 | non-empty | true |

## Interpretation Boundary

This is research evidence only. The lifecycle replay uses reconstructed canonical candles and modeled commission, with swap unavailable instead of borrowed from saved MT5 reports. Any promising row still needs narrower Gate 96 lifecycle, cost, and inventory proof before MT5 or live work.

## Artifacts

- config: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/gate95-config.json`
- coverageJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/coverage.rows.json`
- coverageCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/coverage.rows.csv`
- variantConfigJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/variant-config.rows.json`
- variantConfigCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/variant-config.rows.csv`
- entryCandidatesJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/type3-entry-candidates.rows.json`
- entryCandidatesCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/type3-entry-candidates.rows.csv`
- admissionsJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/type3-entry-admissions.rows.json`
- admissionsCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/type3-entry-admissions.rows.csv`
- exitsJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/trade-exits.rows.json`
- exitsCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/trade-exits.rows.csv`
- inventoryJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/open-inventory.rows.json`
- inventoryCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/open-inventory.rows.csv`
- terminalJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/terminal-liquidations.rows.json`
- terminalCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/terminal-liquidations.rows.csv`
- yearlyJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/yearly-summary.rows.json`
- yearlyCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/yearly-summary.rows.csv`
- monthlyJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/monthly-summary.rows.json`
- monthlyCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/monthly-summary.rows.csv`
- pairJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/pair-summary.rows.json`
- pairCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/pair-summary.rows.csv`
- splitJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/split-summary.rows.json`
- splitCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/split-summary.rows.csv`
- candidateBucketJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/candidate-b-bucket-summary.rows.json`
- candidateBucketCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/candidate-b-bucket-summary.rows.csv`
- movementBucketJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/movement-bucket-summary.rows.json`
- movementBucketCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/movement-bucket-summary.rows.csv`
- kataraktiBucketJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/katarakti-bucket-summary.rows.json`
- kataraktiBucketCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/katarakti-bucket-summary.rows.csv`
- geometryJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/geometry-shadow-summary.rows.json`
- geometryCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/geometry-shadow-summary.rows.csv`
- validationJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/validation.rows.json`
- validationCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/validation.rows.csv`
- metricsJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/metric-definitions.rows.json`
- metricsCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/command-receipt.json`
- runSummary: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/gate95-run-summary.json`
- shaManifest: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/gate95-sha256.txt`
- report: `docs/research/gates/gate95/GATE95_LIMNIHEDGE_TYPE3_ALL28_MECHANICAL_SMOKE_2026_04_2026-07-04.md`
- variantSummary: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-mechanical-smoke-2026-04/variant-summary.rows.json`

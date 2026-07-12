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

- Config hash: `36C5AEDF6901A0D072F8595F560AD63BDEC77BD0CB3F8DCDF87215AC4682F118`
- Price bundle: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Candidate B source: `candidate_b_macro_anchor_with_cot_warning`
- Date range: `2025-01-01T00:00:00.000Z` to `2026-05-31T23:59:59.999Z`
- Candle streams: `time_h1`, `adr_event_0_025`, `adr_event_0_05`, `adr_event_0_075`, `adr_event_0_10`
- Direction modes: `type3_both_no_direction`, `type3_long_only`, `type3_short_only`, `candidate_b_agreement_strict`, `candidate_b_fade_strict`

## Variant Summary

| variant_id | closed_trades | open_inventory_rows | terminal_liquidations | net_usd_model | profit_factor | win_pct | expectancy_usd_model | avg_hold_hours | max_hold_hours | max_simultaneous_open | balance_dd_usd_model | equity_dd_usd_model | pair_count_traded |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_candidate_b_agreement_strict | 82715 | 5221 | 5221 | -25291973.96 | 0.341351 | 93.917669 | -305.77252 | 346.552852 | 11335.15 | 1278 | 0 | -11744987.242381 | 27 |
| adr_event_0_025_candidate_b_fade_strict | 96739 | 3202 | 3202 | 784162.92 | 1.101065 | 96.829614 | 8.105965 | 280.785515 | 11328 | 1528 | 0 | -2100004.960663 | 27 |
| adr_event_0_025_type3_both_no_direction | 179454 | 8423 | 8423 | -24507811.04 | 0.469054 | 95.487423 | -136.568764 | 311.099385 | 11335.15 | 1564 | 0 | -13198348.241584 | 27 |
| adr_event_0_025_type3_long_only | 90164 | 2933 | 2933 | 9311179.47 | 37.391193 | 97.030966 | 103.26937 | 258.833257 | 11328 | 1538 | 0 | -1114592.15262 | 24 |
| adr_event_0_025_type3_short_only | 89290 | 5490 | 5490 | -33818990.52 | 0.263249 | 93.928771 | -378.754514 | 363.877112 | 11335.15 | 1278 | 0 | -14704244.778349 | 26 |
| adr_event_0_05_candidate_b_agreement_strict | 8867 | 563 | 563 | -2908487.34 | 0.533462 | 93.785948 | -328.012556 | 342.142205 | 9143.983333 | 288 | 0 | -3634678.305013 | 14 |
| adr_event_0_05_candidate_b_fade_strict | 11062 | 426 | 426 | 370806.11 | 9.431 | 96.420177 | 33.520711 | 312.603014 | 10008.716667 | 292 | 0 | -102153.065329 | 14 |
| adr_event_0_05_type3_both_no_direction | 19929 | 989 | 989 | -2537681.23 | 0.595793 | 95.248131 | -127.336105 | 325.745872 | 10008.716667 | 306 | 0 | -3634678.305013 | 14 |
| adr_event_0_05_type3_long_only | 8912 | 369 | 369 | 853628.29 | 47.660607 | 96.319569 | 95.784144 | 369.146097 | 10008.716667 | 306 | 0 | -111585.233031 | 9 |
| adr_event_0_05_type3_short_only | 11017 | 620 | 620 | -3391309.52 | 0.458247 | 94.381411 | -307.825136 | 290.638055 | 9143.983333 | 288 | 0 | -3634678.305013 | 10 |
| adr_event_0_075_candidate_b_agreement_strict | 1210 | 26 | 26 | 6658.52 | 141.016393 | 99.504132 | 5.50291 | 183.648134 | 5027.132778 | 56 | 0 | -729.678566 | 5 |
| adr_event_0_075_candidate_b_fade_strict | 3016 | 99 | 99 | 14888.83 | 9.440733 | 97.612732 | 4.936616 | 255.167748 | 8594.083333 | 120 | 0 | -4667.54583 | 6 |
| adr_event_0_075_type3_both_no_direction | 4226 | 125 | 125 | 21547.35 | 12.894877 | 98.154283 | 5.098759 | 234.690055 | 8594.083333 | 129 | 0 | -4667.54583 | 6 |
| adr_event_0_075_type3_long_only | 2621 | 118 | 118 | 10340.47 | 6.977522 | 97.29111 | 3.945238 | 333.331321 | 8594.083333 | 129 | 0 | -4667.54583 | 4 |
| adr_event_0_075_type3_short_only | 1605 | 7 | 7 | 11206.88 | 138.356928 | 99.563863 | 6.982483 | 73.606716 | 5685.982778 | 27 | 0 | -1149.800877 | 2 |
| adr_event_0_10_candidate_b_agreement_strict | 292 | 11 | 11 | 1497.14 | 150.764153 | 98.972603 | 5.127186 | 303.085652 | 4368.799444 | 29 | 0 | -476.972824 | 2 |
| adr_event_0_10_candidate_b_fade_strict | 560 | 38 | 38 | 2545.69 | 3.824412 | 94.642857 | 4.545869 | 503.469809 | 8594.083333 | 63 | 0 | -2390.221267 | 2 |
| adr_event_0_10_type3_both_no_direction | 852 | 49 | 49 | 4042.83 | 5.436268 | 96.126761 | 4.7451 | 434.793549 | 8594.083333 | 73 | 0 | -2390.221267 | 2 |
| adr_event_0_10_type3_long_only | 388 | 43 | 43 | 755.13 | 1.86149 | 92.525773 | 1.946207 | 822.508784 | 8594.083333 | 73 | 0 | -2390.221267 | 1 |
| adr_event_0_10_type3_short_only | 464 | 6 | 6 | 3287.7 | 95.542718 | 99.137931 | 7.085554 | 110.583395 | 6079.516111 | 18 | 0 | -926.405464 | 1 |
| time_h1_candidate_b_agreement_strict | 83 | 8 | 8 | 264.84 | 3.759268 | 97.590361 | 3.19081 | 473.758614 | 8164 | 15 | 0 | -154.900018 | 3 |
| time_h1_candidate_b_fade_strict | 461 | 45 | 45 | 204.8 | 1.109217 | 91.75705 | 0.444251 | 601.708901 | 10100 | 23 | 0 | -1400.430222 | 3 |
| time_h1_type3_both_no_direction | 544 | 53 | 53 | 469.64 | 1.238255 | 92.647059 | 0.863303 | 582.187074 | 10100 | 29 | 0 | -1530.459224 | 3 |
| time_h1_type3_long_only | 544 | 53 | 53 | 469.64 | 1.238255 | 92.647059 | 0.863303 | 582.187074 | 10100 | 29 | 0 | -1530.459224 | 3 |
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
| entry_candidates_materialized | 131046 | >0 | true |
| admission_rows_materialized | 655230 | entries x 5 direction modes per stream | true |
| trade_exit_rows_materialized | 615015 | >0 for non-empty candidate set | true |
| terminal_open_inventory_receipted | 28917 | >=0 explicit ledger | true |
| mt5_ea_mutated_by_gate95_script | repo-side research only | reference-only EA | true |
| gate95_config_hash | 36C5AEDF6901A0D072F8595F560AD63BDEC77BD0CB3F8DCDF87215AC4682F118 | non-empty | true |

## Interpretation Boundary

This is research evidence only. The lifecycle replay uses reconstructed canonical candles and modeled commission, with swap unavailable instead of borrowed from saved MT5 reports. Any promising row still needs narrower Gate 96 lifecycle, cost, and inventory proof before MT5 or live work.

## Artifact Durability

The committed report is paired with committed summary/config/validation/receipt artifacts for review. The full row ledgers for entry candidates, admissions, exits, open inventory, and terminal liquidations are intentionally local-only because they are very large; their SHA-256 hashes are bound in `gate95-sha256.txt`.

## Artifacts

- config: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/gate95-config.json`
- coverageJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/coverage.rows.json`
- coverageCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/coverage.rows.csv`
- variantConfigJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/variant-config.rows.json`
- variantConfigCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/variant-config.rows.csv`
- entryCandidatesJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/type3-entry-candidates.rows.json`
- entryCandidatesCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/type3-entry-candidates.rows.csv`
- admissionsJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/type3-entry-admissions.rows.json`
- admissionsCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/type3-entry-admissions.rows.csv`
- exitsJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/trade-exits.rows.json`
- exitsCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/trade-exits.rows.csv`
- inventoryJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/open-inventory.rows.json`
- inventoryCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/open-inventory.rows.csv`
- terminalJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/terminal-liquidations.rows.json`
- terminalCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/terminal-liquidations.rows.csv`
- yearlyJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/yearly-summary.rows.json`
- yearlyCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/yearly-summary.rows.csv`
- monthlyJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/monthly-summary.rows.json`
- monthlyCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/monthly-summary.rows.csv`
- pairJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/pair-summary.rows.json`
- pairCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/pair-summary.rows.csv`
- splitJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/split-summary.rows.json`
- splitCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/split-summary.rows.csv`
- candidateBucketJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/candidate-b-bucket-summary.rows.json`
- candidateBucketCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/candidate-b-bucket-summary.rows.csv`
- movementBucketJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/movement-bucket-summary.rows.json`
- movementBucketCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/movement-bucket-summary.rows.csv`
- kataraktiBucketJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/katarakti-bucket-summary.rows.json`
- kataraktiBucketCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/katarakti-bucket-summary.rows.csv`
- geometryJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/geometry-shadow-summary.rows.json`
- geometryCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/geometry-shadow-summary.rows.csv`
- validationJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/validation.rows.json`
- validationCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/validation.rows.csv`
- metricsJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/metric-definitions.rows.json`
- metricsCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/command-receipt.json`
- runSummary: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/gate95-run-summary.json`
- shaManifest: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/gate95-sha256.txt`
- report: `docs/research/gates/gate95/GATE95_LIMNIHEDGE_TYPE3_ALL28_OOS_2025_2026_2026-07-04.md`
- variantSummary: `docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/variant-summary.rows.json`

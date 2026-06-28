# Current Work

Status: active checklist. Keep this short and update it when gates change.

Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Active Gate

Latest completed gate: Gate 71D: review-packet-no-drift.

Objective completed: close the Gate 71 exit-testing packet after proving the full
Candidate B basket path warehouse, full path diagnostics, and full exit baseline
matrix replay from frozen path materialization.

Status: active on `codex/gate50-macro-source-promotion-proof`.

Architecture version: `gate66_brain_cells_atoms_v3`.

Gate 71 current state:

- Candidate B final ledger remains read-only directional truth.
- Candidate C shadow ledger remains monitoring-only.
- Gate 71A froze the exit-testing protocol before diagnostics or scoring.
- Gate 71A classified legacy ADR Grid as coupled entry+exit behavior; it is a
  control only, not the foundation for basket path diagnostics.
- Gate 71B-M materialized the full reusable Candidate B basket path warehouse:
  `gate71bm_basket_path_1A8231225169`.
- Gate 71B full 373-week diagnostics passed from the basket path warehouse with
  no raw M1 rebuild during diagnostics.
- Gate 71C full matrix passed from the same basket path warehouse with no raw
  M1 rebuild during policy replay.
- Gate 71D review/no-drift packet passed.
- Legacy ADR Grid is a coupled entry+exit control only.
- No exit rule has been promoted.

Gate 71 commands:

- `npm run engine:gate71a:exit-testing-protocol-freeze`
- `npm run engine:gate71bm:exit-path-materialization-warehouse`
- `npm run engine:gate71b:basket-adr-path-diagnostics`
- `npm run engine:gate71c:exit-baseline-matrix`
- `npm run engine:gate71d:review-packet-no-drift`

Gate 71 current verdicts:

- Gate 71A:
  `PASS_GATE71A_EXIT_TESTING_PROTOCOL_FREEZE__CLEAN_BASKET_PATH_REQUIRED`
- Gate 71B-M:
  `PASS_GATE71BM_EXIT_PATH_MATERIALIZATION_WAREHOUSE__FROZEN_PATH_READY_FOR_REPLAY`
- Gate 71B full:
  `PASS_GATE71B_BASKET_ADR_PATH_DIAGNOSTICS__CLEAN_PATH_LEDGER_BUILT`
- Gate 71C full:
  `PASS_GATE71C_EXIT_BASELINE_MATRIX__PREDECLARED_BASKET_RULES_SCORED`
- Gate 71D:
  `PASS_GATE71D_REVIEW_PACKET_NO_DRIFT__EXIT_TEST_PACKET_VISIBLE_NO_PROMOTION`

## Gate 70 Reference

Gate 70D is complete and remains the exit/risk interface lock:

- Gate 70A:
  `PASS_LOCKED_BRAIN_INPUT_PREFLIGHT__B_READONLY_C_MONITORING_ONLY`
- Gate 70B:
  `PASS_EXIT_EXPRESSION_INTERFACE_PREFLIGHT__MANAGEMENT_ONLY_NO_DIRECTION_MUTATION`
- Gate 70C:
  `PASS_RISK_PORTFOLIO_EXPRESSION_PREFLIGHT__MAY_REDUCE_EXPRESSION_NOT_BRAIN_TRUTH`
- Gate 70D:
  `PASS_GATE70_REVIEW_PACKET_COMPLETENESS__INTERFACE_PREFLIGHT_ARTIFACTS_VISIBLE`

## Gate 69 Reference

Gate 69D is complete and remains the lock reference:

- Gate 69A:
  `PASS_FINAL_FORCED28_LOCK_CONTRACT__CANDIDATE_B_DEFAULT_CANDIDATE_C_SHADOW_NO_SELECTOR`
- Gate 69B:
  `PASS_FINAL_FORCED28_LEDGER_REPLAY__B_DEFAULT_C_SHADOW_BOUND_TO_GATE68_CAPSULE`
- Gate 69C:
  `PASS_EXIT_RISK_INTERFACE_AND_NO_DRIFT__BRAIN_FORCED28_OUTPUT_ONLY_RISK_MUTATION_FORBIDDEN`
- Gate 69D:
  `PASS_GATE69_REVIEW_PACKET_COMPLETENESS__LOCK_LEDGER_INTERFACE_ARTIFACTS_VISIBLE`

Gate 69 locked state:

- Locked algorithm id: `gate69_locked_unnamed_forced28_candidate_b_default`.
- Final algorithm name: `null`.
- Default candidate: `candidate_b_macro_anchor_with_cot_warning`.
- Shadow/canary candidate: `candidate_c_scenario_memory_guarded`.
- Rejected lock target: `candidate_d_brain_mode_selector`.
- No Candidate E or additional router was added.
- Final Candidate B ledger hash:
  `5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390`.
- Candidate C shadow ledger hash:
  `DF4170736BC34CF95F616F8888849F018BB33A78EAEACC910E1E4C56B1408720`.

Gate 68 capsule reference:

- Capsule ID: `gate68c_frozen_reference_capsule_C8DC7E99DE640C2D`.
- Capsule SHA:
  `C8DC7E99DE640C2DEA0817C0F48F604575D4FB5CCBC9A9C787261FB4E63073A3`.

## Stop Boundary

Stop after Gate 71D unless Freedom explicitly opens the next gate.

Do not proceed to Gate 72 risk/portfolio expression matrix, final exit
promotion, final algorithm naming/branding, Alpha v2 promotion, risk overlays,
pair-specific exits, regime-specific exits, fair-value pruning, execution,
MT5/live, app/runtime work, source mutation, COT retuning, Strength retuning,
Regime retuning, broad source consolidation, optimized threshold search,
learned weights, pair/date exclusions, P&L attribution, or live trading unless
Freedom explicitly opens that scope.

Permanent rule: Alpha and Regime layers must force 28. Only risk/portfolio
layers may later reduce actual trade expression, while the shadow ledger retains
all 28 signal outcomes.

## Current Ownership Model

- `app/` keeps only app runtime, public assets, release evidence, and app config.
- `engine/` owns reusable local institutional research/backtest source code,
  commands, cached data, and generated engine reports.
- `database/` owns neutral DB access used by app server code and engine code.
- `automation/` owns MT5 assets, bots, sentiment scraper, voice helpers, and
  Playwright automation.
- `archive/` owns stale historical reports, research workspaces, and one-off
  scripts mirrored by original path.

## Active Gate Docs

`docs/research/gates/gate71a/GATE71A_EXIT_TESTING_PROTOCOL_FREEZE_2026-06-28.md`

`docs/research/gates/gate71b/GATE71B_M_EXIT_PATH_MATERIALIZATION_WAREHOUSE_2026-06-28.md`

`docs/research/gates/gate71b/GATE71B_BASKET_ADR_PATH_DIAGNOSTICS_2026-06-28.md`

`docs/research/gates/gate71c/GATE71C_EXIT_BASELINE_MATRIX_2026-06-28.md`

`docs/research/gates/gate71d/GATE71D_REVIEW_PACKET_NO_DRIFT_2026-06-28.md`

## Forward Research Command

After Gate 56E parity, the shared engine evaluator entry point is:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json> --artifact-gate=gate55 --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic
```

For fast manifest aggregation over the durable Gate 57A0B path-outcome
warehouse, add the explicit warehouse ID. This mode validates the warehouse and
fails closed if rows are missing or hash-invalid; it does not silently rerun M1
path simulation:

```powershell
npm run engine:research-manifest:evaluate -- --manifest=<manifest.json> --artifact-gate=gate57 --price-bundle-id=gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 --path-resolution=1m --evaluators=adr_grid,weekly_hold --status=diagnostic --path-outcome-warehouse-id=gate57a0b_pair_week_path_outcomes_47B8F40AFB3B
```

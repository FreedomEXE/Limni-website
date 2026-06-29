# Current Work

Status: active checklist. Keep this short and update it when gates change.

Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Active Gate

Latest completed gate: Gate 73C:
candidate-b-direction-continuation-lifecycle-diagnostic.

Objective completed: test whether Candidate B same-direction pair continuations
are strong enough to justify a carry-until-flip lifecycle baseline review, using
current warehouses only.

Status: active on `codex/gate50-macro-source-promotion-proof`.

Architecture version: `gate66_brain_cells_atoms_v3`.

Gate 73 current state:

- Candidate B final ledger remains read-only directional truth.
- Candidate C shadow ledger remains monitoring-only.
- Gate 73C used locked Candidate B directions and existing pair-week
  weekly-hold outcomes only; it did not run dynamic intrawEEK exits, rebuild raw
  M1, mutate Candidate B, start risk, or promote a lifecycle.
- Gate 73C produced `930` pair-direction streaks across `10,444` pair-week rows.
- Gate 73C key limitation: gross carry-until-flip equals weekly forced close
  under the existing weekly outcome warehouse by construction. Current evidence
  proves lifecycle persistence and cost sensitivity, not continuous raw-price
  carry behavior.
- Gate 73C cost finding: standard-cost carry-until-flip saves `190.28` ADR
  through `0.910954` modeled turnover reduction; standard PF improves from
  `1.261308` weekly forced close to `1.400007` carry-until-flip.
- Gate 73C persistence finding: 5+ week direction streaks contain `9,454`
  pair-weeks, total `610.982752` ADR, and PF `1.950676`; 1-week streaks are
  negative at `-31.565262` ADR.
- Gate 73C recommendation: next named decision boundary is Gate 73D,
  continuation verdict and baseline decision preflight. Do not promote
  carry-until-flip from Gate 73C.
- Gate 73B used existing materialized warehouses only: Gate 57 pair-week
  outcomes, Gate 71B-M basket path warehouse, Gate 71B diagnostics, Gate 72
  matrix rows, and Gate 73A path classes.
- Gate 73B produced a `10,444` row week x pair final-composition ledger with
  no raw M1 source rebuild, no new exit rules scored, no exit promotion, no
  risk layer, and no Brain mutation.
- Gate 73B key finding: top 20 weekly-hold winners average `21.4` positive
  trades and `0.537663` of week ADR from the top 5 final trade legs.
- Gate 73B green-giveback end-state: `222` weeks; `163` mixed end-state,
  `55` broad laggard-drag, and `4` few-surviving-leader weeks.
- Gate 73B explicitly binds the path timing gap: existing warehouses do not
  provide trade-level MFE/MAE timestamps, trade contribution at basket MFE, live
  checkpoint runner identification, or trade-level recovery after adverse
  threshold. Dynamic trade exits need a dedicated trade-leg path warehouse, or
  Gate 73C must stay limited to hypotheses answerable by current warehouses.
- Gate 73A used the Gate 71B diagnostics and Gate 71C/72C exit ledgers only;
  no raw M1 rebuild, new exit rule, exit promotion, or risk layer was started.
- Gate 73A classified all 373 weekly basket paths and produced MFE/MAE,
  giveback, time-to-extreme, threshold-hit, right-tail dependency, and shortlist
  attribution artifacts.
- Top 20 weekly-hold winners contributed `1.077375x` total net ADR. The system
  has clear right-tail dependency.
- Green-then-giveback weeks occurred at `0.595174`; there is real profit
  protection opportunity, but it cannot be solved by clipping runners.
- Gate 72 shortlist rules all clipped the top 20 weekly-hold winners heavily:
  `TRAIL_TP_A100_F050_T200` lost `664.612016` ADR versus weekly hold on top 20
  weeks; `GLOBAL_TP_125_STOP_WEEK` lost `658.692234`; `TRAIL_A075_F025` lost
  `489.683465`; `GLOBAL_TP_050_STOP_200` lost `684.113588`.
- Gate 73A recommendation: next design should be runner-preserving profit
  protection, not another broad fixed-target matrix.

Gate 73 commands:

- `npm run engine:gate73a:weekly-basket-path-anatomy`
- `npm run engine:gate73b:trade-leg-anatomy-preflight`
- `npm run engine:gate73c:direction-continuation-lifecycle`

Gate 73 current verdicts:

- Gate 73A:
  `PASS_GATE73A_WEEKLY_BASKET_PATH_ANATOMY__RIGHT_TAIL_AND_GIVEBACK_PROFILE_VISIBLE`
- Gate 73B:
  `PASS_GATE73B_TRADE_LEG_COMPOSITION_PREFLIGHT__FINAL_COMPOSITION_VISIBLE_PATH_TIMING_GAP_BOUND`
- Gate 73C:
  `PASS_GATE73C_DIRECTION_CONTINUATION_LIFECYCLE__PERSISTENCE_AND_COST_SENSITIVITY_VISIBLE`

Gate 72 reference:

- Gate 72A audited the Gate 71B-M basket path warehouse manifest:
  `gate71bm_basket_path_1A8231225169`.
- Gate 72A confirmed direct bindings for Candidate B ledger file hash, price
  bundle, 1m path resolution, clean exposure model, ADR target, warehouse hash,
  and coverage.
- Gate 72A caveat: Gate 68 capsule identity is bound transitively through Gate
  69B and Gate 71A/71B-M, not as a direct warehouse manifest field.
- Gate 72B confirmed the Gate 71C matrix ledger shape:
  `373` weeks x `34` rules = `12,682` weekly rows, with no duplicate rule-week
  rows and no raw M1 rebuild during replay.
- Gate 72C produced a research-only family shortlist. No clean exit rule passed
  all promotion constraints because clean rules improved win rate by clipping
  weeks but collapsed total ADR versus weekly hold and usually worsened year
  stability.
- Gate 72D review/no-promotion packet passed.
- No exit rule has been promoted.

Gate 71 reference:

- Gate 71B-M materialized the full reusable Candidate B basket path warehouse:
  `gate71bm_basket_path_1A8231225169`.
- Gate 71B full 373-week diagnostics passed from the basket path warehouse with
  no raw M1 rebuild during diagnostics.
- Gate 71C full matrix passed from the same basket path warehouse with no raw
  M1 rebuild during policy replay.
- Legacy ADR Grid is a coupled entry+exit control only.

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

Stop after Gate 73C unless Freedom explicitly opens the next gate.

Do not proceed to Gate 73D continuation verdict/baseline decision preflight,
Gate 74 risk/portfolio expression matrix, final exit promotion, final algorithm
naming/branding, Alpha v2 promotion, risk overlays, dynamic intrawEEK exits,
pair-specific exits, regime-specific exits, fair-value pruning, execution,
MT5/live, app/runtime work, source mutation, COT retuning, Strength retuning,
Regime retuning, broad source consolidation, optimized threshold search, learned
weights, pair/date exclusions, P&L attribution, or live trading unless Freedom
explicitly opens that scope.

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

`docs/research/gates/gate73c/GATE73C_DIRECTION_CONTINUATION_LIFECYCLE_2026-06-29.md`

`docs/research/gates/gate73b/GATE73B_TRADE_LEG_ANATOMY_PREFLIGHT_2026-06-29.md`

`docs/research/gates/gate73a/GATE73A_WEEKLY_BASKET_PATH_ANATOMY_2026-06-29.md`

`docs/research/gates/gate72a/GATE72A_WAREHOUSE_MANIFEST_BINDING_AUDIT_2026-06-28.md`

`docs/research/gates/gate72b/GATE72B_MATRIX_LEDGER_SANITY_REVIEW_2026-06-28.md`

`docs/research/gates/gate72c/GATE72C_EXIT_FAMILY_RANKING_SHORTLIST_2026-06-28.md`

`docs/research/gates/gate72d/GATE72D_REVIEW_PACKET_NO_PROMOTION_2026-06-28.md`

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

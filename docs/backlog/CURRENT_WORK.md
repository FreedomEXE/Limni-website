# Current Work

Status: active checklist. Keep this short and update it when gates change.

Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Active Gate

Gate 70D: review-packet-completeness.

Objective: define the exit/risk consumption boundary for the locked Candidate B
forced-28 Brain output without mutating Brain truth or starting exit/risk
optimization.

Status: active on `codex/gate50-macro-source-promotion-proof`.

Architecture version: `gate66_brain_cells_atoms_v3`.

Gate 70 scope:

- Candidate B final ledger is read-only directional truth.
- Candidate C shadow ledger is monitoring-only.
- Exit layer may change trade management/expression later, not weekly signal
  truth.
- Risk/portfolio layer may reduce actual trade expression later, not rewrite
  Brain direction.
- MT5/live remains closed.
- Learning remains append-only and alert-only.
- Stop before exit scoring, risk pruning, P&L attribution, execution, MT5/live,
  app/runtime work, or Alpha v2.

Gate 70 commands:

- `npm run engine:gate70a:locked-brain-input-preflight`
- `npm run engine:gate70b:exit-expression-interface-preflight`
- `npm run engine:gate70c:risk-portfolio-expression-preflight`
- `npm run engine:gate70d:review-packet-completeness`

Gate 70 current expected verdicts:

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

Stop after Gate 70D unless Freedom explicitly opens the next gate.

Do not proceed to Gate 71 exit layer research matrix, Gate 72 risk/portfolio
expression matrix, final algorithm naming/branding, Alpha v2 promotion, risk
overlays, exits, execution, MT5/live, app/runtime work, source mutation, COT
retuning, Strength retuning, Regime retuning, broad source consolidation,
optimized threshold search, learned weights, pair/date exclusions, P&L
attribution, or live trading unless Freedom explicitly opens that scope.

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

`docs/research/gates/gate70a/GATE70A_LOCKED_BRAIN_INPUT_PREFLIGHT_2026-06-28.md`

`docs/research/gates/gate70b/GATE70B_EXIT_EXPRESSION_INTERFACE_PREFLIGHT_2026-06-28.md`

`docs/research/gates/gate70c/GATE70C_RISK_PORTFOLIO_EXPRESSION_PREFLIGHT_2026-06-28.md`

`docs/research/gates/gate70d/GATE70D_REVIEW_PACKET_COMPLETENESS_2026-06-28.md`

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

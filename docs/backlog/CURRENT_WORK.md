# Current Work

Status: active checklist. Keep this short and update it when gates change.

Persistent memory stays in
`C:/Users/User/Documents/GitHub/freedom-ops/.codex/`; this file tracks the
current Limni work plan so Freedom does not have to reconstruct it from chat.

## Active Gate

Gate 69D: review-packet-completeness.

Objective: lock the simpler final forced-28 architecture after Gate 68 proved
that the smarter Candidate D mode selector did not improve enough to justify the
added complexity.

Status: active on `codex/gate50-macro-source-promotion-proof`.

Architecture version: `gate66_brain_cells_atoms_v3`.

Gate 69 scope:

- Lock Candidate B, `candidate_b_macro_anchor_with_cot_warning`, as the default
  unnamed final forced-28 algorithm.
- Carry Candidate C, `candidate_c_scenario_memory_guarded`, as a frozen
  shadow/canary robustness comparator.
- Emit the final frozen forced-28 decision ledger.
- Bind the final and shadow ledgers to the Gate 68 frozen reference capsule:
  `gate68c_frozen_reference_capsule_C8DC7E99DE640C2D`.
- Prove replay determinism and no-drift rules.
- Define the exact Brain output interface exits/risk may consume later.
- Stop before exits/risk implementation.

Gate 69 commands:

- `npm run engine:gate69a:final-forced28-lock-contract`
- `npm run engine:gate69b:final-forced28-ledger-replay`
- `npm run engine:gate69c:exit-risk-interface-and-no-drift`
- `npm run engine:gate69d:review-packet-completeness`

Gate 69 current expected verdicts:

- Gate 69A:
  `PASS_FINAL_FORCED28_LOCK_CONTRACT__CANDIDATE_B_DEFAULT_CANDIDATE_C_SHADOW_NO_SELECTOR`
- Gate 69B:
  `PASS_FINAL_FORCED28_LEDGER_REPLAY__B_DEFAULT_C_SHADOW_BOUND_TO_GATE68_CAPSULE`
- Gate 69C:
  `PASS_EXIT_RISK_INTERFACE_AND_NO_DRIFT__BRAIN_FORCED28_OUTPUT_ONLY_RISK_MUTATION_FORBIDDEN`
- Gate 69D:
  `PASS_GATE69_REVIEW_PACKET_COMPLETENESS__LOCK_LEDGER_INTERFACE_ARTIFACTS_VISIBLE`

## Gate 68 Reference

Gate 68F is complete and remains the immediate reference:

- Gate 68A:
  `PASS_BRAIN_MODE_SELECTOR_CONTRACT__ONE_SELECTOR_THREE_MODES_NO_OUTCOME_INPUTS`
- Gate 68B:
  `PASS_BRAIN_MODE_SELECTOR_TEST_MATRIX__EXACTLY_FOUR_CANDIDATES__FORCED28_PRESERVED__NO_PROMOTION`
- Gate 68C:
  `PASS_FROZEN_SEVEN_YEAR_REFERENCE_CAPSULE__HASH_BOUND_APPEND_ONLY_NO_DRIFT`
- Gate 68D:
  `PASS_FORWARD_DECISION_RECEIPT_AND_DRIFT_MONITOR__ALERT_ONLY_APPEND_ONLY_NO_LEARNING`
- Gate 68E:
  `PASS_ARCHITECTURE_LOCK_READINESS_REVIEW__CLEAR_VERDICT_NO_RISK_EXITS_LEARNING_STARTED`
- Gate 68F:
  `PASS_REVIEW_PACKET_COMPLETENESS__GATE68_ARTIFACTS_REPO_VISIBLE__COMMANDS_PRESENT`

Gate 68 key findings:

- Candidate D = one deterministic Brain Mode Selector:
  NORMAL -> Candidate B, PROTECTION -> Candidate C, CONSERVATIVE -> Candidate A.
- Candidate D is genuinely new versus Gate 64/65/67, but weaker than Candidate
  B on ADR Grid R/DD and does not preserve Candidate C zero-negative-year
  behavior.
- Candidate B remains the recommended default lock target.
- Candidate C remains the recommended shadow/canary.
- Frozen capsule:
  `gate68c_frozen_reference_capsule_C8DC7E99DE640C2D`.
- Capsule SHA:
  `C8DC7E99DE640C2DEA0817C0F48F604575D4FB5CCBC9A9C787261FB4E63073A3`.

## Stop Boundary

Stop after Gate 69D unless Freedom explicitly opens the next gate.

Do not proceed to final algorithm naming/branding, Alpha v2 promotion, risk
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

`docs/research/gates/gate69a/GATE69A_FINAL_FORCED28_LOCK_CONTRACT_2026-06-28.md`

`docs/research/gates/gate69b/GATE69B_FINAL_FORCED28_LEDGER_REPLAY_2026-06-28.md`

`docs/research/gates/gate69c/GATE69C_EXIT_RISK_INTERFACE_AND_NO_DRIFT_2026-06-28.md`

`docs/research/gates/gate69d/GATE69D_REVIEW_PACKET_COMPLETENESS_2026-06-28.md`

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

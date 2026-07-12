# Gate 74A Trade-Leg Path Warehouse Protocol Freeze

Generated: `2026-06-29T02:38:04.351Z`

## Verdict

`PASS_GATE74A_TRADE_LEG_PATH_WAREHOUSE_PROTOCOL_FREEZE__POLICY_NEUTRAL_PRIMITIVES_ONLY`

## Scope

- Freezes the policy-neutral trade-leg path warehouse contract before materialization.
- Keeps warehouse base data separate from replay adapter policy decisions.
- Defines intrabar crossing semantics and mandatory closed-vs-equity accounting.
- Does not build the warehouse, replay policies, promote exits, start risk, or touch MT5/live/runtime.

## Key Decisions

```json
{
  "base_warehouse_stores_policy_decisions": false,
  "replay_adapters_store_policy_decisions": true,
  "intrabar_ambiguity_explicitly_flagged": true,
  "closed_and_equity_pnl_required_for_every_replay": true,
  "close_profitable_hold_unresolved_until_flip_is_adapter_only": true,
  "gate74a_materialization_started": false
}
```

## Validation

```json
{
  "gate69b_passed": true,
  "gate71bm_passed": true,
  "gate73c_passed": true,
  "candidate_b_forced28_preserved": true,
  "candidate_b_rows": 10444,
  "expected_candidate_b_rows": 10444,
  "candidate_b_weeks": 373,
  "expected_candidate_b_weeks": 373,
  "expected_symbols_per_week": 28,
  "candidate_b_file_hash_matches_gate71_protocol": true,
  "gate73c_was_diagnostic_only": true,
  "raw_m1_rebuild_performed": false,
  "base_warehouse_materialization_started": false,
  "replay_adapters_started": false,
  "policy_optimization_started": false,
  "exit_promotion_started": false,
  "risk_layer_started": false,
  "mt5_live_runtime_started": false,
  "brain_truth_mutated": false,
  "source_mutation_started": false
}
```

## Artifacts

- Protocol freeze: `docs/research/gates/gate74a/artifacts/gate74a-trade-leg-path-warehouse-protocol-freeze/trade-leg-path-warehouse-protocol-freeze.json`
- Base warehouse contract: `docs/research/gates/gate74a/artifacts/gate74a-trade-leg-path-warehouse-protocol-freeze/base-warehouse-contract.json`
- Replay adapter contract: `docs/research/gates/gate74a/artifacts/gate74a-trade-leg-path-warehouse-protocol-freeze/replay-adapter-interface-contract.json`
- Intrabar crossing contract: `docs/research/gates/gate74a/artifacts/gate74a-trade-leg-path-warehouse-protocol-freeze/intrabar-crossing-semantics-contract.json`
- No-drift assertions: `docs/research/gates/gate74a/artifacts/gate74a-trade-leg-path-warehouse-protocol-freeze/no-drift-assertions.json`
- Summary: `docs/research/gates/gate74a/artifacts/gate74a-trade-leg-path-warehouse-protocol-freeze/gate74a-summary.json`
- SHA identity: `docs/research/gates/gate74a/artifacts/gate74a-trade-leg-path-warehouse-protocol-freeze/gate74a-sha256.txt`

## Stop Line

Gate 74A freezes the protocol only. Gate 74B materialization, Gate 74C replay adapters, Gate 74D review, risk, MT5/live, runtime work, source mutation, and exit promotion remain closed until explicitly opened.

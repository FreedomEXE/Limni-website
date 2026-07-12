# Gate 69B Final Forced-28 Ledger Replay

Generated: `2026-06-28T06:37:07.063Z`

## Verdict

`PASS_FINAL_FORCED28_LEDGER_REPLAY__B_DEFAULT_C_SHADOW_BOUND_TO_GATE68_CAPSULE`

## Scope

- Emits the final frozen Candidate B forced-28 decision ledger.
- Emits the frozen Candidate C shadow/canary ledger.
- Proves stored Gate 67C rows replay deterministically from the current frozen inputs.
- Binds both ledgers to the Gate 68 frozen reference capsule.
- Does not rescore, optimize, add candidates, or start exits/risk.

## Replay Proof

```json
{
  "gate_id": "Gate 69B: final-forced28-ledger-replay",
  "final_ledger_hash_from_stored_gate67c_rows": "5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390",
  "final_ledger_hash_from_recomputed_run_a": "5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390",
  "final_ledger_hash_from_recomputed_run_b": "5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390",
  "shadow_ledger_hash_from_stored_gate67c_rows": "DF4170736BC34CF95F616F8888849F018BB33A78EAEACC910E1E4C56B1408720",
  "shadow_ledger_hash_from_recomputed_run_a": "DF4170736BC34CF95F616F8888849F018BB33A78EAEACC910E1E4C56B1408720",
  "shadow_ledger_hash_from_recomputed_run_b": "DF4170736BC34CF95F616F8888849F018BB33A78EAEACC910E1E4C56B1408720",
  "final_decision_hash_mismatches": 0,
  "shadow_decision_hash_mismatches": 0,
  "replay_deterministic": true
}
```

## Ledger Hashes

```json
{
  "final_ledger_hash": "5158742FE3E74221D1F2577A38F3169C6AF9B1FA7BC593B90C901A4F0E562390",
  "shadow_ledger_hash": "DF4170736BC34CF95F616F8888849F018BB33A78EAEACC910E1E4C56B1408720"
}
```

## Validation

```json
{
  "gate69a_passed": true,
  "gate68c_passed": true,
  "final_ledger_shape": {
    "rows": 10444,
    "expected_rows": 10444,
    "weeks": 373,
    "expected_weeks": 373,
    "expected_symbols_per_week": 28,
    "full_weeks": 373,
    "duplicate_week_symbol_rows": 0,
    "forced28_preserved": true
  },
  "shadow_ledger_shape": {
    "rows": 10444,
    "expected_rows": 10444,
    "weeks": 373,
    "expected_weeks": 373,
    "expected_symbols_per_week": 28,
    "full_weeks": 373,
    "duplicate_week_symbol_rows": 0,
    "forced28_preserved": true
  },
  "replay_deterministic": true,
  "final_ledger_bound_to_gate68_capsule": true,
  "shadow_ledger_bound_to_gate68_capsule": true,
  "output_ledgers_include_outcomes": false,
  "new_candidate_added": false,
  "risk_exits_started": false,
  "adaptive_learning_started": false
}
```

## Artifacts

- Final ledger: `docs/research/gates/gate69b/artifacts/gate69b-final-forced28-ledger-replay/final-forced28-decision-ledger.rows.jsonl`
- Shadow ledger: `docs/research/gates/gate69b/artifacts/gate69b-final-forced28-ledger-replay/candidate-c-shadow-canary-ledger.rows.jsonl`
- Replay proof: `docs/research/gates/gate69b/artifacts/gate69b-final-forced28-ledger-replay/replay-determinism-proof.json`
- Final ledger manifest: `docs/research/gates/gate69b/artifacts/gate69b-final-forced28-ledger-replay/final-forced28-ledger.manifest.json`
- Summary: `docs/research/gates/gate69b/artifacts/gate69b-final-forced28-ledger-replay/gate69b-summary.json`
- SHA identity: `docs/research/gates/gate69b/artifacts/gate69b-final-forced28-ledger-replay/gate69b-sha256.txt`

## Stop Line

Gate 69B emits and proves the locked/shadow decision ledgers only. It does not open execution, exits, or risk.

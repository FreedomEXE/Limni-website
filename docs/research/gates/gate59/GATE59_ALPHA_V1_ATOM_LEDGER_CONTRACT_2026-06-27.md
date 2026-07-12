# Gate 59 Alpha v1 Atom Ledger Contract

Generated: 2026-06-27T05:04:56.704Z

## Verdict

PASS_ALPHA_V1_ATOM_LEDGER_CONTRACT_FROZEN.

Gate 59 freezes the Alpha v1 atom ledger contract from existing Gate 58 and Gate 58C artifacts. It is not a new strategy test and does not change COT, Strength, Regime, risk, execution, MT5/live, or app code.

## Alpha v1 Rule

Use locked COT side by default for every pair-week. Use locked Gate 57E Strength side only when the Strength state is `compressed:persistent`, `compressed:flip`, or `middle:persistent`. The alpha layer must output exactly 28 pair directions per supported week and must never skip rows.

## Boundary

- Alpha id: `ALPHA_V1_COT_PARENT_STRENGTH_HEALTHY_FALLBACK`
- Schema version: `gate59_alpha_v1_atom_ledger_v1`
- Source candidate: `C_STRENGTH_HEALTHY_COT_FALLBACK`
- Source matrix: `docs/research/gates/gate58/artifacts/gate58-cot-strength-forensic-matrix/gate58-cot-strength-forensic-matrix.rows.jsonl`
- Source decisions: `docs/research/gates/gate58c/artifacts/gate58c-forced28-directional-arbitration/gate58c-forced28-directional-arbitration.decisions.jsonl`
- Price bundle: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Warehouse ID: `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`
- Not run: raw M1 simulation, COT source change, Strength source/window change, Regime construction, risk overlay, execution change, MT5/live, app work, row veto, pair/week filter, parameter search, or new threshold.

## Artifacts

- Contract JSON: `docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.contract.json`
- Contract SHA-256: `A819E356AA43838642CB7E64564682441E8EC5B3DBDB1AD30B11F907906CBE80`
- Atom ledger JSONL: `docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.rows.jsonl`
- Atom ledger SHA-256: `E4366A2218F91C9F19795BFAC677215F179ED89B68067F2F5B9A81DEAACB0633`
- Summary JSON: `docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.summary.json`
- Summary SHA-256: `2EB1F6FDCE1D081CC755988BCC1A5C175810750443203DB7954C1CE7BE9232E9`
- Receipt JSON: `docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.receipt.json`
- Receipt SHA-256: `066527A652C2F16DE94C89A20C942D9743A96C05545E3DAD9FD676A3751CF546`
- Hash manifest JSON: `docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.hash.json`
- Tracked SHA identity: `docs/research/gates/gate59/artifacts/gate59-alpha-v1-atom-ledger/gate59-alpha-v1-atom-ledger.sha256.txt`

## Validation

```json
{
  "row_count": 10444,
  "expected_row_count": 10444,
  "week_count": 373,
  "expected_week_count": 373,
  "symbol_count": 28,
  "expected_symbols_per_week": 28,
  "full_weeks_count": 373,
  "duplicate_matrix_week_symbol_rows": 0,
  "duplicate_candidate_week_symbol_rows": 0,
  "missing_candidate_rows": 0,
  "unexpected_candidate_rows": 0,
  "final_side_mismatch_rows": 0,
  "rule_source_mismatch_rows": 0,
  "missing_cot_rows": 0,
  "missing_strength_rows": 0,
  "missing_long_outcomes": 0,
  "missing_short_outcomes": 0,
  "price_bundle_mismatch_rows": 0,
  "warehouse_mismatch_rows": 0,
  "alpha_row_count_ok": true,
  "forced_28_ok": true,
  "join_ok": true,
  "lineage_ok": true,
  "rule_ok": true
}
```

## Reconciliation

```json
{
  "final_side_source_counts": {
    "COT": 3067,
    "STRENGTH": 7377
  },
  "cot_vs_gate57e_counts": {
    "disagree": 3752,
    "agree": 6692
  },
  "strength_lifecycle_phase_counts": {
    "compressed:flip": 835,
    "compressed:initial": 7,
    "compressed:persistent": 1769,
    "extreme:flip": 29,
    "extreme:initial": 7,
    "extreme:persistent": 2575,
    "middle:flip": 435,
    "middle:initial": 14,
    "middle:persistent": 4773
  },
  "outcome_sums": {
    "adr_grid_chosen": 1648.250785,
    "adr_grid_candidate_minus_cot": 230.728889,
    "adr_grid_candidate_minus_strength_gate57e": 261.969473,
    "weekly_hold_chosen": 534.366308,
    "weekly_hold_candidate_minus_cot": 180.396944,
    "weekly_hold_candidate_minus_strength_gate57e": 132.841546
  }
}
```

## Contract Sections

- `lineage`: price bundle, warehouse, manifest ids, and source artifact hashes.
- `cot_atoms`: COT side, TEI atoms, carry/tie flags, report dates, report age, and lifecycle state.
- `strength_atoms`: parent side, Gate 57E side, score atoms, lifecycle bucket, phase bucket, and prior Gate 57 transforms.
- `arbitration`: final Alpha v1 side, COT/Strength source, healthy-state flag, agreement flags, and Candidate D duplicate status.
- `outcomes`: long, short, chosen, opposite, COT, Strength parent, Gate 57E Strength, and candidate-minus-baseline outcomes for ADR Grid and Weekly Hold.
- `diagnostics`: missing source/outcome flags carried forward from Gate 58.
- `regime_placeholder`: reserved null namespace for later Regime gates only.

## Stop Line

Stop here. Gate 59 freezes the Alpha v1 atom ledger contract only. Do not proceed to Regime source integrity, Regime shadow signal, risk, execution, MT5/live, app work, or cleanup in this gate.

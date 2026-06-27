# Gate 64B Valuation-Gap Atom Lock

Generated: `2026-06-27T21:01:51.651Z`

## Verdict

`PASS_VALUATION_GAP_ATOM_LOCK__TWO_FORMULAS_EMITTED__PPP_SPOT_AND_COMPOSITE_FAIL_CLOSED`

## Boundary

- Builds only versioned valuation-gap derived atoms supported by existing point-in-time valuation inputs.
- Raw PPP, NEER, and REER atoms remain separate Gate 60C source atoms.
- No Body design, Alpha v2, risk, exits, execution, MT5/live, app/runtime work, source mutation, COT retuning, Strength retuning, or hidden source repair.

## Formula Results

```json
[
  {
    "formula_id": "valuation_gap_reer_deviation",
    "formula_version": "valuation_gap_reer_deviation_v1",
    "status": "emitted",
    "parent_atom_keys": [
      "reer"
    ],
    "fail_closed_reason": null,
    "currency_rows": 2984,
    "pair_rows": 10444
  },
  {
    "formula_id": "valuation_gap_neer_reer_relative",
    "formula_version": "valuation_gap_neer_reer_relative_v1",
    "status": "emitted",
    "parent_atom_keys": [
      "reer",
      "neer"
    ],
    "fail_closed_reason": null,
    "currency_rows": 2984,
    "pair_rows": 10444
  },
  {
    "formula_id": "valuation_gap_ppp_spot",
    "formula_version": null,
    "status": "fail_closed",
    "parent_atom_keys": [
      "ppp"
    ],
    "fail_closed_reason": "missing_hash_bound_point_in_time_spot_or_fair_value_input",
    "currency_rows": 0,
    "pair_rows": 0
  },
  {
    "formula_id": "valuation_gap_composite_ppp_neer_reer",
    "formula_version": null,
    "status": "fail_closed",
    "parent_atom_keys": [
      "ppp",
      "neer",
      "reer"
    ],
    "fail_closed_reason": "ppp_xdc_per_usd_not_comparable_with_neer_reer_indices_without_versioned_normalization",
    "currency_rows": 0,
    "pair_rows": 0
  }
]
```

## Denominator

```json
{
  "alpha_rows": 10444,
  "expected_alpha_rows": 10444,
  "alpha_weeks": 373,
  "expected_alpha_weeks": 373,
  "symbols_per_week_histogram": {
    "28": 373
  },
  "expected_symbols_per_week": 28,
  "full_weeks": 373,
  "duplicate_week_symbol_rows": 0,
  "emitted_formula_count": 2,
  "fail_closed_formula_count": 2,
  "currency_atom_rows": 5968,
  "expected_currency_atom_rows": 5968,
  "pair_atom_rows": 20888,
  "expected_pair_atom_rows": 20888,
  "degraded_pair_rows": 0,
  "non_forced28_joinable_pair_rows": 0
}
```

## Interpretation

- `valuation_gap_reer_deviation_v1` is emitted from REER index deviation versus 2020=100.
- `valuation_gap_neer_reer_relative_v1` is emitted from REER minus NEER.
- `valuation_gap_ppp_spot_v1` is fail-closed because no hash-bound point-in-time spot/fair-value input is present in the current artifacts.
- `valuation_gap_composite_ppp_neer_reer_v1` is fail-closed because PPP XDC/USD is not comparable with NEER/REER indices without a versioned normalization formula.

## Artifacts

- Formula contracts: `docs/research/gates/gate64b/artifacts/gate64b-valuation-gap-atom-lock/valuation-gap-formula-contracts.json`
- Currency atom ledger: `docs/research/gates/gate64b/artifacts/gate64b-valuation-gap-atom-lock/valuation-gap-currency-atom-ledger.rows.jsonl`
- Pair atom ledger: `docs/research/gates/gate64b/artifacts/gate64b-valuation-gap-atom-lock/valuation-gap-pair-atom-ledger.rows.jsonl`
- Lineage map: `docs/research/gates/gate64b/artifacts/gate64b-valuation-gap-atom-lock/valuation-gap-lineage-map.json`
- Fail-closed report: `docs/research/gates/gate64b/artifacts/gate64b-valuation-gap-atom-lock/valuation-gap-fail-closed-report.json`
- SHA identity: `docs/research/gates/gate64b/artifacts/gate64b-valuation-gap-atom-lock/gate64b-valuation-gap-atom-lock.sha256.txt`

## Stop Line

Stop Gate 64B after valuation-gap lock. Proceed to Gate 64C only to refresh the matrix with emitted valuation_gap atoms; do not start Body design, Alpha v2, risk, exits, execution, MT5/live, app/runtime, source mutation, COT retuning, or Strength retuning.

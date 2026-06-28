# Gate 65C Atom Policy Ledger v0

Generated: `2026-06-28T00:51:26.194Z`

## Verdict

`PASS_ATOM_POLICY_LEDGER_V0__FORCED28_PRESERVED__NO_BODY_DIRECTION__NO_OUTCOME_POLICY_LEAK`

## Scope

- Emits atom policy roles only.
- No final Body direction is emitted.
- No outcome fields are used for policy-role assignment.
- Forced-28 pair-week denominator is preserved.

## Policy Roles By Atom

| atom_id | policy_role | rows |
|---|---|---|
| bpr_direction_quality | contradiction_warning | 2930 |
| bpr_direction_quality | follow | 5113 |
| bpr_direction_quality | source_quality_warning | 2401 |
| cot_side | confirm_only | 7460 |
| cot_side | follow | 2496 |
| cot_side | source_quality_warning | 488 |
| cot_spread_lifecycle_quality | context_only | 7460 |
| cot_spread_lifecycle_quality | source_quality_warning | 488 |
| cot_spread_lifecycle_quality | tie_breaker | 2496 |
| neer_raw_context | context_only | 10444 |
| ppp_raw_context | context_only | 10444 |
| reer_raw_context | context_only | 10444 |
| rrp_derived_inverse | follow | 10444 |
| rrp_derived_natural | context_only | 10444 |
| strength_phase_lifecycle_quality | context_only | 7812 |
| strength_phase_lifecycle_quality | source_quality_warning | 28 |
| strength_phase_lifecycle_quality | tie_breaker | 2604 |
| strength_side | confirm_only | 6072 |
| strength_side | follow | 4344 |
| strength_side | source_quality_warning | 28 |

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
  "forced28_preserved": true
}
```

## Validation

```json
{
  "forced28_pair_week_denominator_preserved": true,
  "every_required_policy_atom_has_rows": true,
  "body_direction_emitted": false,
  "outcome_data_used_for_policy_assignment": false,
  "source_mutation_rows": 0
}
```

## Artifacts

- Policy ledger rows: `docs/research/gates/gate65c/artifacts/gate65c-atom-policy-ledger-v0/atom-policy-ledger.rows.jsonl`
- Role summary: `docs/research/gates/gate65c/artifacts/gate65c-atom-policy-ledger-v0/atom-policy-role-summary.json`
- Quality summary: `docs/research/gates/gate65c/artifacts/gate65c-atom-policy-ledger-v0/atom-policy-quality-summary.json`
- Policy contract: `docs/research/gates/gate65c/artifacts/gate65c-atom-policy-ledger-v0/atom-policy-contract.json`
- Summary: `docs/research/gates/gate65c/artifacts/gate65c-atom-policy-ledger-v0/gate65c-summary.json`
- SHA identity: `docs/research/gates/gate65c/artifacts/gate65c-atom-policy-ledger-v0/gate65c-sha256.txt`

## Stop Line

Gate 65C stops at policy ledger diagnostics. Body design, Alpha v2, risk, execution, app/runtime, and optimization remain closed.

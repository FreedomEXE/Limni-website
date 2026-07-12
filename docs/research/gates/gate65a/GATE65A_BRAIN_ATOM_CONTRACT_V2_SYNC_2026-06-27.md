# Gate 65A Brain Atom Contract v2 Sync

Generated: `2026-06-28T00:51:08.466Z`

## Verdict

`PASS_BRAIN_ATOM_CONTRACT_V2_SYNC__VALUATION_GAP_VISIBLE__FAIL_CLOSED_VARIANTS_EXPLICIT__FORCED28_UNCHANGED`

## Scope

- Contract sync only.
- Gate 64B valuation-gap emitted formulas are now contract-visible Regime derived atoms.
- Gate 64B fail-closed valuation-gap variants remain explicit fail-closed formula entries.
- No historical Gate 59-64 artifacts were rewritten.
- Body remains reserved and Risk remains a later portfolio permission layer.

## Regime Contract Surface

| atom_id | class | status | source_gate | role |
|---|---|---|---|---|
| bpr_futures | direction_signal | building | Gate 60G | signal_atom |
| bpr_futures_and_options | shadow_only | shadow | Gate 60G | shadow_atom |
| bpr_futures_carried_state | source_quality | building | Gate 60G | source_quality_atom |
| bpr_futures_synthetic_usd_state | source_quality | building | Gate 60G | source_quality_atom |
| nominal_rate_3m | context_signal | sealed_parent | Gate 60C | signal_atom |
| cpi_inflation_yoy | context_signal | sealed_parent | Gate 60C | signal_atom |
| rrp_derived | derived_signal | building | Gate 60C | signal_atom |
| ppp | context_signal | building | Gate 60C | signal_atom |
| neer | context_signal | building | Gate 60C | signal_atom |
| reer | context_signal | building | Gate 60C | signal_atom |
| valuation_gap_reer_deviation | derived_signal | building | Gate 64B | signal_atom |
| valuation_gap_neer_reer_relative | derived_signal | building | Gate 64B | signal_atom |
| valuation_gap_ppp_spot | fail_closed | fail_closed | Gate 64B | diagnostic_atom |
| valuation_gap_composite_ppp_neer_reer | fail_closed | fail_closed | Gate 64B | diagnostic_atom |

## Validation

```json
{
  "emitted_valuation_gap_formulas_visible": true,
  "fail_closed_valuation_gap_variants_visible": true,
  "removed_gate61a_atoms": [],
  "body_reserved": true,
  "risk_reserved": true,
  "forced28_preserved": true,
  "historical_evidence_rewritten": false,
  "body_started": false,
  "risk_started": false,
  "alpha_v2_started": false
}
```

## Artifacts

- Brain Atom Contract v2: `docs/research/gates/gate65a/artifacts/gate65a-brain-atom-contract-v2-sync/brain-atom-contract-v2.json`
- Diff vs Gate 61A: `docs/research/gates/gate65a/artifacts/gate65a-brain-atom-contract-v2-sync/brain-atom-contract-v2-diff-vs-gate61a.json`
- Valuation-gap sync report: `docs/research/gates/gate65a/artifacts/gate65a-brain-atom-contract-v2-sync/valuation-gap-architecture-sync-report.json`
- Summary: `docs/research/gates/gate65a/artifacts/gate65a-brain-atom-contract-v2-sync/gate65a-summary.json`
- SHA identity: `docs/research/gates/gate65a/artifacts/gate65a-brain-atom-contract-v2-sync/gate65a-sha256.txt`

## Stop Line

Gate 65A stops at contract sync. It does not start Body design, Alpha v2, risk, execution, app/runtime work, source mutation, or optimization.

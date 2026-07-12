# Gate 65D Scenario Memory Ledger v0

Generated: `2026-06-28T00:51:47.928Z`

## Verdict

`PASS_SCENARIO_MEMORY_LEDGER_V0__DESCRIPTIVE_ONLY__NO_BODY_DIRECTION__LOW_SUPPORT_FLAGGED`

## Scope

- Descriptive memory ledger only.
- Fingerprints are built from point-in-time atom and policy state fields.
- Outcomes are used only in retrospective group summaries.
- No Body direction, hidden optimized group, or final decision is emitted.

## Group Summary Samples

### Cell Agreement State

| group_key | support | years | follow_pf | fade_pf | hint | low_support |
|---|---|---|---|---|---|---|
| cot_strength=true|cot_rrp=true|strength_rrp=true|rrp_valuation=true | 2138 | 8 | 1.201958 | 0.778317 | historically_reliable_direct_vote_reference | false |
| cot_strength=true|cot_rrp=false|strength_rrp=false|rrp_valuation=true | 1906 | 8 | 1.163981 | 1.184505 | historically_dangerous_or_fade_candidate_reference | false |
| cot_strength=true|cot_rrp=false|strength_rrp=false|rrp_valuation=false | 1764 | 8 | 0.987732 | 1.256166 | historically_dangerous_or_fade_candidate_reference | false |
| cot_strength=false|cot_rrp=true|strength_rrp=false|rrp_valuation=true | 1210 | 8 | 0.856238 | 1.29599 | historically_dangerous_or_fade_candidate_reference | false |
| cot_strength=false|cot_rrp=false|strength_rrp=true|rrp_valuation=true | 1120 | 8 | 1.490936 | 1.037931 | historically_reliable_direct_vote_reference | false |
| cot_strength=true|cot_rrp=true|strength_rrp=true|rrp_valuation=false | 884 | 8 | 1.067266 | 0.991926 | mixed_context_only_reference | false |
| cot_strength=false|cot_rrp=false|strength_rrp=true|rrp_valuation=false | 812 | 8 | 2.053245 | 1.11843 | historically_reliable_direct_vote_reference | false |
| cot_strength=false|cot_rrp=true|strength_rrp=false|rrp_valuation=false | 610 | 8 | 1.537324 | 0.954109 | historically_reliable_direct_vote_reference | false |

### RRP / Valuation Agreement State

| group_key | support | years | follow_pf | fade_pf | hint | low_support |
|---|---|---|---|---|---|---|
| rrp_valuation_agree|rrp=QUOTE_CURRENCY|valuation=QUOTE_CURRENCY | 3733 | 8 | 1.225107 | 0.970489 | historically_reliable_direct_vote_reference | false |
| rrp_valuation_disagree|rrp=BASE_CURRENCY|valuation=QUOTE_CURRENCY | 3166 | 8 | 1.186562 | 1.129683 | historically_reliable_direct_vote_reference | false |
| rrp_valuation_agree|rrp=BASE_CURRENCY|valuation=BASE_CURRENCY | 2641 | 8 | 1.037579 | 1.047512 | useful_as_confirmation_or_warning_reference | false |
| rrp_valuation_disagree|rrp=QUOTE_CURRENCY|valuation=BASE_CURRENCY | 904 | 8 | 1.268966 | 1.064427 | historically_reliable_direct_vote_reference | false |

## Validation

```json
{
  "scenario_memory_descriptive_only": true,
  "fingerprints_point_in_time_or_calendar_only": true,
  "outcomes_used_only_for_retrospective_scoring_summaries": true,
  "optimized_groups_created": false,
  "body_direction_emitted": false,
  "forced28_preserved": true,
  "low_support_groups_explicitly_flagged": true
}
```

## Artifacts

- Scenario rows: `docs/research/gates/gate65d/artifacts/gate65d-scenario-memory-ledger-v0/scenario-memory.rows.jsonl`
- Group summary: `docs/research/gates/gate65d/artifacts/gate65d-scenario-memory-ledger-v0/scenario-group-summary.json`
- Scenario policy/outcome summary: `docs/research/gates/gate65d/artifacts/gate65d-scenario-memory-ledger-v0/scenario-policy-outcome-summary.json`
- Low-support report: `docs/research/gates/gate65d/artifacts/gate65d-scenario-memory-ledger-v0/low-support-scenario-report.json`
- Scenario memory contract: `docs/research/gates/gate65d/artifacts/gate65d-scenario-memory-ledger-v0/scenario-memory-contract.json`
- Summary: `docs/research/gates/gate65d/artifacts/gate65d-scenario-memory-ledger-v0/gate65d-summary.json`
- SHA identity: `docs/research/gates/gate65d/artifacts/gate65d-scenario-memory-ledger-v0/gate65d-sha256.txt`

## Stop Line

Gate 65D stops at descriptive scenario-memory evidence. It does not open Body design, Alpha v2, risk, execution, or optimization.

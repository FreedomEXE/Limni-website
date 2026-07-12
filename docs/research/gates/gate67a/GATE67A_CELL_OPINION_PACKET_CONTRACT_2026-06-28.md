# Gate 67A Cell Opinion Packet Contract

Generated: `2026-06-28T02:52:57.624Z`

## Verdict

`PASS_CELL_OPINION_PACKET_CONTRACT__THREE_CELLS_FORCED28_JOINABLE__NO_FINAL_ALGORITHM_DIRECTION`

## Scope

- Converts Gate 65 atom policy and scenario context into compact cell opinion packets.
- Emits one packet per COT, Strength, and Regime cell for every pair-week.
- Does not emit a final forced-28 algorithm direction.
- Does not use outcome fields for opinion assignment.

## Role Counts By Cell

| cell_id | role | rows |
|---|---|---|
| cot | CONFIRM | 1204 |
| cot | CONTEXT | 7460 |
| cot | WARNING | 1780 |
| regime | ANCHOR | 7576 |
| regime | CONTEXT | 2868 |
| strength | CONFIRM | 4944 |
| strength | CONTEXT | 3198 |
| strength | TIE_BREAKER | 2274 |
| strength | WARNING | 28 |

## Quality Counts By Cell

| cell_id | quality_state | rows |
|---|---|---|
| cot | CLEAN | 9956 |
| cot | DEGRADED | 488 |
| regime | CLEAN | 5113 |
| regime | DEGRADED | 5331 |
| strength | CLEAN | 10416 |
| strength | DEGRADED | 28 |

## Forced-28 Joinability

```json
{
  "alpha_denominator": {
    "rows": 10444,
    "expected_rows": 10444,
    "weeks": 373,
    "expected_weeks": 373,
    "expected_symbols_per_week": 28,
    "full_weeks": 373,
    "duplicate_week_symbol_rows": 0,
    "forced28_preserved": true
  },
  "expected_symbols_per_week": 28,
  "one_packet_per_cell_per_pair_week": true,
  "every_cell_has_expected_rows": true,
  "duplicate_opinion_rows": 0,
  "outcome_fields_used_for_opinion_assignment": false,
  "final_algorithm_direction_emitted": false
}
```

## Artifacts

- Contract: `docs/research/gates/gate67a/artifacts/gate67a-cell-opinion-packet-contract/cell-opinion-contract.json`
- Opinion ledger: `docs/research/gates/gate67a/artifacts/gate67a-cell-opinion-packet-contract/cell-opinion-ledger.rows.jsonl`
- Summary: `docs/research/gates/gate67a/artifacts/gate67a-cell-opinion-packet-contract/cell-opinion-summary.json`
- Quality summary: `docs/research/gates/gate67a/artifacts/gate67a-cell-opinion-packet-contract/cell-opinion-quality-summary.json`
- Year summary: `docs/research/gates/gate67a/artifacts/gate67a-cell-opinion-packet-contract/cell-opinion-year-summary.json`
- SHA identity: `docs/research/gates/gate67a/artifacts/gate67a-cell-opinion-packet-contract/gate67a-sha256.txt`

## Stop Line

Gate 67A stops at cell opinion packets. It does not define or score the final forced-28 algorithm.

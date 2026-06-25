# Gate 50 Raw Artifact Parser Replay Receipt

Generated: 2026-06-23T04:45:49.295Z

## Result

- Status: FAIL_RAW_ARTIFACT_PAYLOAD_INCOMPLETE
- Replay input level: RAW_ARCHIVED_ARTIFACTS
- Network access used: false
- Stored normalized rows used as inputs: false
- Stored availability events used as inputs: false
- Stored weekly snapshots used as inputs: false
- Stored derived rows used as inputs: false
- Isolated replay target: true
- Raw artifact archive completeness: FAIL
- Parser replay status: BLOCKED_NOT_RUN
- Negative tests status: BLOCKED_NOT_RUN
- Overall promotion rebuild: PENDING
- Resolved content join-map hash target: fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391

## Blockers

| Blocker | Count |
|---|---:|
| cpi_raw_payload_bytes_not_archived | 1 |
| raw_artifact_parser_replay_not_run | 1 |
| negative_tests_not_run_due_to_incomplete_raw_archive | 1 |

The proof fails closed before parser replay because every required raw source payload must be available from the archive. Hash-only binary evidence is sufficient for warehouse lineage, but not for independent parser replay. This receipt does not activate snapshots, compute P&L, or make strategy decisions.

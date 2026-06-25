# Gate 50 Deterministic Rebuild Proof Receipt

Generated: 2026-06-23T04:01:05.069Z

## Result

- Status: WAREHOUSE_CANONICAL_REBUILD_PASS_RAW_ARTIFACT_PARSER_REPLAY_PENDING
- Rebuild input level: STORED_CANONICAL_WAREHOUSE_CONTENT_WITH_ARCHIVED_ARTIFACT_HASH_VALIDATION
- Stored normalized rows used as inputs: true
- Stored weekly snapshots used as inputs: true
- Raw archived artifacts reparsed: false
- Comparison target: STORED_CANONICAL_CONTENT
- Warehouse canonical rebuild status: PASS
- Raw artifact parser replay status: PENDING
- Overall promotion rebuild status: PENDING
- Source-artifact-to-parent content proof: PASS
- Parent-to-RRP rebuild: PASS
- RRP rows: 2976
- RRP stale: 0
- RRP missing: 0
- Resolved content join-map hash: fca281b77d508b3ed806fcd59c595dff1cb8e1e4dda82eea178610c1d056f391

## Blockers

| Blocker | Count |
|---|---:|
| - | 0 |

This receipt validates canonical warehouse content and archived artifact payload hashes. It does not independently replay every raw archived artifact through the frozen parsers, so the raw artifact parser replay remains a separate pending proof. It excludes database UUIDs, build timestamps, generated-at timestamps, local paths, and raw receipt file timestamps from canonical rebuild identities. It does not activate snapshots, compute P&L, or make strategy decisions.

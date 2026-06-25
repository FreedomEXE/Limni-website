# Gate 50 Deterministic Rebuild Proof Receipt

Generated: 2026-06-23T02:51:08.718Z

## Result

- Status: PASS_DETERMINISTIC_REBUILD
- Rebuild input level: STORED_CANONICAL_WAREHOUSE_CONTENT_WITH_ARCHIVED_ARTIFACT_HASH_VALIDATION
- Stored normalized rows used as inputs: true
- Stored weekly snapshots used as inputs: true
- Raw archived artifacts reparsed: false
- Comparison target: STORED_CANONICAL_CONTENT
- Raw artifact parser replay status: PENDING_FULL_PARSER_REPLAY
- Source-artifact-to-parent content proof: PASS
- Parent-to-RRP rebuild: PASS
- RRP rows: 2976
- RRP stale: 0
- RRP missing: 0
- Resolved content join-map hash: 12f3bb76d9fb2862b4072f2def7498fe413f3cc4c036f89fc7956996c806546e

## Blockers

| Blocker | Count |
|---|---:|
| - | 0 |

This receipt validates canonical warehouse content and archived artifact payload hashes. It does not independently replay every raw archived artifact through the frozen parsers, so the raw artifact parser replay remains a separate pending proof. It excludes database UUIDs, build timestamps, generated-at timestamps, local paths, and raw receipt file timestamps from canonical rebuild identities. It does not activate snapshots, compute P&L, or make strategy decisions.

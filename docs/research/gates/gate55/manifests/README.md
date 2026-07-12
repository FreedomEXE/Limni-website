# Gate 55 Manifest Contract

Future research starts from a frozen `ResearchDecisionManifest` JSON document.
The required contract is implemented in
`engine/src/research/decisionManifest.ts`.

Required fields:

- `manifest_id`
- `manifest_version`
- `gate_id`
- `hypothesis_id`
- `signal_id`
- `signal_version`
- `decision_scope`
- `price_bundle_id`
- `feature_bundle_id` where applicable
- `source_context_ids` where applicable
- `universe.asset_class`
- `universe.symbols`
- `week_range.from_week_open_utc`
- `week_range.to_week_open_utc`
- `config_hash`
- `decisions[].week_open_utc`
- `decisions[].symbol`
- `decisions[].side`
- `decisions[].decision_timestamp_utc`
- `decisions[].source_metadata` where applicable
- `manifest_hash`

The evaluator recomputes `manifest_hash` over a stable, sorted JSON shape with
`manifest_hash` excluded from its own hash payload. A supplied hash mismatch is
a hard failure.

Signal derivation remains outside the evaluator. COT, Strength selected/fade,
Strength buckets, regime-filtered decisions, and combined decisions should each
emit a manifest first, then call the shared evaluator.

# Gate 60A Alpha v1 Macro Join-Map Proof

Generated: 2026-06-27T07:09:37.216Z

## Verdict

`PASS_JOIN_MAP_PROOF__FAIL_CLOSED_FULL_FAMILY_SOURCE_ELIGIBILITY`

Gate 60A proves the source-only join map from the frozen Gate 59 Alpha v1 atom ledger to existing macro warehouse source families. It does not build a Regime strategy, emit macro LONG/SHORT decisions, run P&L, test Alpha v1 improvement, change COT, change Strength, change Alpha v1, change macro rows, touch app runtime, start Alpha v2, risk, execution, or MT5/live work.

## Mapping Rule

`gate60a_alpha_week_utc_date_to_macro_week_id_v1`: map each Alpha v1 `week_open_utc` to `macro_week_YYYY-MM-DD` using the UTC date portion of the Alpha week-open timestamp. The proof records the raw Alpha timestamp and the matched macro source timestamp when present; missing source weeks fail closed.

## Denominator Proof

```json
{
  "input_rows": 10444,
  "expected_input_rows": 10444,
  "alpha_weeks": 373,
  "expected_alpha_weeks": 373,
  "expected_symbols_per_week": 28,
  "full_weeks": 373,
  "rows_per_week_histogram": {
    "28": 373
  },
  "non_full_weeks": [],
  "duplicate_input_row_keys": 0,
  "output_join_map_rows": 10444,
  "dropped_rows": 0,
  "duplicate_output_row_keys": 0,
  "output_row_keys_match_input_row_keys": true
}
```

## Coverage Result

- Full-family eligible rows: `0 / 10444`
- Rows fail-closed: `10444 / 10444`
- RRP missing macro weeks: `16`

The RRP lane is the only ACTIVE historical-backtest source family, but the Alpha v1 denominator still has missing mapped RRP weeks. Rate and CPI are SEALED parents, BPR is governance-quarantined by Gate 52A, and valuation remains BUILDING/non-promoted.

## Artifacts

- Join-map JSONL: `docs/research/gates/gate60a/artifacts/gate60a-alpha-v1-macro-join-map/gate60a-alpha-v1-macro-join-map.rows.jsonl`
- Summary Markdown: `docs/research/gates/gate60a/artifacts/gate60a-alpha-v1-macro-join-map/gate60a-alpha-v1-macro-join-map.summary.md`
- Query/probe receipt: `docs/research/gates/gate60a/artifacts/gate60a-alpha-v1-macro-join-map/gate60a-alpha-v1-macro-join-map.query-receipt.md`
- SHA-256 identity: `docs/research/gates/gate60a/artifacts/gate60a-alpha-v1-macro-join-map/gate60a-alpha-v1-macro-join-map.sha256.txt`

## Hashes

```json
{
  "gate59_alpha_ledger_jsonl_sha256": "E4366A2218F91C9F19795BFAC677215F179ED89B68067F2F5B9A81DEAACB0633",
  "join_map_jsonl_sha256": "521B7FA4A975500F5B2FF6223044C536DFE5EE5DF2EF8FC60AA5E247A9459D42",
  "query_receipt_md_sha256": "AA0746B24B0279B22DD745527A051739E969FB2472BFDF8218AAD5E97923F9DF",
  "source_content_invariant_sha256": "C900DF6EB5F4E595A7B284663B10536CDE31958E7026CEFA3C60FBB73DBD65C2",
  "summary_md_sha256": "75AACD3720920A77C1644EF676358FC3FA3D8841E9ECBEE73436712D00E67148"
}
```

## Stop Line

Stop here. Do not proceed to Regime shadow-signal construction, macro side decisions, P&L, attribution, strategy tests, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row changes.

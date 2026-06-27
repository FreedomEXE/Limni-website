# Gate 60A Alpha v1 Macro Join-Map Summary

Generated: 2026-06-27T07:09:37.216Z

## Verdict

`PASS_JOIN_MAP_PROOF__FAIL_CLOSED_FULL_FAMILY_SOURCE_ELIGIBILITY`

Gate 60A built the source-only join map and intentionally stopped before Regime construction.

## Denominator

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

## Source Coverage

| Source | Complete rows | Missing rows | ACTIVE | SEALED | BUILDING | QUARANTINED | Stale | Source ambiguous | Non-ACTIVE | Non-promoted |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| rrp | 9996 | 448 | 9996 | 0 | 0 | 0 | 0 | 0 | 448 | 0 |
| rate_parent | 9996 | 448 | 0 | 9996 | 0 | 0 | 0 | 0 | 10444 | 0 |
| cpi_parent | 9996 | 448 | 0 | 9996 | 0 | 0 | 0 | 0 | 10444 | 0 |
| bpr | 9996 | 448 | 0 | 0 | 0 | 10444 | 0 | 10444 | 10444 | 0 |
| valuation | 0 | 10444 | 0 | 0 | 10444 | 0 | 0 | 0 | 10444 | 10444 |

## Top Fail-Closed Reasons

| Reason | Rows |
|---|---:|
| bpr_not_active | 10444 |
| bpr_quarantined | 10444 |
| bpr_source_ambiguous | 10444 |
| cpi_parent_not_active | 10444 |
| cpi_parent_sealed_parent_only_not_standalone_active | 10444 |
| rate_parent_not_active | 10444 |
| rate_parent_sealed_parent_only_not_standalone_active | 10444 |
| valuation_missing_base_currency_row | 10444 |
| valuation_missing_manifest | 10444 |
| valuation_missing_quote_currency_row | 10444 |
| valuation_non_promoted | 10444 |
| valuation_not_active | 10444 |
| valuation_value_unavailable | 10444 |
| bpr_value_unavailable | 10440 |
| bpr_untrusted_for_freeze | 9992 |
| bpr_manifest_not_sealed | 448 |
| bpr_missing_base_currency_row | 448 |
| bpr_missing_manifest | 448 |
| bpr_missing_quote_currency_row | 448 |
| cpi_parent_manifest_not_sealed | 448 |

## Artifact Hashes

```json
{
  "gate59_alpha_ledger_jsonl_sha256": "E4366A2218F91C9F19795BFAC677215F179ED89B68067F2F5B9A81DEAACB0633",
  "join_map_jsonl_sha256": "521B7FA4A975500F5B2FF6223044C536DFE5EE5DF2EF8FC60AA5E247A9459D42",
  "query_receipt_md_sha256": "AA0746B24B0279B22DD745527A051739E969FB2472BFDF8218AAD5E97923F9DF",
  "source_content_invariant_sha256": "C900DF6EB5F4E595A7B284663B10536CDE31958E7026CEFA3C60FBB73DBD65C2"
}
```

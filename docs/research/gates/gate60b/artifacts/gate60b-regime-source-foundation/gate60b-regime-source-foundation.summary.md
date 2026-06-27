# Gate 60B Regime Source Foundation Summary

Generated: 2026-06-27T08:00:38.413Z

## Verdict

`PASS_RRP_ALPHA_WEEK_SHADOW_REBUILD_FULL_COVERAGE__FULL_FAMILY_STILL_BLOCKED`

## Denominator

```json
{
  "input_rows": 10444,
  "expected_input_rows": 10444,
  "alpha_weeks": 373,
  "expected_alpha_weeks": 373,
  "expected_symbols_per_week": 28,
  "rows_per_week_histogram": {
    "28": 373
  },
  "full_weeks": 373,
  "non_full_weeks": [],
  "duplicate_input_row_keys": 0,
  "output_join_map_rows": 10444,
  "dropped_rows": 0,
  "duplicate_output_row_keys": 0,
  "output_row_keys_match_input_row_keys": true
}
```

## Source-Family Coverage

| Source | Registry state | Mapped rows | Missing rows | ACTIVE feature rows |
|---|---:|---:|---:|---:|
| rrp_shadow | BUILDING_SHADOW | 10444 | 0 | 0 |
| rate_parent | SEALED_PARENT | 10444 | 0 | 0 |
| cpi_parent | SEALED_PARENT | 10444 | 0 | 0 |
| bpr | QUARANTINED | 0 | 10444 | 0 |
| valuation | BUILDING_SHADOW | 0 | 10444 | 0 |

## Hashes

```json
{
  "gate59_alpha_ledger_jsonl_sha256": "E4366A2218F91C9F19795BFAC677215F179ED89B68067F2F5B9A81DEAACB0633",
  "source_registry_hash": "9EC1D0877E03A4CAD753015E4A3F2E944F22E6A73F1E6FF008B7786C99D583D8",
  "source_content_invariant_hash": "E40E207E27FB3461C66DCE07F30601010DB4CA01AC342AE3EA1530EA91695458",
  "source_rows_jsonl_sha256": "FA6F98660B554E679D174AE3709589CB4E6FB12949387779082CDC39622DCC2B",
  "join_map_hash": "AB85E93DCC62CC900ED48751ACD627DDBC142BB695DD92130BF2E566BE308554",
  "summary_json_sha256": "2D30D75CCF4D937FAB6218FFF2BADD9B1419ECB1642E362109D5EB591B2037B6"
}
```

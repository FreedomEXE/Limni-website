# Gate 60B Regime Source Foundation

Generated: 2026-06-27T09:26:14.834Z

## Verdict

`PASS_RRP_ALPHA_WEEK_SHADOW_REBUILD_FULL_COVERAGE__FULL_FAMILY_STILL_BLOCKED`

Gate 60B builds a versioned, source-only Regime source registry and a non-mutating Alpha-week shadow rebuild against the frozen Gate 59 Alpha v1 atom ledger. It does not build a Regime LONG/SHORT side, run P&L, attribution, Alpha v2, risk, execution, MT5/live, or app work.

## Source Registry Contract

Registry version: `gate60b_regime_source_registry_v1`

The registry separates raw source existence from promotion eligibility:

- RRP is an existing ACTIVE feature on the older macro week identity; Gate 60B rebuilds a source-only Alpha-week shadow from sealed rate/CPI parents.
- Rate and CPI remain SEALED parents, not standalone ACTIVE feature bundles.
- BPR remains quarantined under Gate 52A until exact publication timing or an explicitly versioned clean-window source contract exists.
- Valuation remains PPP/NEER/REER raw/source-only until source promotion and valuation-gap formula are separately versioned.

## Alpha Week Rebuild Result

- Alpha rows: `10,444`
- Alpha weeks: `373`
- Expected unique symbols per week: `28`
- RRP shadow mapped rows: `10444 / 10444`
- Full-family source eligible rows: `0 / 10444`

RRP shadow coverage is not a promoted Regime side. It only proves that the rate/CPI source foundation can be projected onto the Gate 59 Alpha v1 week identity without neutralizing, imputing, or skipping pair rows. Parent observations are selected by the existing latest-eligible source contracts, not by filling missing Gate 60A rows.

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
  "summary_json_sha256": "BC105454AF2552B0667DB82BDF3BB64BF394352CB322CF2AB0D14FAFA1314627"
}
```

## Stop Line

Stop here. Do not proceed to Regime shadow-signal construction, macro LONG/SHORT decisions, P&L, attribution, strategy tests, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row mutation.

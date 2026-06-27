# Gate 60C Regime Source Atom Fill

Generated: 2026-06-27T09:29:11.661Z

## Verdict

`PASS_SOURCE_ATOM_FILL_WITH_EXPLICIT_FAIL_CLOSED_ROWS__NO_REGIME_SIDE`

Gate 60C fills source atoms against the frozen Gate 59 Alpha v1 denominator. It emits no Regime side, no macro LONG/SHORT decisions, no support/oppose/fade labels, no P&L, no attribution matrix, no Alpha v2, and no risk/execution/MT5/live/app work.

## Contract

Source registry version: `gate60c_regime_source_registry_v2`

- Rate and CPI are SEALED parent atoms.
- RRP is a derived atom from rate and CPI only; it is not promoted as the Regime parent.
- BPR futures and futures/options atoms remain QUARANTINED under Gate 52A.
- PPP, NEER, and REER are BUILDING raw/source-only valuation atoms.
- Valuation-gap is not emitted because no valuation-gap formula is versioned.

## Denominator

```json
{
  "input_rows": 10444,
  "expected_input_rows": 10444,
  "alpha_weeks": 373,
  "expected_alpha_weeks": 373,
  "expected_symbols_per_week": 28,
  "symbols_per_week_histogram": {
    "28": 373
  },
  "raw_rows_per_week_histogram": {
    "28": 373
  },
  "full_weeks": 373,
  "duplicate_input_row_keys": 0,
  "duplicate_input_week_symbol_rows": 0,
  "output_pair_join_rows": 10444,
  "dropped_pair_rows": 0,
  "duplicate_output_pair_row_keys": 0,
  "currency_week_atom_rows": 23872,
  "expected_currency_week_atom_rows": 23872,
  "duplicate_currency_atom_row_keys": 0
}
```

## Atom Fill Result

| Atom | State | Rows | Filled | Fail-closed | Missing | Stale | Quarantined | Source ambiguous |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| nominal_rate_3m | SEALED | 2984 | 2984 | 0 | 0 | 0 | 0 | 0 |
| cpi_inflation_yoy | SEALED | 2984 | 2984 | 0 | 0 | 0 | 0 | 0 |
| rrp_derived | BUILDING | 2984 | 2984 | 0 | 0 | 0 | 0 | 0 |
| bpr_futures | QUARANTINED | 2984 | 0 | 2984 | 0 | 0 | 2984 | 2984 |
| bpr_futures_and_options | QUARANTINED | 2984 | 0 | 2984 | 0 | 0 | 2984 | 2984 |
| ppp | BUILDING | 2984 | 2984 | 0 | 0 | 0 | 0 | 0 |
| neer | BUILDING | 2984 | 2984 | 0 | 0 | 0 | 0 | 0 |
| reer | BUILDING | 2984 | 2984 | 0 | 0 | 0 | 0 | 0 |

## Hashes

```json
{
  "gate59_alpha_ledger_jsonl_sha256": "E4366A2218F91C9F19795BFAC677215F179ED89B68067F2F5B9A81DEAACB0633",
  "source_registry_hash": "DADCE5C3036B676236EF8B1B2DB9E64928DF5C087F016553433BB419452ABB08",
  "currency_week_atom_ledger_hash": "603C225C4919C7D4F3BC38BBD25C2CB5D24A83938142632CF2D16A8046150F27",
  "pair_week_atom_join_ledger_hash": "167C13FA309FFE74A7C074DFEE4FA97A3AEFBBFDFEF73EDD13A5287925EC6DBD",
  "source_artifact_hash_map_hash": "22A82BA75C6FAFE3B7AB579878B54C7458D6A71D3A1EEC9FF7616218C49296AB",
  "raw_observation_hash_map_hash": "928FE19EA51C7A58A12EC30FBBBFBFE775E55E4164BFBCFF39805E5322272F4D",
  "availability_event_hash_map_hash": "7F4D4FC7B555BC984D724FC8182F03E0FE5BC5381CCC19252E2A48E33FCF6B55",
  "parent_derived_lineage_map_hash": "2AE483C5811874800381C1DF246BCB3B19E6BA37FF71222593A7A94E5EBEF9F4",
  "availability_report_hash": "DAEB0CA0820AD7F965DCBB65FF8E1C475EFBA4DCEA933DCDF2EDE50F34F2179F",
  "source_content_invariant_hash": "82EA24665706EEB6D13773E59EF68411924588F8730732B529F55D12B092FA57"
}
```

## Stop Line

Stop here. Do not proceed to RRP promotion, Regime shadow-signal construction, macro LONG/SHORT decisions, support/oppose/fade labels, P&L, attribution, strategy tests, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row mutation.

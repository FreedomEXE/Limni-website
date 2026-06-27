# Gate 60D BPR Source Eligibility

Generated: 2026-06-27T12:49:37.860Z

## Verdict

`FAIL_CLOSED_BPR_SOURCE_ELIGIBILITY_UNRESOLVED_ROWS_REMAIN__NO_REGIME_SIDE`

Gate 60D is BPR-only. It resolves publication timing, availability evidence, source hashes, and point-in-time eligibility against the frozen Gate 59 Alpha v1 denominator. It emits no Regime transform, no matrix, no macro LONG/SHORT side, no support/oppose/fade labels, no P&L, no attribution, no Alpha v2, and no risk/execution/MT5/live/app work.

## Contract

BPR source registry version: `gate60d_bpr_source_registry_v2`

- BPR rows are source-only eligibility evidence.
- Every Gate 59 Alpha week/currency/BPR contract is emitted in the currency-week atom ledger.
- The latest BPR report available at or before the Alpha week open is the only candidate for that row.
- If that latest available report is inferred, approximate, non-filterable, promotion-blocked, missing evidence, stale, or unhashable, the row fails closed.
- Older clean BPR rows are not carried across a newer unresolved BPR report.
- No neutral fill, forward fill, imputation, row skipping, source mutation, Regime side, or matrix is performed.

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
  "bpr_currency_week_atom_rows": 5968,
  "expected_bpr_currency_week_atom_rows": 5968,
  "dropped_bpr_currency_week_atom_rows": 0,
  "duplicate_bpr_currency_week_atom_row_keys": 0,
  "bpr_publication_timing_rows": 1472,
  "duplicate_bpr_publication_timing_row_keys": 0
}
```

## BPR Result

| Atom | Rows | Filled | Fail-closed | Fail-closed week count | First fail-closed | Last fail-closed | Sample |
|---|---:|---:|---:|---:|---|---|---|
| bpr_futures | 2984 | 1805 | 1179 | 373 | 2019-04-14T23:00:00.000Z | 2026-05-31T23:00:00.000Z | 2019-04-14T23:00:00.000Z, 2019-04-21T23:00:00.000Z, 2019-04-28T23:00:00.000Z, 2019-05-05T23:00:00.000Z, 2019-05-12T23:00:00.000Z, 2019-05-19T23:00:00.000Z, 2019-05-26T23:00:00.000Z, 2019-06-02T23:00:00.000Z |
| bpr_futures_and_options | 2984 | 194 | 2790 | 373 | 2019-04-14T23:00:00.000Z | 2026-05-31T23:00:00.000Z | 2019-04-14T23:00:00.000Z, 2019-04-21T23:00:00.000Z, 2019-04-28T23:00:00.000Z, 2019-05-05T23:00:00.000Z, 2019-05-12T23:00:00.000Z, 2019-05-19T23:00:00.000Z, 2019-05-26T23:00:00.000Z, 2019-06-02T23:00:00.000Z |

## Fail-Closed Reasons

```json
{
  "invalid_availability_confidence:official_not_before_conservative": 96,
  "invalid_availability_precision:inferred": 96,
  "invalid_eligibility_policy:first_freeze_strictly_after_date": 96,
  "invalid_retrieval_capability:capture_before_freeze_required": 96,
  "latest_vintage_research_approximation": 96,
  "missing_numeric_value:netShareOfGross": 3941,
  "observation_invalid_availability_confidence:official_not_before_conservative": 96,
  "observation_invalid_availability_precision:inferred": 96,
  "observation_invalid_eligibility_policy:first_freeze_strictly_after_date": 96,
  "observation_invalid_retrieval_capability:capture_before_freeze_required": 96,
  "promotion_blocked_until_exact_publication_date": 96,
  "promotion_blocked_until_point_in_time_availability": 96
}
```

## Hashes

```json
{
  "gate59_alpha_ledger_jsonl_sha256": "E4366A2218F91C9F19795BFAC677215F179ED89B68067F2F5B9A81DEAACB0633",
  "bpr_source_registry_hash": "9226D3707F3EE4AA4B64587FCE3A68CD8A659F912C0C4C1116E59FA27D7F62AF",
  "bpr_publication_timing_proof_hash": "BCE679D41E8A629BC0146E3C049FBD48F3F0D75BD42DBD7A73A78322EB4AA35A",
  "bpr_raw_artifact_hash_map_hash": "0343A9B547B4803426D4A241028D8F362562E54DEC56FE0E1B1AEAE18C13B038",
  "bpr_raw_observation_hash_map_hash": "F2F49FADE91B0EAAE5BD36B644188F18C594E7261D74E16BBF9BAD9E5F4BE728",
  "bpr_availability_event_hash_map_hash": "F31674BDB190A9187D44CD007551DD78EC86CEA833F86A41D2ACBDD3E75108E1",
  "bpr_currency_week_atom_ledger_hash": "7B1B809CCA1CBB6B60A1E1AFECB44A4F1B4E308244DB4F37611CFD46CD55DCC7",
  "bpr_fail_closed_quarantine_report_hash": "1D6401C5B7573221DC694A848F639AEADEE0770568D9C84BC97D264A9FD7C488",
  "bpr_unresolved_rows_hash": "3EB3D6C671CE93263AA3E28A860DF3185970CF15877C045F3815DB60E28BF354",
  "bpr_source_content_invariant_hash": "20F5A88FCA8B5901FC879C076E3DF21872E9126D87C1BD5419709A5203DE5894"
}
```

## Stop Line

Stop here. Do not proceed to Regime atom transforms, broad matrix, Regime LONG/SHORT side, support/oppose/fade labels, P&L, attribution, Alpha v2, risk, execution, MT5/live, app/runtime work, COT changes, Strength changes, Alpha v1 changes, Gate 59 row changes, or macro source row mutation.

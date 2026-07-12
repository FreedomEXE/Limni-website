# Gate 60F BPR Carry Source-Policy Summary

Generated: `2026-06-27T15:46:44.029Z`

Verdict: `PASS_BPR_FUTURES_CARRY_POLICY_SOURCE_ONLY_COMPARISON__NO_REGIME_SIDE`

## Denominator

- Gate 59 rows: `10444`
- Gate 59 weeks: `373`
- BPR futures policy rows per candidate: `2984`
- BPR futures/options shadow rows: `2984`

## Row-Count Comparison

| Policy | Raw present | Alias impact | Carried true absence | Stale carried | Still fail-closed | Timing-blocked | F/O shadow |
|---|---:|---:|---:|---:|---:|---:|---:|
| no_carry_fail_closed | 1805 | 5 | 0 | 0 | 1179 | 32 | 2984 |
| carry_last_valid_clean_futures_45d | 1805 | 5 | 131 | 0 | 1048 | 32 | 2984 |
| carry_last_valid_clean_futures_until_next_clean_report_stale_after_45d | 1805 | 5 | 422 | 291 | 757 | 32 | 2984 |

## Hashes

- Source policy contract hash: `3EDA36DB393C8924BA84BD57C1080BA647B6FF4F8FC633CD406B88917CFC2BC6`
- Carry comparison hash: `D7F9D23C6B8452DD7ACC5907CE54D11E267B2448DD73EF19F920FF63104C2E40`
- Derived carried-state ledger hash: `DAC419527F56BF1CB033DE1FDB4DC1A22185491359300E3E7C3E0C803402501B`
- Source content invariant hash: `C64ACACA2BBAD498474BDA92FF4DB0838751CE6FC66CD5EB8968605BF70D0862`

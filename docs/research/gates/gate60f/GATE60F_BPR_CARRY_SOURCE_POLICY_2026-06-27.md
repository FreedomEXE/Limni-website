# Gate 60F BPR Carry Source-Policy

Generated: `2026-06-27T15:46:44.029Z`

Verdict: `PASS_BPR_FUTURES_CARRY_POLICY_SOURCE_ONLY_COMPARISON__NO_REGIME_SIDE`

Gate 60F is BPR-only and source-policy-only. It evaluates candidate source-state policies for truly absent BPR futures rows using Gate 60E artifacts and the frozen Gate 59 Alpha denominator. It emits no Regime transform, no broad matrix, no Regime LONG/SHORT side, no support/oppose/fade labels, no P&L, no attribution, no Alpha v2, and no risk/execution/MT5/live/app work.

## Locked Source Direction

- Required BPR v1 candidate: `bpr_futures`.
- Derived candidate: `bpr_futures_carried_state`.
- Shadow / diagnostic only: `bpr_futures_and_options`.
- Do not mix BPR futures and BPR futures/options.
- Do not use one BPR contract to fill the other.
- Do not average the contracts or create a combined BPR atom for Regime v1.

## Denominator

- Gate 59 rows: `10444`
- Gate 59 weeks: `373`
- Symbols per week histogram: `{"28":373}`
- BPR futures required rows: `2984`
- BPR futures/options shadow rows: `2984`

## Row-Count-Only Policy Comparison

| Policy | Raw present rows | Repaired alias rows | True absence rows carried | Stale carried rows | Still fail-closed rows | Timing-blocked rows | Futures/options shadow rows |
|---|---:|---:|---:|---:|---:|---:|---:|
| `no_carry_fail_closed` | `1805` | `5` | `0` | `0` | `1179` | `32` | `2984` |
| `carry_last_valid_clean_futures_45d` | `1805` | `5` | `131` | `0` | `1048` | `32` | `2984` |
| `carry_last_valid_clean_futures_until_next_clean_report_stale_after_45d` | `1805` | `5` | `422` | `291` | `757` | `32` | `2984` |

## Interpretation

The NZD alias policy has candidate impact only and does not mutate the Gate 60E source rows. Carry-forward is evaluated only within `cftc_bpr_futures`, same currency, same source contract. Timing-blocked late-2025 rows remain fail-closed and reset the carry chain so no derived state crosses an ambiguous report.

## Hashes

- Source policy contract hash: `3EDA36DB393C8924BA84BD57C1080BA647B6FF4F8FC633CD406B88917CFC2BC6`
- NZD alias impact hash: `68870ECE64F0E0A2F0A34DB3F55CA03667443D8FAF9307E51A1D485386AF93B6`
- Carry comparison hash: `D7F9D23C6B8452DD7ACC5907CE54D11E267B2448DD73EF19F920FF63104C2E40`
- Derived carried-state ledger hash: `DAC419527F56BF1CB033DE1FDB4DC1A22185491359300E3E7C3E0C803402501B`
- Fail-closed source-policy ledger hash: `2D4621EA10418DB6FA841B00C1F4D691259A1303DAB87E6A1F41B690EE1AA4E5`
- Source policy content invariant hash: `C64ACACA2BBAD498474BDA92FF4DB0838751CE6FC66CD5EB8968605BF70D0862`

## Stop

Stop here. Do not proceed to BPR promotion, Regime transforms, broad matrix, Regime side construction, Alpha v2, risk, execution, MT5/live, app work, or source mutation.

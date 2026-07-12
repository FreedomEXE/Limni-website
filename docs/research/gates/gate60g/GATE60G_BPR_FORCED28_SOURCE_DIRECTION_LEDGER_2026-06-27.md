# Gate 60G BPR Forced-28 Source-Direction Ledger

Generated: `2026-06-27T16:45:24.732Z`

Verdict: `PASS_BPR_FORCED28_SOURCE_DIRECTION_LEDGER__DEGRADED_FLAGS_SEPARATE__NO_REGIME_SIDE`

Gate 60G is BPR-only and source-direction-only. It builds a forced-28 BPR pair-direction ledger against the frozen Gate 59 Alpha v1 denominator while keeping source quality and promotion eligibility separate from direction. It emits no Regime transform, no broad matrix, no Regime LONG/SHORT side, no support/oppose/fade labels, no P&L, no attribution, no Alpha v2, and no risk/execution/MT5/live/app work.

## Source Direction Contract

- Required BPR v1 source: `bpr_futures`.
- Shadow-only source: `bpr_futures_and_options`.
- Derived carried atom: `bpr_futures_carried_state`.
- Derived synthetic USD atom: `bpr_futures_synthetic_usd_state`.
- Synthetic USD formula: inverse average of available non-USD BPR futures states for the same Alpha week.
- Pair rows carry `BASE_CURRENCY` / `QUOTE_CURRENCY` source direction only; they do not encode LONG/SHORT or Regime side.
- No futures/options row is used to fill a futures row.

## Denominator

- Gate 59 rows: `10444`
- Gate 59 weeks: `373`
- BPR currency-state rows: `2984`
- BPR pair-direction rows: `10444`
- Duplicate pair-direction row keys: `0`
- Neutral pair-direction rows: `0`

## Quality Summary

- Currency-state quality counts: `{"unresolved_no_prior":375,"raw_present":1805,"synthetic_usd":370,"carried_fresh":131,"carried_stale":291,"unresolved_source_ambiguous":5,"timing_blocked_carry":7}`
- Pair direction rule counts: `{"deterministic_unresolved_currency_rank_fallback":259,"single_numeric_state_degraded":2142,"numeric_value_comparison":8043}`
- Pair source-direction eligible rows: `8043`
- Promotion eligible pair-direction rows: `5113`
- Promotion ineligible pair-direction rows: `5331`

## Interpretation

The ledger forces every Alpha pair-week to a non-neutral BPR source direction, but degraded rows are not hidden. Early no-prior BPR futures absences, stale carries, timing-blocked carries, and partial synthetic USD component coverage are explicit promotion-ineligibility reasons. This keeps forced-28 shape parity without silently promoting weak source states.

## Hashes

- Currency-state ledger hash: `44AC1DBC4B9DC662004B9273017E44B27FB77B98F30504606A19A9409DA42067`
- Synthetic USD ledger hash: `6420A21421253C65D206E19B117C314A5B54F62AC8CF58949BDDBF11DEAA41DA`
- Pair-direction ledger hash: `15FCBCD62973A889423A328D5C32D72965EAC584034EE202070B636881CB7939`
- Degraded-state report hash: `90F9433DC38FED7A6E47D6D63F2D986A31BD69D8184E6659D8ED3CDB9E9CCD3A`
- Source-direction content invariant hash: `D9225E11FA9E4FC6C740AB6A69D036AE966ECAA608A5FA29425275797688FD58`

## Stop

Stop here. Do not proceed to BPR promotion, Regime transforms, broad matrix, Regime side construction, Alpha v2, risk, execution, MT5/live, app work, or source mutation.

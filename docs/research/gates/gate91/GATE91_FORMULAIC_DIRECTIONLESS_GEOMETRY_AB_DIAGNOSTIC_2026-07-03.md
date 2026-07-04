# Gate 91 Formulaic Directionless Geometry A/B Diagnostic

Generated: 2026-07-03

## Verdict

`PASS_SCAFFOLD_AND_BOUNDED_EVIDENCE__FAIL_STANDALONE_FORMULAIC_DIRECTIONLESS_GEOMETRY_NOT_READY`

Gate 91 now has a formulaic, directionless Triangle geometry scaffold behind
`triangle_formulaic_directionless_geometry`.

The first equation is mechanically valid and harvests movement, but it is not
durable enough as a standalone algorithm. It was strongly positive in the 2019
problem window, then costed account return stayed red in the 2026 recent window
even though ADR movement stayed positive. The next Gate 91 step should refine
the geometry/churn contract, not add Candidate B or David direction back yet.

## Implemented Scaffold

- Activation id: `triangle_formulaic_directionless_geometry`.
- Direction policy: symmetric long/short, no Candidate B, no David side filter.
- Grid quantum:

```text
Q = max(R / (2 + 2 * (1 - PE)), C)
```

Where:

- `R` = completed session range in ADR units.
- `PE` = current path efficiency before the start bar.
- `C` = `0.05 ADR` structural cost floor.
- Too-clean trend reject: `PE > 0.35`.
- Range sanity: completed range must be at least `2Q`.
- Signal event brick receipt: `Q / 4`, emitted as `cycle_signal_adr_brick`.
- Target: completed session midpoint via `session_mid_reversion`.
- Risk A/B: `baseline` versus `pain_1q_stop_adds_before_profit_0_5q`.
- Daily flatten: preserved.

The runner also now emits raw market-percent movement columns beside ADR units,
including `price_pnl_market_pct`, `close_event_total_realized_market_pct`, and
raw market-percent MFE/MAE aggregates.

## Evidence

| Window | Protection | ADR units | Raw market % | Fixed-lot account % | PF | Win % | Entries | Max open | Max depth | Max DD % | Target net | Flatten net |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| AUDCHF 2019 1w smoke | baseline | 2.283964 | 1.622913 | 0.1001 | 2.471515 | 75.00 | 26 | 6 | 5 | 0.00 | 15.96 | -5.95 |
| AUDCHF 2019 1w smoke | pain stop-add | 2.717224 | 1.930774 | 0.1272 | 4.104607 | 75.00 | 17 | 5 | 4 | 0.00 | 15.96 | -3.24 |
| 2019 all pairs open | baseline | 703.761268 | 496.537025 | 27.9885 | 1.107479 | 75.67 | 32859 | 274 | 40 | -16.6554 | 22073.55 | -19274.69 |
| 2019 all pairs open | pain stop-add | 313.917648 | 203.210786 | 6.9786 | 1.043660 | 71.65 | 19891 | 114 | 24 | -12.3136 | 13395.61 | -12697.75 |
| 2026 all pairs open | baseline | 117.366185 | 96.258846 | -6.7906 | 0.961920 | 75.86 | 21822 | 245 | 43 | -19.5642 | 12507.97 | -13187.03 |
| 2026 all pairs open | pain stop-add | 65.055410 | 56.859643 | -4.8150 | 0.953213 | 71.78 | 13072 | 179 | 43 | -11.4058 | 8054.61 | -8536.11 |

## Read

- The equation has real movement harvest. ADR units are positive in both 2019
  and 2026.
- The standalone directionless shape is not deployable. In 2026, costs plus
  session-flatten losses overwhelm the raw movement harvest.
- Pain stop-add remains useful as a risk/churn reducer, but it is not a magic
  fix for this formula. It reduces entries and max open exposure, but it also
  cuts harvest materially.
- The 2019 baseline is too hot: `274` max open and `40` max depth are not a
  clean live shape even with strong account return.
- The 2026 baseline proves the main flaw: positive ADR movement does not imply
  positive fixed-lot account return when churn and flatten losses are too large.

## Artifacts

- Smoke report: `docs/research/gates/gate91/artifacts/gate91-formulaic-smoke-audchf-2019-1w/GATE91_FORMULAIC_SMOKE_AUDCHF_2019_1W.md`
- Smoke close events with Q/brick/target receipts: `docs/research/gates/gate91/artifacts/gate91-formulaic-smoke-audchf-2019-1w/close-events.rows.csv`
- 2019 A/B report: `docs/research/gates/gate91/artifacts/gate91-formulaic-ab-2019-open/GATE91_FORMULAIC_AB_2019_OPEN.md`
- 2026 A/B report: `docs/research/gates/gate91/artifacts/gate91-formulaic-ab-2026-open/GATE91_FORMULAIC_AB_2026_OPEN.md`
- Validation: all three runs have `0` failed validation rows.

## Next Gate 91 Work

Do not add Candidate B or David direction yet. The next bounded pass should
diagnose why directionless positive ADR becomes negative costed account return
in 2026:

- Split session-flatten losers by `Q`, `PE`, completed range, and side distance
  from midpoint.
- Add a formulaic churn reject or wider-Q rule when expected midpoint harvest
  is too small after cost floor and flatten risk.
- Keep daily flatten and pain-first stop-add as the risk baseline.
- Keep reporting ADR units, raw market-percent movement, and fixed-lot account
  return separately.

## Stop Line

Research only. No MT5/live/app work, no promotion, no red-news implementation,
no 2020/year-by-year expansion, no full matrix restart, no full seven-pair
handshake gate, and no Candidate B direction dependency in this first Gate 91
pass.

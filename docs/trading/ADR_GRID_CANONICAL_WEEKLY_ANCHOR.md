# ADR Grid Canonical Weekly Anchor

Status: active canon, source-readiness caveat

Source-readiness caveat: the ADR Grid weekly-anchor rule remains active, but
the 19-week evidence window below is not fully source-trusted as of
2026-06-05. The pinned `v2.0.3` source-readiness audit still fails Jan/Feb
sentiment and strength rows. Do not regenerate v33 canon or call the full
19-week baseline trusted until those source gaps are repaired and the serial
`npm run source:completion:release` gate reports all 76 rows trusted. Changing
to a shorter release baseline is not allowed unless Freedom explicitly reverses
the 19-week decision.

## Rule

ADR Grid systems must anchor their grid map to the canonical market weekly open.

Execution timing is only a fill eligibility window. It must not move the grid map.

## Required Behavior

- Grid anchor: canonical market weekly open price.
- Fill window: execution window for the asset class.
- First tradable levels: +/- 0.20 ADR from the canonical weekly open.
- Centerline: the weekly-open level is not tradable.
- TP: next 0.20 ADR grid step.
- Basket reset: existing 1.0 ADR cycle reset rule.
- Pair Fill Cap: unchanged; default professional risk setting remains Pair Fill Cap ON.
- ADR return display: normalized return remains the app display basis.

## Implementation Notes

- App ADR Grid templates must use `getCanonicalWeeklyPairReturns()` for the grid anchor price.
- Execution-window returns remain valid for live/current-week fallback behavior.
- Historical and current-week execution windows remain unchanged.
- TradingView verifier grid levels must use the captured weekly open, while grid processing remains gated by execution time.
- ADR Grid supports both Pair Fill Cap and None. Pair Fill Cap remains the default, but No Cap is a valid comparison mode and must stay visible.
- `adr_grid + none` must serialize as `f2=none`; omitting `f2` means the default capped grid.
- Every visible Strategy x Execution x Risk Overlay selection must have a ready artifact before release. Missing artifacts are a data readiness problem, not a reason to remove a valid selector mode.
- DST Sunday-open week keys such as `2026-05-24T23:00:00.000Z` should display as the Monday trading week, for example May 25 2026.

## Evidence

Research: [ADR Grid Weekly Anchor A/B](../research/ADR_GRID_WEEKLY_ANCHOR_AB_2026-06-02.md)

Final selected configuration:

| Strategy | Cap Mode | Return | Path DD | Return/DD | Trades |
|---|---|---:|---:|---:|---:|
| Tandem | Pair Fill Cap ON | +877.42% | 5.82% | 150.77 | 32,710 |
| Tandem | No Pair Fill Cap | +942.20% | 24.68% | 38.18 | 44,996 |
| Tiered | Pair Fill Cap ON | +154.68% | 2.16% | 71.45 | 4,738 |
| Tiered | No Pair Fill Cap | +172.63% | 5.24% | 32.97 | 6,088 |

Test window: 19 realized weeks, 2026-01-19 through 2026-05-24.

Source-readiness status: the full 19-week window is blocked by untrusted
historical source rows. The clean March-through-May subset
(`v2.0.3-trusted-12w`, 2026-03-08 through 2026-05-24) is useful evidence, but
it is not the same as approving the active 19-week app/reporting baseline.

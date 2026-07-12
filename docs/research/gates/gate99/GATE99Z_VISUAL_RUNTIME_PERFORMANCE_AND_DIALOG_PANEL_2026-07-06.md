# Gate 99Z - Visual Runtime Performance And Dialog Panel

Date: 2026-07-06

## Scope

This follow-up fixes the State Map / Stochastic runtime issue observed on live
MT5 charts:

```text
StateMap indicator is too slow, >2000 ms
Stochastic indicator is too slow, >2000 ms
panel and lines visually jump/glitch under GUI-thread load
```

Implemented only:

```text
StateMap runtime projection cleanup
Stochastic runtime projection cleanup
shared LRMG chart-projection helpers
StateMap CAppDialog/CPanel/CLabel movable panel
repo and active-terminal compile/source proof
```

Not implemented:

```text
q-state formula or threshold change
q-state persistence / hysteresis
EA strategy behavior change
Katarakti calculation or visual redesign
live-trading enablement
MT5 performance backtest claim
```

## Runtime Fix

`LimniLRMGStackCore.mqh` now exposes lightweight chart helpers:

```text
LimniChartTimeRangeFast
LimniChangedBarLimit
LimniRecentChartIndex
LimniSourceIndexAtOrBefore
LimniProjectDoubleToChartLimit
```

`StateMap.mq5` and `Stochastic.mq5` now keep indicator-local LRMG source arrays
instead of requesting/exporting the shared stack on every calculation. Normal
tick updates project only the changed bar window from `prev_calculated`.

The all-history LRMG bootstrap remains intentional. This pass removes repeated
full-history chart projection and repeated full-array export on unchanged
ticks; it does not claim a terminal-wide cross-chart cache. If many charts still
collide on the same closed-M1 source refresh, the next architecture step is a
shared terminal-wide/incremental LRMG source service, not q-state tuning.

## Panel Fix

`StateMap.mq5` now renders the panel through standard MQL5 controls:

```text
CAppDialog
CPanel
CLabel
```

The panel is movable and uses a fixed institutional layout:

```text
LIMNI STATE MAP title
large dynamic direction block
reason line
two aligned stat columns
Segoe UI typography
muted dividers
```

Displayed stats remain:

```text
M1 as-of time
reason
score
confidence
trend
stochastic
anchor
bars / q-days
```

The live update path is signature-gated. Labels and panel colors update only
when displayed values change. The active indicator files no longer contain raw
`ObjectCreate` panel construction or full-chart projection calls.

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99z-visual-runtime-performance-2026-07-06/
```

Compile logs:

```text
repo-StateMap-compile-log.txt
active-StateMap-compile-log.txt
repo-Stochastic-compile-log.txt
active-Stochastic-compile-log.txt
compile-results.txt
```

All four compiles report:

```text
Result: 0 errors, 0 warnings
```

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal hashes match for:

```text
StateMap.mq5
Stochastic.mq5
LimniLRMGStackCore.mqh
```

## Review Notes

Review should focus on:

```text
1. whether the per-indicator cache is sufficient for current chart usage;
2. whether closed-M1 refresh should become a terminal-wide/incremental service;
3. whether the StateMap CAppDialog panel behaves well across chart sizes;
4. confirming no q-state semantics changed.
```

Katarakti remains excluded from State Map and parked for later review.

## Verdict

```text
PASS_GATE99Z_VISUAL_RUNTIME_PERFORMANCE_DIALOG_PANEL_COMPILES_NO_QSTATE_SEMANTIC_CHANGE_NO_BACKTEST_CLAIM
```

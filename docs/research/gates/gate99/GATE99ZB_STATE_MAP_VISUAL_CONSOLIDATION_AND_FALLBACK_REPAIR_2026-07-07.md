# Gate 99ZB - State Map Visual Consolidation And Fallback Repair

Date: 2026-07-07

## Scope

Gate 99ZB is a corrective visual pass after the Gate 99ZA push failed the
manual chart check:

```text
center line not visible
stochastic not visible
StateMap panel unreadable / overlapping
```

Implemented only:

```text
single-indicator visual review path through StateMap
StateMap show/hide inputs for center line and stochastic visual
service-first stack read with missing/stale snapshot visual fallback
readable fixed StateMap panel rows
legacy Stochastic fallback so an already-attached pane does not stay blank
repo and active-terminal compile/source proof
```

Not implemented:

```text
EA behavior change
q-state semantic change
q-state threshold / persistence / hysteresis tuning
Katarakti redesign
live-trading enablement
MT5 performance backtest
promotion or live-readiness claim
```

## Visual Consolidation

`StateMap.mq5` is now the intended Gate 99ZB visual review surface.

New inputs:

```text
ShowCenterLine=true
ShowStochasticVisual=true
StochasticVisualBars=120
```

The center line remains the existing shared LRMG anchor/state overlay. Setting
`ShowCenterLine=false` blanks the anchor buffers without changing the stack or
q-state calculations.

The stochastic visual is embedded into `StateMap` as an in-chart object strip.
This keeps the review workflow to one indicator. MT5 does not let one custom
indicator own both the main chart overlay and a true separate oscillator
subwindow, so the single-indicator route uses a chart-object stochastic strip
instead of a second indicator pane.

`Stochastic.mq5` is retained as a legacy standalone indicator, but it is no
longer required for the Gate 99ZB visual review path.

## Fallback Repair

`StateMap.mq5` now loads stack data in this order:

```text
1. current LimniVisualRuntimeService stack snapshot
2. local visual stack fallback if the service snapshot is missing or stale
```

The fallback is display-only repair for a plain indicator attach. It does not
change q-state formulas, thresholds, persistence, or EA trading behavior.

When the q-state snapshot is unavailable, the panel now shows:

```text
VISUAL ONLY
```

instead of blocking the whole visual surface behind `FAIL CLOSED`. This makes
the display honest: price/stochastic visuals can render while q-state snapshot
review is still unavailable.

`Stochastic.mq5` received the same service-first / local-fallback stack load so
an already-attached legacy stochastic pane does not remain blank during manual
visual checks.

## Panel Repair

`StateMap.mq5` replaced the cramped two-column stat grid with a wider
full-width row layout:

```text
width  370
height 176
rows   M1/stack source, score/conf/trend, stoch/anchor, reason, bars/visual flags
```

The panel still uses direct `CPanel` / `CLabel` controls only. `CAppDialog`
remains absent.

## Changed Files

```text
automation/mt5/Indicators/Limni/StateMap.mq5
automation/mt5/Indicators/Limni/Stochastic.mq5
```

Active terminal install paths:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Indicators\Limni\StateMap.mq5
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5\Indicators\Limni\Stochastic.mq5
```

## Verification

Artifact folder:

```text
docs/research/gates/gate99/artifacts/gate99zb-state-map-visual-consolidation-2026-07-07/
```

Compile logs:

```text
repo-StateMap-compile-log.txt
active-StateMap-compile-log.txt
repo-Stochastic-compile-log.txt
active-Stochastic-compile-log.txt
compile-results.txt
```

All four compile logs report:

```text
Result: 0 errors, 0 warnings
```

Source hashes:

```text
source-hashes.txt
```

Repo and active-terminal source hashes match for:

```text
StateMap.mq5
Stochastic.mq5
```

Static scan:

```text
static-scan-results.txt
```

The active visual sources contain no direct:

```text
CAppDialog
ChartRedraw
LimniLoadCachedStackSeries
LimniQStateBuildPairFeatures
CopyRates
```

They do contain:

```text
LimniVisualReadStackSnapshot
LimniVisualBuildStackSnapshot
```

That is intentional: service snapshots remain the first path, and local stack
build is a visual fallback for missing/stale snapshots.

## Required Manual Visual Check

Before external review:

```text
1. Remove the old standalone Stochastic pane if the goal is the one-indicator
   StateMap review surface.
2. Attach only Limni/StateMap.
3. Confirm ShowCenterLine=true and ShowStochasticVisual=true.
4. Confirm the center line renders on the main chart.
5. Confirm the embedded stochastic strip renders.
6. Confirm the panel has no white wrapper bleed, unreadable text, or overlapping
   rows.
```

## Verdict

```text
CORRECTIVE_COMPILE_INSTALL_PASS_VISUAL_ACCEPTANCE_PENDING
```

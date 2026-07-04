# Next Chat Prompt: LRMG Visual Recovery

Date: 2026-07-04

Repo: `C:\Users\User\Documents\GitHub\limni-website`

Branch at save: `codex/gate88-mt5-lifecycle-protection-controls`

HEAD at save: `ace6f7837d8ca3f5a7f52ddfd926e71f983e98d8`

## Recovery Order

Read first:

1. `C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_SESSION.md`
2. `C:\Users\User\Documents\GitHub\freedom-ops\.codex\CODEX_CKB.md`
3. `AGENTS.md`
4. `docs/backlog/CURRENT_WORK.md`
5. `docs/research/gates/gate91/GATE91_RADIAL_MOVEMENT_GRID_INDICATOR_SPEC_2026-07-03.md`
6. This file

## Current Objective

Fix the Limni Radial Movement Grid visual study surface.

Freedom is visually mapping the Triangle, not running a backtest matrix. The
desired output is a full LRMG chart replacement for manual history review.

## What Failed

The latest generated chart still fails Freedom's visual requirement.

Observed failure:

- Bars are not equal-size bricks anymore.
- The median / `0` line does not behave like the earlier moving-average style
  line.
- The chart visually became another transformed price chart instead of a new
  movement-block chart.
- Freedom is confused by the current state and asked to save state for a new
  chat.

Do not defend the current chart as acceptable.

## Important User Clarifications

Freedom wants:

- LRMG as a full generated/offline chart, not a bottom-pane oscillator.
- Equal visual bricks/blocks as the base grammar.
- A moving closed-brick median line that behaves like the earlier cyan moving
  average style line.
- The chart timeframe must not secretly change the formula.
- The canonical source feed should be M1 for now.
- Switching chart timeframe should be a display/view issue, not a new LRMG
  formula.
- The `0` line must not be interpreted as "short above / long below".
- Direction is the third Triangle piece and remains out of scope for LRMG.

Current intended formula boundary:

```text
source = selected symbol M1 history
Q      = LRMG movement radius from M1 path
brick  = equal visual LRMG block in Q units
median = moving closed-brick median from LRMG brick levels
view   = generated LRMG chart for manual review
```

## Files Touched In This Visual Lane

Repo files added/modified during the LRMG visual attempt:

- `automation/mt5/Indicators/Include/LimniRadialMovementGrid.mqh`
- `automation/mt5/Indicators/LimniRadialMovementGrid.mq5`
- `automation/mt5/Indicators/LimniLRMGStudyOverlay.mq5`
- `automation/mt5/Indicators/LimniLRMGZSpace.mq5`
- `automation/mt5/Scripts/LimniLRMGCreateChart.mq5`
- `docs/research/gates/gate91/GATE91_RADIAL_MOVEMENT_GRID_INDICATOR_SPEC_2026-07-03.md`
- compile receipts under `docs/research/gates/gate91/artifacts/`

Active terminal folder used:

```text
C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\94497F60A2BFEA1AFAB110FCF3E331BB\MQL5
```

Compiler paths used:

```text
C:\Program Files\OANDA Global MetaTrader 5 Terminal\MetaEditor64.exe
C:\Users\User\AppData\Roaming\Five Percent Online MetaTrader 5 - alt\MetaEditor64.exe
```

MetaEditor may return exit code `1` even on clean compile. Trust the log line
`0 errors, 0 warnings`.

## Prototype History

Do not confuse these attempts:

1. `LimniRadialMovementGrid.mq5`
   - Object overlay / shell arrows / boxes.
   - Rejected visually.

2. `LimniLRMGZSpace.mq5`
   - Bottom-pane z-space indicator.
   - Rejected because it became an oscillator under a normal price chart.

3. `LimniLRMGCreateChart.mq5`
   - Generated custom symbol chart.
   - Correct direction, but latest implementation is still wrong because it
     maps every source candle into LRMG level-space instead of restoring true
     equal-size brick/block visual behavior.

## Next Best Action

Start by restoring a true equal-brick custom chart.

Recommended bounded design:

1. Use M1 as canonical source no matter what timeframe chart the script is
   launched from.
2. Build LRMG brick closes from M1 path using the formulaic `Q`.
3. Generate a custom symbol chart with equal-size brick bodies.
4. Preserve real event time as much as MT5 permits.
5. Draw the moving closed-brick median line over the equal bricks.
6. Avoid labels and explanatory text on the chart.
7. Do not add Direction, Katarakti integration, David, cost guard, execution
   windows, daily flatten, or trading signals in this pass.

If preserving both real time and equal brick spacing conflicts in MT5 custom
rates, state the tradeoff clearly before coding further. Freedom prefers the
"new chart" feeling and equal-block visual grammar over another bottom
indicator.

## Frozen

No MT5 live trading, no EA, no promotion, no red-news, no direction layer, no
Katarakti integration, no David MA integration, no cost guard, no backtest
matrix expansion, and no full strategy rewrite in the first recovery pass.

# Gate 99A - Visual Event-State Grammar Sidecar Closeout

Date: 2026-07-06

Status: implemented as visual-only MT5 sidecar. No promotion claim.

## What Changed

Added the Gate 99A visual grammar spec:

`docs/research/gates/gate99/GATE99A_VISUAL_EVENT_STATE_GRAMMAR_SIDECAR_SPEC_2026-07-06.md`

Added the non-trading MT5 indicator:

`automation/mt5/Indicators/LimniKataraktiArchitectureSidecar.mq5`

Compiled artifact:

`automation/mt5/Indicators/LimniKataraktiArchitectureSidecar.ex5`

Installed active-terminal copy:

`C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Indicators/LimniKataraktiArchitectureSidecar.mq5`

## Sidecar Behavior

The indicator is chart-window only and does not trade.

It uses:

- LRMG brick close as the event clock.
- LRMG center plus `+1Q` and `-1Q` projected onto the display chart.
- `PERIOD_M1` as the default source timeframe, with the display chart used only
  as a canvas.
- Event-clocked Stoch main and D values.
- Event-clocked David-like LWMA slope/flip state.
- Confirmed long/short arrows as the default chart visual.
- Optional debug state labels:
  `SETUP`, `ARMED`, `CONFIRMED`, `INVALIDATED`, `STALE`, and `CONFLICT`.
- Optional debug panel with grammar version, event count, receipt count, latest
  state, latest reason, and config hash.

It exports receipts when `ExportReceipts=true`:

`Common/Files/LimniKataraktiArchitectureSidecar/<SYMBOL>_<TIMEFRAME>_gate99a_event_state.csv`

Every drawn state label is intended to have a matching receipt row.

After first visual review, default chart noise was reduced. `DrawSignalArrows`
defaults to `true`; `DrawStateLabels` and `DrawPanel` default to `false`.

For cross-timeframe review, use the same `StartDate`, `EndDate`,
`LookbackBars`, and grammar inputs on each display chart. The default source
start is `2026.01.01 00:00`; blank `EndDate` uses current server time.

## Receipts

Receipt rows include:

- event id and timestamp
- symbol and display timeframe
- event clock type
- event price
- LRMG center/quantum/side/structure
- event Stoch main/D/state/age
- David-like state/previous state/flip
- composite state
- side
- reason code
- grammar version
- config hash

## Important Limits

This V0 David layer is a David-like event transition proxy. It does not claim
exact parity with `David_MA_Color_V1f_Updated`.

The sidecar does not compute PnL, TP, SL, account exits, basket management, or
orders.

Katarakti is not the V0 core trigger. This gate is for visual state grammar
validation before any EA mutation.

## Compile Evidence

Repo compile log:

`docs/research/gates/gate99/artifacts/compile-gate99a-2026-07-06/limni-katarakti-architecture-sidecar-repo-compile-log.txt`

Active terminal compile log:

`docs/research/gates/gate99/artifacts/compile-gate99a-2026-07-06/limni-katarakti-architecture-sidecar-active-terminal-compile-log.txt`

Both logs report:

`Result: 0 errors, 0 warnings`

Source SHA256:

`2E796B8A3913F1C063652C3AEEE349600A3F5EE7B233132F6F6D905694A1B107`

Repo compiled EX5 SHA256:

`7A58EDDEECBC705B9C22F64ADC38D98AE29F90C799F36C16A845BCCD2C5BD4A7`

Active terminal source hash matched the repo source hash before active-terminal
compile. The active terminal `.ex5` hash differs from the repo `.ex5`, which is
expected when MetaEditor compiles in different terminal layouts.

## Stop Lines Preserved

- No `LimniKataraktiEA.mq5` mutation.
- No `LimniHedge_V1.mq5` mutation.
- No live/app integration.
- No Candidate B or regime overlay.
- No David/Stoch parameter sweep.
- No promotion claim.

## Next Review Step

Attach `LimniKataraktiArchitectureSidecar` to a chart and visually review
whether the state labels match the intended structure.

First review question:

Does the sequence `SETUP -> ARMED -> CONFIRMED / INVALIDATED / STALE` visually
represent the architecture Freedom is trying to capture?

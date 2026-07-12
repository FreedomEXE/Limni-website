# Gate 86 MT5 Tester Speed Preflight

Generated: `2026-07-01`

## Verdict

`PASS_GATE86_MT5_TESTER_SPEED_PREFLIGHT_COMPILED_AND_INSTALLED_NO_TESTER_RESULT`

## Scope

Gate 86 responds to the first V3 manual EURUSD Strategy Tester run being too
slow: about one completed year per hour in real-tick mode even with CSV,
dashboard, and visual mode disabled.

This gate keeps the same active EA name:

- `LimniBasketHedgeEAAlphaV3`

It does not add a new strategy idea. The raw harvest rules remain:

- fully hedged long+short sides;
- `1.0` ADR target;
- `0.2` ADR spacing;
- current-chart symbol only by default;
- live trading blocked by default.

## EA Speed Changes

- Added tester cadence inputs:
  - `TesterCadence`
  - `TesterMinSecondsBetweenManage`
- Added refresh throttles:
  - `AdrRefreshSeconds`
  - `DrawdownRefreshSeconds`
- Cached symbol unit lot, point, and digits during init.
- Folded side counts, oldest anchor recovery, and side ADR PnL into the
  position snapshot pass.
- Replaced the per-leg second position scan with snapshot-computed ADR PnL.
- Throttled ADR D1-series refresh. Default: `AdrRefreshSeconds=3600`.
- Throttled account-equity drawdown refresh. Default:
  `DrawdownRefreshSeconds=60`.

## Local Workspace Speed Aid

Created local ignored workspace settings:

- `.vscode/settings.json`

The settings exclude generated research artifact JSON/CSV from VS Code file
watching and search. The file is ignored by git and is local to this machine.

## Compile Evidence

Repo compile:

- Compiler:
  `C:/Program Files/OANDA Global MetaTrader 5 Terminal/MetaEditor64.exe`
- Log:
  `docs/research/gates/gate86/artifacts/limni-basket-hedge-ea-alpha-v3-gate86-repo-compile-log.txt`
- Result: `0 errors, 0 warnings`

Active terminal compile:

- Compiler:
  `C:/Users/User/AppData/Roaming/Five Percent Online MetaTrader 5 - alt/MetaEditor64.exe`
- Log:
  `docs/research/gates/gate86/artifacts/limni-basket-hedge-ea-alpha-v3-gate86-active-terminal-compile-log.txt`
- Result: `0 errors, 0 warnings`

MetaEditor returned process exit code `1` in both compiles, matching the known
local pattern where the log and emitted `.ex5` are the compile evidence.

## Install Evidence

Active terminal data root:

- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB`

Installed active terminal files:

- `MQL5/Experts/LimniBasketHedgeEAAlphaV3.mq5`
- `MQL5/Experts/LimniBasketHedgeEAAlphaV3.ex5`
- `MQL5/Experts/Include/Strategy/RawHarvestEngine.mqh`

Repo and active-terminal source hashes match:

- `LimniBasketHedgeEAAlphaV3.mq5`:
  `6845AE15B23148B48F347BA86545AE4BD3C7B8580ABFDD0D70B39C1C9156DAF9`
- `RawHarvestEngine.mqh`:
  `317E35DC3A2FE756161BC61813F1331264D0A9953300657B2398E90C2FBBEC22`

Compiled `.ex5` hashes:

- Repo OANDA compile:
  `0C734655BC035A6E0EC2E65353A88CAC62C0BD7818BEAC45D25039AFF5C90DB7`
- Active terminal compile:
  `6C4EEC3CFB783233402DA91311F33970705AAC5FBB9F28CC212A29C15275EC22`

The `.ex5` hashes differ because each terminal MetaEditor compiled its own
binary.

## Recommended Rerun

Fast iteration:

- EA: `LimniBasketHedgeEAAlphaV3`
- Symbol/timeframe: `EURUSD,M1`
- Model: `1 Minute OHLC`
- Visual mode: off
- Optimization: off
- Execution/latency: zero latency
- Date range: Freedom's available history window is acceptable; compare the
  overlap with warehouse evidence separately.
- Inputs:
  - `CsvLogEnabled=false`
  - `DashboardEnabled=false`
  - `EnableTimer=false`
  - `TesterCadence=RH_CADENCE_EVERY_TICK`
  - `TesterMinSecondsBetweenManage=0`
  - `AdrRefreshSeconds=3600`
  - `DrawdownRefreshSeconds=60`
  - `UseCurrentChartSymbolOnly=true`
  - `LotSize=0.01`
  - `TargetAdrMultiple=1.0`
  - `SpacingAdrMultiple=0.2`

Rough ultra-fast sanity only:

- Same as above, but `TesterCadence=RH_CADENCE_NEW_M1_BAR`.

That rough mode is not final parity evidence because it only runs the manage
cycle once per M1 bar.

Final confirmation:

- `Every tick based on real ticks`
- `TesterCadence=RH_CADENCE_EVERY_TICK`

Use real ticks only after a candidate survives faster iteration. If real ticks
remain near one year per hour, they are a final-confirmation tool, not the
default design loop.

## Stop Line

Gate 86 is an MT5 tester-speed preflight and install only. It is not a Strategy
Tester result, optimization pass, risk layer, promotion, or live-readiness
claim.

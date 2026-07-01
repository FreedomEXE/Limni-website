# Gate 84 MT5 Raw Harvest V3 Simplification Install

Generated: `2026-07-01`

## Verdict

`PASS_GATE84_MT5_RAW_HARVEST_V3_COMPILED_AND_INSTALLED_NO_PROMOTION`

## Scope

- Build a simplified MT5 EA for the raw fully hedged harvest engine.
- Active EA: `automation/mt5/Experts/LimniBasketHedgeEAAlphaV3.mq5`.
- Active dependency: `automation/mt5/Experts/Include/Strategy/RawHarvestEngine.mqh`.
- Defaults: current chart symbol only, lot `0.01`, target `1.0` ADR, spacing `0.2` ADR, max `50` orders per tick, timer disabled.
- Live trading remains blocked by default with `AllowLiveTrading=false`.

## Simplification

V3 removes the V2 boundary and visual prototype machinery:

- no weekly boundary helper;
- no week tags;
- no trade-window gating;
- no `RAW` / `GRID_CAP` mode switch;
- no grid-cap reset limit;
- no Pine-style weekly price anchor;
- no chart objects;
- no per-tick `HistorySelect`;
- no per-tick CSV state logging;
- no global-variable state persistence.

The remaining loop is only the raw harvest engine:

1. Open one long and one short side when a side is empty.
2. Close a side when its ADR-normalized leg PnL reaches `TargetAdrMultiple`.
3. Re-open that side on the next tick.
4. Add adverse recovery fills every `SpacingAdrMultiple` ADR from the side anchor.
5. Add favorable expansion fills every `SpacingAdrMultiple` ADR from the side anchor.
6. Cache ADR from D1 bars and refresh only when the prior D1 bar changes, unless `AdrValue` is manually supplied.

## Archived Previous Hedged Version Files

- `automation/mt5/Experts/LimniBasketHedgeEAAlphaV2.mq5` ->
  `archive/automation/mt5/Experts/LimniBasketHedgeEAAlphaV2.mq5`
- `automation/mt5/Experts/Include/Strategy/WeeklyBoundary.mqh` ->
  `archive/automation/mt5/Experts/Include/Strategy/WeeklyBoundary.mqh`
- `archive/automation/mt5/Experts/LimniBasketHedgeEAAlphaV1.ex5` was already archived before this gate.

Local active-terminal archive:

- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Experts/Archive/LimniBasketHedgeEAAlphaV1.mq5`
- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Experts/Archive/LimniBasketHedgeEAAlphaV1.ex5`

## Compile Evidence

Repo compile:

- Compiler: `C:/Program Files/OANDA Global MetaTrader 5 Terminal/MetaEditor64.exe`
- Log: `docs/research/gates/gate84/artifacts/limni-basket-hedge-ea-alpha-v3-compile-log.txt`
- Result: `0 errors, 0 warnings`
- Elapsed: `6558 ms`

Active terminal compile:

- Compiler: `C:/Users/User/AppData/Roaming/Five Percent Online MetaTrader 5 - alt/MetaEditor64.exe`
- Log: `docs/research/gates/gate84/artifacts/limni-basket-hedge-ea-alpha-v3-active-terminal-compile-log.txt`
- Result: `0 errors, 0 warnings`
- Elapsed: `15018 ms`

## Install Evidence

Active running terminal process:

- `C:/Users/User/AppData/Roaming/Five Percent Online MetaTrader 5 - alt/terminal64.exe`

Active terminal data root:

- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB`

Installed active terminal files:

- `MQL5/Experts/LimniBasketHedgeEAAlphaV3.mq5`
- `MQL5/Experts/LimniBasketHedgeEAAlphaV3.ex5`
- `MQL5/Experts/Include/Strategy/RawHarvestEngine.mqh`

OANDA compile-target data root also has the same V3 source and include installed:

- `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/67E58C3BE56BAC51882B5F36F45E170E`

## Hashes

Repo/source hashes:

- `LimniBasketHedgeEAAlphaV3.mq5`: `AD095916AA4AC43BEAC8FA2C736DFA6801D063F31B9FB92D864A0CC025795E07`
- `RawHarvestEngine.mqh`: `173D2EDFDE2618EB14C9000AC10E29498A54DD53705426154BD427D220F5206C`
- repo OANDA-compiled `LimniBasketHedgeEAAlphaV3.ex5`: `5D5E40EA105E0A348BAD2C0D2C43CEE7428B1218BBCCB2A788082AD01B42CAE1`

Active terminal install hashes:

- installed `LimniBasketHedgeEAAlphaV3.mq5`: `AD095916AA4AC43BEAC8FA2C736DFA6801D063F31B9FB92D864A0CC025795E07`
- installed `RawHarvestEngine.mqh`: `173D2EDFDE2618EB14C9000AC10E29498A54DD53705426154BD427D220F5206C`
- active-terminal-compiled `LimniBasketHedgeEAAlphaV3.ex5`: `A099E8DCCF858DA0E17EA651A369FA606BA0525F17D510ED3DBABBC397C224B4`

The active terminal `.ex5` hash differs from the repo OANDA `.ex5` because it
was rebuilt by the active Five Percent terminal MetaEditor after installation.

## Test Note

For the first manual comparison test, use the active terminal EA:

- `LimniBasketHedgeEAAlphaV3`
- symbol: `EURUSD`
- chart/current symbol only: `true`
- lot: `0.01`
- target: `1.0`
- spacing: `0.2`
- `AllowLiveTrading=false`
- `EnableTimer=false`
- add broker costs in Strategy Tester as planned

The closest warehouse comparison range from Gate 83 was
`2019-04-14T23:00:00.000Z` through `2026-05-31T23:00:00.000Z`. V3 is not exact
warehouse parity because it carries state continuously in MT5 instead of
replaying independent pair-weeks.

## Stop Line

Gate 84 is an MT5 one-pair/manual-test simplification install only. No MT5
Strategy Tester result, optimization, risk layer, all-pair runtime, promotion,
or live-readiness claim is made by this receipt.

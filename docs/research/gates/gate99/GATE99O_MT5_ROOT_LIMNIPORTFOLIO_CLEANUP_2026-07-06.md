# Gate 99O - MT5 Root LimniPortfolio Cleanup

Date: 2026-07-06

## Scope

Freedom requested that MT5 root surfaces be purged of files unrelated to the new
`LimniPortfolioEA` product path, with old EAs and unused root-level indicator
files moved into the existing/archive-style folders for Experts and Indicators.

No files were deleted.

## Active Root Surface After Cleanup

`automation/mt5/Experts/` root keeps:

- `Limni/`
- `Include/`
- `Archived/`

`automation/mt5/Experts/Limni/` keeps:

- `LimniPortfolioEA.mq5`
- `LimniPortfolioEA.ex5`

`automation/mt5/Indicators/` root keeps:

- `Include/`
- `Limni/`
- `Archived/`

The `Indicators/Limni/` stack remains active for chart inspection. The new EA
does not depend on `iCustom` visual indicators.

## Archived Expert Files

Moved from `automation/mt5/Experts/` to
`automation/mt5/Experts/Archived/`:

- `LimniBasketEAAlphaV1.ex5`
- `LimniBasketEAAlphaV1.mq5`
- `LimniBasketHedgeEAAlphaV2.ex5`
- `LimniBasketHedgeEAAlphaV3.ex5`
- `LimniBasketHedgeEAAlphaV3.mq5`
- `LimniBeta.ex5`
- `LimniBeta.mq5`
- `LimniHedge_V1.ex5`
- `LimniHedge_V1.mq5`
- `LimniHedgeV1TickTrace.ex5`
- `LimniHedgeV1TickTrace.mq5`
- `LimniKataraktiEA.active-terminal.compile.log`
- `LimniKataraktiEA.compile.log`
- `LimniKataraktiEA.ex5`
- `LimniKataraktiEA.mq5`
- `LimniLRMGGridScaffoldEA.ex5`
- `LimniTelemetryEA.mq5`
- `LimniTrendFollow.ex5`
- `LimniTrendFollow.mq5`

## Archived Root Indicator Files

Moved from `automation/mt5/Indicators/` to
`automation/mt5/Indicators/Archived/`:

- `Limni-TradePanel-v2.0.ex5`
- `Limni-TradePanel-v2.0.mq5`
- `LimniKataraktiArchitectureSidecar.ex5`
- `LimniKataraktiArchitectureSidecar.mq5`
- `LimniKataraktiSweepBox.compile.log`
- `LimniKataraktiSweepBox.ex5`
- `LimniKataraktiSweepBox.mq5`
- `LimniLRMGPriceLine.compile.log`
- `LimniLRMGStudyOverlay.ex5`
- `LimniLRMGStudyOverlay.mq5`
- `LimniLRMGZSpace.ex5`
- `LimniLRMGZSpace.mq5`
- `LimniRadialMovementGrid.ex5`
- `LimniRadialMovementGrid.mq5`

## Active Terminal Cleanup

In the active terminal:

`C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Experts/`

the remaining root-level `LimniBeta.ex5` and `LimniBeta.mq5` were moved into:

`MQL5/Experts/Archived/`

The active terminal root keeps `MQL5/Experts/Limni/` beside MT5's existing
platform folders. `MQL5/Experts/Limni/` keeps `LimniPortfolioEA.mq5` and
`LimniPortfolioEA.ex5`.

## Frozen Areas

- No deletion.
- No strategy implementation.
- No live trading.
- No mutation of archived source content.
- No move of `Experts/Include/` or `Indicators/Include/`.
- No move of active `Indicators/Limni/` chart-inspection stack.
- No cleanup of scripts/templates in this gate.

## Required Verification

After cleanup, recompile `LimniPortfolioEA` from the repo and active terminal to
prove that the new product path does not depend on archived root files.

## Verification

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99o-mt5-root-limniportfolio-cleanup-2026-07-06/`

Compile logs:

- `repo-LimniPortfolioEA-post-cleanup-compile-log.txt`
- `active-LimniPortfolioEA-post-cleanup-compile-log.txt`

Both logs report:

```text
Result: 0 errors, 0 warnings
```

MetaEditor returned process exit code `1` while writing clean logs, matching the
known local MT5 compile pattern in this repo.

Gate 99P adds the final Limni-folder relocation compile proof after Freedom
requested the product EA live under `Experts/Limni/`.

# Gate 99H - LimniBeta Simple Names

Date: 2026-07-06

## Scope

Freedom renamed the active LRMG indicators to simpler terminal names. This gate
aligns the repo and the scaffold EA with that naming surface before Variant
Strict/Loose testing.

## Renamed Surface

Repo indicator sources now live under:

- `automation/mt5/Indicators/Limni/PriceAnchor.mq5`
- `automation/mt5/Indicators/Limni/Stochastic.mq5`
- `automation/mt5/Indicators/Limni/TrendState.mq5`
- `automation/mt5/Indicators/Limni/Katarakti.mq5`

The renamed indicators use the existing shared include folder via
`..\\Include`, so the repo keeps one shared LRMG core under:

- `automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh`
- `automation/mt5/Indicators/Include/LimniRadialMovementGrid.mqh`

Mapping:

- `LimniLRMGPriceLine` -> `Limni/PriceAnchor`
- `LimniLRMGStoch` -> `Limni/Stochastic`
- `LimniLRMGMA` -> `Limni/TrendState`
- `LimniLRMGTrigger` -> `Limni/Katarakti`
- `LimniLRMGGridScaffoldEA` -> `LimniBeta`

## EA Changes

New EA source:

- `automation/mt5/Experts/LimniBeta.mq5`

The EA now references:

- `#property tester_indicator "Limni\\TrendState.ex5"`
- `#property tester_indicator "Limni\\Stochastic.ex5"`
- `iCustom(..., "Limni\\TrendState", ScaleLookbackDays, false)`
- `iCustom(..., "Limni\\Stochastic", ScaleLookbackDays, false)`

Input cleanup:

- `EntryMode`: `Strict` or `Loose`
- `ScaleLookbackDays`: default `0`
- `StochOS`: default `10.0`, trend sell level
- `StochOB`: default `90.0`, trend buy level
- Inputs are separated by simple string headers for readability.

Entry semantics:

- `Strict`: red TrendState plus first Stochastic cross below `StochOS` sells
  once per red state leg; green TrendState plus first Stochastic cross above
  `StochOB` buys once per green state leg.
- `Loose`: red TrendState plus Stochastic below `StochOS` permits sell while no
  same-side grid is open; green TrendState plus Stochastic above `StochOB`
  permits buy while no same-side grid is open.

The weekly boundary guard from Gate 99G remains unchanged: when enabled, no
opens, closes, or grid adds occur during Sunday `17:00-17:59 EST` or Friday
`16:00-16:59 EST`.

## Compile Proof

Artifact folder:

- `docs/research/gates/gate99/artifacts/gate99h-limnibeta-simple-names-2026-07-06/`

Repo compile logs:

- `repo-PriceAnchor-compile-log.txt`: `Result: 0 errors, 0 warnings`
- `repo-Stochastic-compile-log.txt`: `Result: 0 errors, 0 warnings`
- `repo-TrendState-compile-log.txt`: `Result: 0 errors, 0 warnings`
- `repo-Katarakti-compile-log.txt`: `Result: 0 errors, 0 warnings`
- `repo-LimniBeta-compile-log.txt`: `Result: 0 errors, 0 warnings`

Active-terminal compile logs:

- `active-PriceAnchor-compile-log.txt`: `Result: 0 errors, 0 warnings`
- `active-Stochastic-compile-log.txt`: `Result: 0 errors, 0 warnings`
- `active-TrendState-compile-log.txt`: `Result: 0 errors, 0 warnings`
- `active-Katarakti-compile-log.txt`: `Result: 0 errors, 0 warnings`
- `active-LimniBeta-compile-log.txt`: `Result: 0 errors, 0 warnings`

MetaEditor returned process exit code `1` with clean logs, matching the known
MT5 compile behavior in this repo.

## Source Hash Parity

Repo and active terminal source hashes matched after install:

- `PriceAnchor.mq5`: `3D6084E5ACB3161F8E18DDBFD964663BDFE5554FFF1494688FD0103F187BBD01`
- `Stochastic.mq5`: `6CA2448F0A97935079818B9C5D12DF09CE4EF72877C5EE189B47BC69E1DCDF28`
- `TrendState.mq5`: `F8B3C257BB9C619E3DF6B26C6060D7BDEA24AB5C7FC04293137A326AA45C0B56`
- `Katarakti.mq5`: `5E0F39153BD862FCC051463CDA49007FF24694F46C6C9E6D2BA2CC36F3439FAC`
- `LimniLRMGStackCore.mqh`: `B35C6090C4BB2F777E4A8234F155D1595A6778E1527BBB208BC407F5D5952A3B`
- `LimniRadialMovementGrid.mqh`: `F669BBD235FF7DB2A8688DF7867F2B7EC3A77C3AE6CACBAB7D0E0FDDCADDD127`
- `LimniBeta.mq5`: `C978E6F320E05D38E7D236465210EA5366DDB9E4B3EF215D2C1D5CB832DCE8C9`

## Stop Lines

- No `LimniKataraktiEA.mq5` mutation.
- No `LimniTrendFollow.mq5` mutation.
- No `LimniHedge_V1.mq5` mutation.
- No backtest/PnL/promotion claim in this gate.
- No final EA promotion; `LimniBeta` is still a scaffold for testing.

## Next Action

Run `LimniBeta` on the same symbol/window in `Strict` and `Loose` mode, with
`ScaleLookbackDays=0`, `StochOS=10`, `StochOB=90`, and the broker-to-EST offset
set for the tester clock.

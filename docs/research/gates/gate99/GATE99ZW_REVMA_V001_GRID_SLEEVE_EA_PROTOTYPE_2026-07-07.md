# Gate 99ZW - Revma v001 Grid Sleeve EA Prototype

Date: 2026-07-07

## Scope

Build the first EA-side Revma v001 / PairDirectionGrid prototype.

Revma is the only active strategy system by default:

- `system_id`: `revma-v001`
- `system_name`: `Revma v001`
- `formula_id`: `revma-pair-direction-grid-v001`
- Greek name: Reuma / current / flow / stream

Frozen areas:

- No EA live-trading claim.
- No backtest performance claim.
- No Katarakti trigger, filter, fallback, or hidden dependency inside Revma.
- No q-state formula semantics change.
- No indicator rendering redesign.

## Implemented

- Added a scalar pair-direction evaluation path in `LimniPairDirectionCore.mqh` so the EA can process incremental closed M1 state without replaying indicator arrays.
- Added Revma system contracts in `RevmaTypes.mqh`.
- Added Revma closed-M1 state builder in `RevmaSignalState.mqh`.
- Added Revma locked grid-sleeve strategy in `RevmaGridSleeve.mqh`.
- Integrated Revma into `LimniPortfolioEA` through `StrategyRegistry.mqh` and `Engine.mqh`.
- Added Revma lane, variants, universe mode, config fields, and receipt kinds.
- Added Revma manifest fields and Revma birth/add receipts with rich audit metadata.
- Defaulted Revma on, legacy Q-state strategy off, and currency exposure guard off for the first loose research run.

## Revma Sleeve Rules

The sleeve is locked at grid birth.

- LONG above anchor: continuation, add higher.
- SHORT below anchor: continuation, add lower.
- LONG below anchor: reversion, add lower.
- SHORT above anchor: reversion, add higher.

Revma records the grid birth context in receipts:

- direction
- raw direction
- anchor location
- sleeve
- q at entry
- q in pips
- entry anchor
- entry price
- entry stochastic
- trend state
- raw/trend/exhaustion/confidence scores
- source closed-M1 time
- q-day count
- closed-M1 bar count
- add policy

## Engine Boundary

When `EnableRevmaSystem=true`, the engine runs the Revma path and does not build the old portfolio Q-state snapshot.

The legacy Q-state branch is still present for later review, but it is only reachable when Revma is disabled and `EnableQStateTrendVariant=true`.

Revma uses shared infrastructure only where it is explicitly common:

- symbol metadata
- closed-M1 clock
- position/grid inventory
- intent bus
- receipt writer
- account harvest governor
- risk arbiter
- trade router

## Inputs

New Revma inputs:

- `EnableRevmaSystem`
- `RevmaUniverseMode`
- `RevmaEnableContinuationSleeve`
- `RevmaEnableReversionSleeve`
- `RevmaFixedLots`
- `RevmaGridSpacingQ`
- `RevmaIntentExpiryMinutes`
- `RevmaBootstrapM1Bars`

Universe modes:

- `LP_UNIVERSE_CURRENT_CHART`
- `LP_UNIVERSE_FX28`

## Evidence

Artifact directory:

`docs/research/gates/gate99/artifacts/gate99zw-revma-v001-grid-sleeve-ea-prototype-2026-07-07/`

Compile proof:

- Repo `LimniPortfolioEA.mq5`: `Result: 0 errors, 0 warnings`
- Active-terminal `LimniPortfolioEA.mq5`: `Result: 0 errors, 0 warnings`
- Repo `StateMap.mq5` compatibility compile: `Result: 0 errors, 0 warnings`
- Active-terminal `StateMap.mq5` compatibility compile: `Result: 0 errors, 0 warnings`

Static scan:

- Revma-only files have no `Katarakti`, `katarakti`, `KTR`, `ktr`, `QState`, `LimniQState`, or `BuildPortfolioQStateSnapshot` references.

## Manual Acceptance

Not run in this gate.

Required next manual/visual tester check:

- Single pair first with `RevmaUniverseMode=LP_UNIVERSE_CURRENT_CHART`.
- Confirm Revma birth/add receipts appear only on locked sleeve rules.
- Confirm continuation adds only in favour.
- Confirm reversion adds only against entry.
- Confirm sleeve does not reclassify after birth.
- Confirm no Katarakti receipt field is present in Revma birth/add receipts.

## Non-Claims

This gate does not claim:

- profitability
- backtest validity
- live readiness
- VPS readiness
- indicator visual acceptance
- exposure-guard effectiveness
- grid-cap effectiveness

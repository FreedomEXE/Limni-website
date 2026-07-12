# Gate 88: MT5 Lifecycle Protection Controls

Date: 2026-07-01

Verdict: `PASS_GATE88_MT5_LIFECYCLE_PROTECTION_CONTROLS_COMPILED_AND_INSTALLED_NO_TESTER_RESULT`

## Scope

Gate 88 keeps the active EA name `LimniBasketHedgeEAAlphaV3` and adds optional
lifecycle controls for MT5 Strategy Tester research after the EURUSD HWM ladder
failed to solve the stale-inventory choke by itself.

All new controls are OFF by default.

## Added Inputs

- `EquityLwmResetEnabled=false`
- `EquityLwmLossLimitMoney=500.0`
- `EquityLwmResetCooldownSeconds=60`
- `MaxAgeResetEnabled=false`
- `MaxAgeDays=30`
- `EquityTrailLockEnabled=false`
- `EquityTrailActivationMoney=250.0`
- `EquityTrailGivebackMoney=100.0`
- `EquityTrailUnlockWhenFlat=true`

Gate 87 HWM inputs remain available:

- `EquityHwmResetEnabled=false`
- `EquityHwmResetTargetMoney=500.0`
- `EquityHwmResetCooldownSeconds=60`
- `EquityHwmCsvLogEnabled=true`

## Behavior

- HWM reset: unchanged intent from Gate 87. When enabled, flatten all managed
  positions after account equity reaches cycle start plus target money.
- LWM reset: when enabled, flatten all managed positions after account equity
  falls below cycle start by the configured loss limit.
- Max-age reset: when enabled, flatten all managed positions after the oldest
  managed position reaches `MaxAgeDays`.
- Equity trail lock: when enabled, arm after account equity reaches cycle start
  plus activation money, then lock after the configured giveback from cycle high.
  Locking does not flatten. It blocks new initials and grid adds while allowing
  existing positions to close by the normal target-reset logic.
- Trail flat unlock: when trail lock is active and all managed positions have
  naturally closed, reset the cycle and allow new trading again. This prevents
  trail-lock-only tests from becoming permanently locked after the first lock.

The reset paths share one cycle restart helper and write
`limni_basket_hedge_alpha_v3_lifecycle_resets.csv`. HWM still also writes the
Gate 87 HWM-specific CSV. Trail lock writes
`limni_basket_hedge_alpha_v3_trailing_locks.csv`.

## Files Changed

- `automation/mt5/Experts/LimniBasketHedgeEAAlphaV3.mq5`
- `automation/mt5/Experts/Include/Strategy/RawHarvestEngine.mqh`

The main EA file only received new inputs. Lifecycle behavior lives in
`RawHarvestEngine.mqh`.

## Verification

- Repo compile log:
  `docs/research/gates/gate88/artifacts/limni-basket-hedge-ea-alpha-v3-gate88-repo-compile-log.txt`
- Active terminal compile log:
  `docs/research/gates/gate88/artifacts/limni-basket-hedge-ea-alpha-v3-gate88-active-terminal-compile-log.txt`
- Trail-unlock repo compile log:
  `docs/research/gates/gate88/artifacts/limni-basket-hedge-ea-alpha-v3-gate88-trail-unlock-repo-compile-log.txt`
- Trail-unlock active terminal compile log:
  `docs/research/gates/gate88/artifacts/limni-basket-hedge-ea-alpha-v3-gate88-trail-unlock-active-terminal-compile-log.txt`
- Repo compile result: `0` errors, `0` warnings.
- Active terminal compile result: `0` errors, `0` warnings.
- Trail-unlock repo compile result: `0` errors, `0` warnings.
- Trail-unlock active terminal compile result: `0` errors, `0` warnings.

Installed active terminal root:

`C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB`

Installed active files:

- `MQL5/Experts/LimniBasketHedgeEAAlphaV3.mq5`
- `MQL5/Experts/LimniBasketHedgeEAAlphaV3.ex5`
- `MQL5/Experts/Include/Strategy/RawHarvestEngine.mqh`

Source hashes:

- `LimniBasketHedgeEAAlphaV3.mq5`:
  `4E264DE33A47E43CC96614044D6C993C490BB75C20625A7246626A0DE188A386`
- `RawHarvestEngine.mqh`:
  `E2AB2C32024123D052F31847EEA432ED1E2A564E3A4401607C87607362CA481D`
- Active terminal `LimniBasketHedgeEAAlphaV3.ex5`:
  `CFB4F70143BCE6FCCEDE1C33546007D04FE604C7FD62ADF4B0AF9E04AD975073`

## Suggested Next Tests

Use EURUSD first because the failure mode is now known there.

Base settings:

- `UseCurrentChartSymbolOnly=true`
- `CsvLogEnabled=false`
- `EquityHwmCsvLogEnabled=true`
- `DashboardEnabled=false`
- `EnableTimer=false`
- `TesterCadence=RH_CADENCE_NEW_M1_BAR`
- `TesterMinSecondsBetweenManage=0`
- `AdrRefreshSeconds=3600`
- `DrawdownRefreshSeconds=60`
- `LotSize=0.01`
- `TargetAdrMultiple=1.0`
- `SpacingAdrMultiple=0.2`

Isolation ladder:

1. LWM only: `EquityLwmResetEnabled=true`, all HWM/max-age/trail controls OFF.
2. Max-age only: `MaxAgeResetEnabled=true`, all HWM/LWM/trail controls OFF.
3. Trail-lock only: `EquityTrailLockEnabled=true`,
   `EquityTrailUnlockWhenFlat=true`, all HWM/LWM/max-age controls OFF.
4. Combinations only after the isolated behavior is understood.

This gate is not a Strategy Tester result, optimization, promotion,
live-readiness claim, Candidate B/COT layer, risk layer, lot-sizing change, or
ADR-normalized lifecycle target.

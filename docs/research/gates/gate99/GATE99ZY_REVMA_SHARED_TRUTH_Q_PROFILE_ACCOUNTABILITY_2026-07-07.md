# Gate 99ZY - Revma Shared Truth And Q Profile Accountability

Date: 2026-07-07

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

## Scope

This gate addresses the ChatGPT Pro review blockers before any Revma backtest:

- StateMap pair-direction replay must not consume Katarakti-derived trigger events.
- Revma q calibration speed must be explicit and receipt-backed.
- StateMap and Revma EA defaults must align for visual proof.
- Revma add receipts must separate frozen birth facts from current signal facts.

No backtest was run. No live-trading, promotion, VPS, exposure-guard, performance, or profitability claim is made.

## Changes

`StateMap.mq5` now keeps the existing LRMG stack trigger array intact, but builds a separate Revma-style movement trigger series with `LimniBuildLrmgMovementTriggerSeries()` before calling `LimniPairDirectionReplay()`. The replay path now passes `g_source_revma_trigger`, so StateMap direction replay uses the same simple LRMG movement-event semantics as the Revma EA path instead of the Katarakti-classification trigger stream.

`VisualMaxM1Bars` now defaults to `50000`, matching the Revma `MEDIUM` q-profile default used by the Portfolio EA. Operators can still change the StateMap input for visual research.

Revma q speed is now an explicit strategy dimension:

- `RevmaQProfile = FAST / MEDIUM / SLOW / FULL / CUSTOM`
- `RevmaMaxM1Bars`
- `q_profile_id`

The q profile is included in config hash material, run manifest receipts, Revma signal receipts, birth receipts, and add receipts.

Revma add receipts no longer call birth metadata with current signal values. Add receipts now include:

- locked grid/add-policy fields
- frozen birth fields from an in-memory grid birth snapshot when available
- current signal fields with `current_` prefixes
- `birth_snapshot=missing_in_memory` if the EA session does not have the birth snapshot, instead of inventing entry facts

The build metadata was advanced to:

- `LP_EA_VERSION=0.1.10-gate99zy`
- `LP_BUILD_GATE=Gate99ZY`
- `LP_BUILD_SCOPE=revma-v001-shared-truth-q-profile-accountability`

## Files Changed

- `automation/mt5/Experts/Include/Core/BuildInfo.mqh`
- `automation/mt5/Experts/Include/Core/Config.mqh`
- `automation/mt5/Experts/Include/Core/Engine.mqh`
- `automation/mt5/Experts/Include/Core/Types.mqh`
- `automation/mt5/Experts/Include/Receipts/RunManifest.mqh`
- `automation/mt5/Experts/Include/Signals/RevmaSignalState.mqh`
- `automation/mt5/Experts/Include/Strategies/RevmaGridSleeve.mqh`
- `automation/mt5/Experts/Include/Strategies/RevmaTypes.mqh`
- `automation/mt5/Experts/Limni/LimniPortfolioEA.ex5`
- `automation/mt5/Indicators/Include/LimniLRMGStackCore.mqh`
- `automation/mt5/Indicators/Limni/StateMap.ex5`
- `automation/mt5/Indicators/Limni/StateMap.mq5`
- `automation/mt5/Indicators/Limni/Stochastic.ex5`

## Compile Proof

Artifacts:

`docs/research/gates/gate99/artifacts/gate99zy-revma-shared-truth-q-profile-accountability-2026-07-07/`

MetaEditor exit code `1` accompanied all clean compiles, matching the known local MetaEditor pattern. The log result lines are authoritative:

- `repo-LimniPortfolioEA`: `Result: 0 errors, 0 warnings`
- `repo-StateMap`: `Result: 0 errors, 0 warnings`
- `repo-Stochastic`: `Result: 0 errors, 0 warnings`
- `active-terminal-LimniPortfolioEA`: `Result: 0 errors, 0 warnings`
- `active-terminal-StateMap`: `Result: 0 errors, 0 warnings`
- `active-terminal-Stochastic`: `Result: 0 errors, 0 warnings`

## Static Proof

`static-scans.txt` confirms:

- StateMap defines and passes `g_source_revma_trigger` into `LimniPairDirectionReplay()`.
- The old `RevmaBootstrapM1Bars` / `revma_bootstrap_m1_bars` names have no source matches.
- q profile fields are present in manifest, signal, birth, and add receipt paths.
- add receipts include `birth_snapshot`, `birth_q`, and `current_q` fields.

## Manual Acceptance

No visual MT5/manual strategy-tester acceptance was performed in this gate. The next gate should be review-first, then a bounded single-pair visual strategy-tester acceptance only after Freedom approves moving past code review.

## Frozen Areas

- No Katarakti strategy module work.
- No q-state formula semantics changes.
- No EA backtest run.
- No exposure guard/grid cap validation.
- No live-trading or performance claim.
- No repo-wide cleanup.

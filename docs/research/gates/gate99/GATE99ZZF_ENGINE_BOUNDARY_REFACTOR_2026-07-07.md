# Gate 99ZZF - Engine Boundary Refactor

Date: 2026-07-07

Status: PASS - repo compile/static proof

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

## Purpose

Gate 99ZZF is a behavior-preserving architecture repair before broker-visible
Revma grid TP work.

The prior Gate 99ZZE checkpoint proved that managed close-grid execution can
close a single-pair Revma basket, but it did not satisfy Freedom's intended
visible TP contract because MT5 tickets still showed `T/P=0.00000`.

This gate does not add broker-visible ticket TP modification. It reduces Engine
ownership so the next gate can add that behavior in the right module boundary.

## Boundary

Allowed in this gate:

- Move Revma lifecycle/reentry state out of `Engine.mqh`.
- Move Revma visual dashboard rendering out of `Engine.mqh`.
- Move account-level multi-currency stop/take-profit guard logic out of
  `Engine.mqh`.
- Preserve existing receipt strings, intent payloads, and routing behavior.
- Compile the repo EA.

Not allowed in this gate:

- No broker-visible grid TP sync.
- No `PositionModify` or `TRADE_ACTION_SLTP` route.
- No new MT5 tester run.
- No all-28 run.
- No optimization or parameter sweep.
- No Katarakti changes.
- No Q-state/future-system resurrection.

## Implementation Summary

New modules:

- `automation/mt5/Experts/Include/Strategies/Revma/RevmaLifecycleGate.mqh`
  owns Revma observed-state/reentry gate arrays and writes
  `revma_reentry_gate` receipts.
- `automation/mt5/Experts/Include/Strategies/Revma/RevmaVisualReporter.mqh`
  owns the Revma dashboard labels and one-shot screenshot/snapshot receipt path.
- `automation/mt5/Experts/Include/Strategies/Revma/RevmaReceipts.mqh`
  owns the Revma signal receipt helper.
- `automation/mt5/Experts/Include/Portfolio/PortfolioStopTakeProfitGuard.mqh`
  owns the multi-currency percent-after-fees stop/take-profit guard and its
  close-all intent construction.

Updated modules:

- `automation/mt5/Experts/Include/Core/Engine.mqh` now coordinates those
  modules instead of carrying their implementation state directly.
- `automation/mt5/Experts/Include/Strategies/RevmaTypes.mqh` now exposes
  `LP_RevmaSymbolActive(...)`, preserving the existing one-pair-vs-FX28 symbol
  activation rule outside Engine.
- `automation/mt5/README.md` records the MT5 architecture boundary and drift
  traps for future MT5 EA work.

## Behavior Preservation Notes

- Revma reentry gate statuses and detail payloads were moved intact:
  `startup_state_observed`, `birth_blocked_waiting_for_fresh_state`,
  `post_harvest_reentry_blocked`, and `fresh_state_change_detected`.
- Revma dashboard refresh keeps the old semantics: screenshot requests are
  consumed only when a dashboard update actually proceeds.
- Account stop/take-profit guard reason strings, receipt payload fields, and
  `LP_INTENT_CLOSE_ALL_EA` payload fields were moved intact.
- `Engine.mqh` still owns top-level sequencing: portfolio refresh, harvest
  guard, stop/take-profit guard, Revma grid exits, new-bar evaluation, risk,
  and execution.

## Evidence

Artifacts:

`docs/research/gates/gate99/artifacts/gate99zzf-engine-boundary-refactor-2026-07-07/`

Static checks:

- `git diff --check`
  - Result: no whitespace errors.
  - Local line-ending warnings were reported for existing Git normalization.
- Old Engine helper names are absent from `Engine.mqh` after extraction.

Compile proof:

- Source:
  `automation/mt5/Experts/Limni/LimniPortfolioEA.mq5`
- Log:
  `docs/research/gates/gate99/artifacts/gate99zzf-engine-boundary-refactor-2026-07-07/repo-compile.log`
- Result:
  `Result: 0 errors, 0 warnings, 17713 msec elapsed, cpu='X64 Regular'`

MetaEditor returned local exit code `1` on a clean result line, matching the
known local clean-log pattern from earlier gates. The compile verdict is based
on the result line.

## Next Gate

Gate 99ZZG should be the broker-visible Revma grid TP sync manager:

- Add a proper trade-modify route in execution, likely via `PositionModify` or
  `TRADE_ACTION_SLTP`.
- Compute and synchronize grid-level TP for active Revma grids.
- With one trade, the ticket TP is the grid TP.
- As more trades are added, update the grid's ticket TP level so the basket
  closes at the configured q target.
- Prove with one-pair forced tiny TP visual evidence that MT5 tickets show a
  non-zero `T/P` and that the grid TP moves after adds.


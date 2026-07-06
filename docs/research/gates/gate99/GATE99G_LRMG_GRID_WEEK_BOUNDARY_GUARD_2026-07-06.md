# Gate 99G - LRMG Grid Week Boundary Guard

Date: 2026-07-06

## Scope

This is a small follow-up to the new `LimniLRMGGridScaffoldEA`.

Purpose: block trading during the spread-danger weekly boundary without adding
full session/news architecture yet.

No old EA was changed.

## Changed File

`automation/mt5/Experts/LimniLRMGGridScaffoldEA.mq5`

## Inputs Added

```text
UseWeekBoundaryGuard = true
BrokerToEstOffsetHours = 0.0
```

The guard is enabled by default.

`BrokerToEstOffsetHours` maps broker/server bar time into the intended EST
boundary clock:

```text
boundary_est_time = broker_server_bar_time + BrokerToEstOffsetHours
```

Keep it at `0.0` if the tester/chart time is already aligned to EST. Adjust it
if the broker server clock differs.

## Blocked Windows

Hard-coded scaffold windows:

```text
Sunday 17:00-17:59 EST
Friday 16:00-16:59 EST
```

These represent the first trading hour after weekly open and the last trading
hour before weekly close.

## Behavior

During the blocked boundary:

- no new grid entries
- no grid adds
- no opposite-signal closes/reversals
- no trade-action calls at all

The EA still updates open-grid excursion and logs boundary receipt rows so risk
diagnostics do not go blind.

Receipt fields added:

- `week_boundary_blocked` in events
- `week_boundary_guard_enabled` in summary
- `broker_to_est_offset_hours` in summary
- `week_boundary_description` in summary
- `week_boundary_blocked_bars` in summary
- `week_boundary_blocked_actions` in summary

## Future Expansion

This is intentionally local and simple. Later it can be moved into a shared
session/news guard `.mqh` that also blocks high-impact news, holidays, custom
close windows, and broker maintenance windows.

## Compile Proof

Artifact folder:

`docs/research/gates/gate99/artifacts/gate99g-lrmg-grid-week-boundary-guard-2026-07-06/`

Compile logs:

- `LimniLRMGGridScaffoldEA-repo-compile-log.txt`
- `LimniLRMGGridScaffoldEA-active-terminal-compile-log.txt`

Both logs report:

`Result: 0 errors, 0 warnings`

MetaEditor returned process exit code `1` while writing clean compile logs,
matching the known MT5 behavior in this lane.

## Source Hash Parity

Repo and active-terminal source hash after install:

`31856A4C6545FA5AC6C1962DEAA9DFBE8AE45EEDC1E3C3C0C1A136748CF94554`

## Stop Lines

- Do not expand this into news filtering yet.
- Do not change `LimniKataraktiEA`, `LimniTrendFollow`, or `LimniHedge_V1`.
- Do not add SL/TP or account-harvest logic in this boundary gate.

# Gate 102 - Revma FX28 Tester Activation And Account TP Latch

Date: 2026-07-08

Status: PASS - compile, terminal sync, tester-profile cleanup, and FX28 runtime proof

Branch: `codex/gate88-mt5-lifecycle-protection-controls`

## Purpose

Gate 102 answers the immediate all-28 testing question after Gate 101:

```text
Can the current LimniPortfolioEA test Revma across all 28 FX pairs, and how do
we keep that test fast enough for iteration?
```

Freedom tried the initial Gate 102 preset and observed that the run only acted
on the chart symbol. That showed the all-28 path was not fully activated in MT5
tester runtime. Freedom then authorized Codex to run the all-28 tester directly.

## Current Capability

The current EA has an all-28 Revma path.

Use:

```text
RevmaUniverseMode = UniverseFx28
```

Source proof:

- `automation/mt5/Experts/Include/Core/Types.mqh` defines
  `LP_SYMBOL_COUNT = 28` and `LP_UNIVERSE_FX28 = 1`.
- `automation/mt5/Experts/Include/Core/SymbolUniverse.mqh` defines the fixed
  28-pair FX universe and broker-symbol suffix resolution.
- `automation/mt5/Experts/Include/Strategies/RevmaTypes.mqh` returns every
  configured symbol as active when `revma_universe_mode == LP_UNIVERSE_FX28`.
- `automation/mt5/Experts/Include/Core/Engine.mqh` loops the configured symbol
  cache, checks each symbol's closed-M1 clock, and evaluates Revma for active
  symbols.
- `automation/mt5/Experts/Include/Portfolio/PortfolioStopTakeProfitGuard.mqh`
  enables the multi-currency account-percent guard only when
  `StopTakeProfitMode=MultiCurrencyPercentAfterFees` and
  `RevmaUniverseMode=FX28`.

## Defect Found

The first implementation made all 28 symbols eligible, but not reliably active
in Strategy Tester:

- `M1Clock.mqh` checked `SERIES_SYNCHRONIZED` before `CopyTime`, so non-chart
  symbols could be rejected before MT5 had a chance to load/prime tester
  history for them.
- `Engine.mqh` only evaluated symbols after a detected new closed-M1 bar. On
  the first tester step, the non-chart symbols could initialize their last bar
  time without being evaluated, leaving the run visually looking like chart
  symbol only.

Freedom then reported that the multi-currency TP did not appear to be working.
Code inspection found a second runtime-path defect in the account-percent exit
contract:

- `PortfolioStopTakeProfitGuard` emitted a close-all intent only while the live
  basket was still beyond the configured percent threshold.
- If `MaxClosePositionsPerStep` capped the first close scan, or if enough
  profitable tickets closed before losing tickets, the remaining basket could
  fall back below the threshold while managed positions were still open.
- That means the account TP could stop liquidating before the managed portfolio
  was flat. This is not an acceptable account-level TP contract.

The authorized Codex reproduction then found a third, operational defect:

- MT5 command-line tester launches can silently fall back to the saved
  `MQL5\Profiles\Tester\LimniPortfolioEA.set` profile.
- That saved primary terminal profile still had
  `RevmaUniverseMode=CURRENT_CHART`, `RequireAllSymbols=false`, and
  `EnableAccountCloseExecution=false`.
- The receipt symptom matched Freedom's report: the run wrote to the old
  `LimniPortfolioEA_Gate101_Smoke` folder, evaluated one chart symbol, and
  could not execute account-level TP.
- Five old saved tester `.ini` profiles also contained stale
  `RevmaSleeveMode` inputs. Those are now archived out of the active MT5 tester
  profile root during the Gate 102 clean sync proof.

## Patch

Changed:

- `automation/mt5/Experts/Include/Market/M1Clock.mqh`
- `automation/mt5/Experts/Include/Core/Engine.mqh`
- `automation/mt5/Experts/Include/Core/BuildInfo.mqh`
- `automation/mt5/Experts/Include/Portfolio/PortfolioStopTakeProfitGuard.mqh`
- `automation/mt5/Experts/Include/Execution/TradeRouter.mqh`
- `automation/mt5/tools/Sync-LimniPortfolioEA-Terminals.ps1`
- `automation/mt5/tools/Run-LimniPortfolioEA-FX28Smoke.ps1`
- `automation/mt5/tester-presets/limni-portfolio-revma-fx28-fast-smoke-20260101-20260108.ini`
- `automation/mt5/README.md`

Behavior after patch:

- `M1Clock` now calls `CopyTime()` first. A successful closed-M1 read is enough
  to make the symbol clock usable; `SERIES_SYNCHRONIZED` remains diagnostic.
- On the first engine step in `FX28` mode, every active clock-ready symbol is
  forced through one Revma evaluation even if it has only just initialized its
  last closed-M1 timestamp.
- Multi-currency TP/SL is now a latched liquidation state. Once
  `MultiCurrencyPercentAfterFees` crosses TP or SL, the guard keeps emitting
  EA-only close-all intents and blocks new entries until
  `managed_position_count=0`.
- Account liquidation now takes precedence over Revma grid exits and broker TP
  sync. Strategy-level grid close/modify intents are skipped while account
  liquidation is active.
- `TradeRouter` account-close receipts now show `close_scope=account_all_ea`,
  `matched`, `attempted`, `closed`, `skipped_due_to_close_limit`,
  `close_limit`, and `close_all_pending`.
- `engine_step` receipts now include:
  - `active_symbols_scanned`
  - `clock_ready_symbols`
  - `evaluated_symbols`
  - `forced_initial_fx28_symbols`
- The terminal sync gate can now install and hash-check the canonical
  `LimniPortfolioEA.set` tester profile with `-SyncTesterProfile` and
  `-FailOnTesterProfileDrift`.
- The terminal sync gate can archive stale saved tester profiles with
  `-ArchiveStaleTesterProfiles`, then enforce zero stale tester-profile
  matches with `-FailOnStaleTesterProfiles`.
- `Run-LimniPortfolioEA-FX28Smoke.ps1` installs a run-specific FX28 profile,
  launches the tester, parses receipts, fails unless 28-symbol evaluation and
  account-level closes are proven, and restores the canonical FX28 profile.
- The checked-in tester `.ini` now uses `ExpertParameters=LimniPortfolioEA.set`
  instead of implying that inline `[TesterInputs]` are sufficient.

Build metadata:

```text
LP_EA_VERSION=0.1.19-gate102
LP_BUILD_GATE=Gate102
LP_BUILD_SCOPE=revma-fx28-account-tp-latch
```

## Fast Smoke Preset

Reusable MT5 tester config:

`automation/mt5/tester-presets/limni-portfolio-revma-fx28-fast-smoke-20260101-20260108.ini`

Reusable Strategy Tester input set:

`automation/mt5/tester-presets/limni-portfolio-revma-fx28-fast-smoke.set`

Repeatable command-line smoke runner:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\mt5\tools\Run-LimniPortfolioEA-FX28Smoke.ps1
```

Tester-profile drift guard:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\mt5\tools\Sync-LimniPortfolioEA-Terminals.ps1 -SyncTesterProfile -FailOnTesterProfileDrift
```

Recommended first all-28 smoke settings:

```text
Expert=Limni\LimniPortfolioEA.ex5
Symbol=EURUSD.i
Period=M1
Model=Open prices only / fastest smoke
FromDate=2026.01.01
ToDate=2026.01.08
RevmaUniverseMode=1
RevmaQProfile=0
RevmaCustomMaxM1Bars=5000
RevmaShowVisualDashboard=false
StopTakeProfitMode=2
TakeProfit=0.1
StopLoss=0.1
EnableCloseExecution=true
EnableAccountCloseExecution=true
RequireAllSymbols=true
OutputFolder=LimniPortfolioEA_Gate102_FX28_FAST_20260101_20260108
```

`Symbol=EURUSD.i` only drives the tester clock. With `RevmaUniverseMode=FX28`,
Revma evaluates the full fixed FX28 universe.

## Speed Notes

The current Portfolio EA avoids the major old tester-speed failure mode because
Revma uses an internal signal path, not repeated `iCustom` indicator reads.

The main speed controls available now are:

- `RevmaQProfile=Fast`, which caps bootstrap history at `5,000` M1 bars per
  pair instead of `50,000` for Medium or `250,000` for Slow.
- Open-prices-only model for the first mechanics smoke.
- `RevmaShowVisualDashboard=false` for all-28 receipt-first runs.
- One-week first window before longer spans.
- Common-file receipts with a unique `OutputFolder`.

The old working Alpha V3 EA used explicit tester cadence inputs
(`TesterCadence`, `TesterMinSecondsBetweenManage`). The current Portfolio EA is
already closed-M1 gated at the symbol clock and has no `iCustom` hot path, so
do not add cadence inputs until the first all-28 smoke shows a real runtime
blocker.

## Compile And Terminal Sync Proof

Latest artifact folder:

`docs/research/gates/gate102/artifacts/gate102-fx28-smoke-runner-2026-07-08/terminal-sync-clean/`

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\mt5\tools\Sync-LimniPortfolioEA-Terminals.ps1 -SyncTesterProfile -FailOnTesterProfileDrift -ArchiveStaleTesterProfiles -FailOnStaleTesterProfiles -FailOnUnknownRunningTerminal -ArtifactDir docs\research\gates\gate102\artifacts\gate102-fx28-smoke-runner-2026-07-08\terminal-sync-clean
```

Result:

```text
Source hash mismatches: 0
Tester profile hash mismatches: 0
Compile failures: 0
Active Experts stale-input matches: 0
Tester profile stale-input matches: 0
Unknown running terminal64.exe count: 0
MT5 terminal sync gate PASS
```

Compile summary:

```text
repo|Result: 0 errors, 0 warnings, 23188 ms elapsed, cpu='X64 Regular'
terminal-14275|Result: 0 errors, 0 warnings, 23414 ms elapsed, cpu='X64 Regular'
terminal-94497|Result: 0 errors, 0 warnings, 22962 ms elapsed, cpu='X64 Regular'
```

Source hash parity:

```text
MATCH, 14275    48
MATCH, 94497    48
```

Tester profile hash parity:

```text
14275 LimniPortfolioEA.set MATCH E93B3175585E1235DD14E64FEDA154F70D3FB9454C0418DBC821335AD6A1EB93
94497 LimniPortfolioEA.set MATCH E93B3175585E1235DD14E64FEDA154F70D3FB9454C0418DBC821335AD6A1EB93
```

Active terminal `MQL5\Experts` stale-input search:

```text
NO MATCHES
```

Tester profile stale-input search:

```text
NO MATCHES
```

Archived stale saved tester profiles:

```text
LimniPortfolioEA.AUDCHF.i.M1.20250301_20250304.200.ini
LimniPortfolioEA.AUDCHF.i.M1.20260101_20260104.200.ini
LimniPortfolioEA.AUDCHF.i.M1.last_year.200.ini
LimniPortfolioEA.AUDUSD.i.M1.20260101_20260104.200.ini
LimniPortfolioEA.M1.20260101_20260104.230.ini
```

## Runtime Proof

Runner artifact folder:

`docs/research/gates/gate102/artifacts/gate102-fx28-smoke-runner-2026-07-08/`

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File automation\mt5\tools\Run-LimniPortfolioEA-FX28Smoke.ps1 -ArtifactDir docs\research\gates\gate102\artifacts\gate102-fx28-smoke-runner-2026-07-08
```

Result:

```text
status=PASS
process_exit_code=0
revma_universe_mode=FX28
account_close_execution=true
sltp_mode=MULTI_CURRENCY_PERCENT_AFTER_FEES
first_engine active_symbols_scanned=28
first_engine clock_ready_symbols=28
first_engine evaluated_symbols=28
first_engine forced_initial_fx28_symbols=28
last_engine active_symbols_scanned=28
last_engine evaluated_symbols=28
intent_symbol_count=16
account_exit_intents=20
account_close_scans=20
account_close_total_closed=120
max_matched_in_close_scan=70
close_limit_split_scans=1
final_balance=10006.63
final_open_position_count=0
final_managed_position_count=0
```

Receipt folder:

`C:\Users\User\AppData\Roaming\MetaQuotes\Terminal\Common\Files\LimniPortfolioEA_Gate102_FX28_SMOKE_20260708-131313\`

The close-limit split proves the account TP latch path specifically: one
account close scan matched `70` managed positions, closed `50`, left
`close_all_pending=true`, and a later scan closed the remaining positions.

Not claimed:

- edge;
- profitability;
- all-window survival;
- optimization;
- live readiness.

## Verdict

The all-28 tester activation defect and account-percent TP latch defect are
patched and compiled into both configured terminal copies. The authorized
all-28 smoke run passed with receipt proof for 28-symbol evaluation,
multi-currency account-percent TP liquidation, close-limit continuation, and
final flat managed/open position state.

The MT5 tester-profile drift path is also closed for this gate: both configured
terminal data roots now have `MQL5\Profiles\Tester\LimniPortfolioEA.set`
hash-matched to the repo canonical FX28 smoke profile, and old saved tester
profiles with stale Revma sleeve inputs were archived out of the active tester
profile root.

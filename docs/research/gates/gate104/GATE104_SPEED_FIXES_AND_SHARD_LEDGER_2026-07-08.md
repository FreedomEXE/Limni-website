# Gate 104 - Speed Fixes and Shard Ledger

Date: 2026-07-08

Status: PASS for non-destructive harness fixes, exact compact summary metrics,
serial shard runner, and benchmark classification. BLOCKED for true parallel
terminal workers until MT5 launcher/data-root mapping is corrected.

Scope:
- Revma mean-reversion only.
- No strategy formula change.
- No TP optimization.
- No risk-guard design.
- No promotion or live-readiness claim.

## Review Advice Applied

The outside review classified Gate 104 as acceptable tester-output hygiene, but
not a solved long-run speed gate. The applied fixes stayed in the harness and
summary-evidence layer:

1. Fixed benchmark timeout classification so timed-out benchmark runs still
   write a benchmark status file and cannot report PASS.
2. Added generated run manifests with generated profile/config hashes.
3. Added exact run-level observed metrics:
   - `max_open_position_count_observed`
   - `max_managed_position_count_observed`
   - `max_open_grid_count_observed`
   - `worst_stop_take_profit_net_open_pct_after_fees_observed`
   - `best_stop_take_profit_net_open_pct_after_fees_observed`
   - matching net-open-money observed extremes
4. Added receipt histogram output for benchmark runs and a standalone receipt
   histogram tool.
5. Added deterministic shard runner and aggregate shard ledger.
6. Added a post-exit receipt wait to handle MT5 launcher/live-update handoffs.
7. Added a safety guard that refuses unverified parallel workers by default.

## Files Changed

```text
automation/mt5/Experts/Include/Core/Engine.mqh
automation/mt5/Experts/Include/Receipts/ReceiptWriter.mqh
automation/mt5/tools/Run-LimniPortfolioEA-FX28Smoke.ps1
automation/mt5/tools/Run-LimniPortfolioEA-Gate104Shards.ps1
automation/mt5/tools/Measure-LimniPortfolioEA-Receipts.ps1
automation/mt5/tools/Sync-LimniPortfolioEA-Terminals.ps1
automation/mt5/README.md
```

## Compile / Sync Proof

Artifact:

```text
docs/research/gates/gate104/artifacts/gate104-speed-fixes-sync-20260708/
```

Result:

```text
MT5 terminal sync gate PASS
Source hash mismatches: 0
Tester profile hash mismatches: 0
Compile failures: 0
Active Experts stale-input matches: 0
Tester profile stale-input matches: 0
Unknown running terminal64.exe count: 0
```

The sync summary now records the local MetaEditor convention: `exit_code=1`
can still be clean when the compile result line reports `0 errors, 0 warnings`.

## Targeted Test Results

### Timeout Classification

Artifact:

```text
docs/research/gates/gate104/artifacts/gate104-speed-fixes-timeout-classification-20260708/
```

Result:

```text
status=TIMED_OUT_BENCHMARK_NO_RECEIPTS
strategy_evidence=false
```

This is the expected nonzero failure path. It proves timeout handling no longer
exits before writing benchmark classification.

### Explicit Short Compact Benchmark

Artifact:

```text
docs/research/gates/gate104/artifacts/gate104-speed-fixes-short-compact-benchmark-r3-20260708/
```

Result:

```text
status=PASS_BENCHMARK_RECEIPTS_PRESENT
wall_seconds=16.279
receipt_rows=36
receipt_mode=COMPACT_LONG_RUN
revma_q_profile_id=FAST_5000
take_profit_value=0.7500
```

This run used an explicit short output folder and generated profile/config
hashes. The `run_start` receipt proves the intended profile loaded.

### Receipt Histogram Tool

Artifact:

```text
docs/research/gates/gate104/artifacts/gate104-speed-fixes-histogram-tool-20260708/
```

Input was the completed short Full run produced while diagnosing the profile
mapping issue. Use it as receipt-tool proof only, not strategy evidence.

Result:

```text
receipt_rows=125242
top receipt type=revma_reentry_gate count=109302
```

The same completed run verified the new exact summary metrics were written:

```text
max_managed_position_count_observed=20
worst_stop_take_profit_net_open_pct_after_fees_observed=-0.146460
best_stop_take_profit_net_open_pct_after_fees_observed=0.119597
```

### Serial Shard Smoke

Artifact:

```text
docs/research/gates/gate104/artifacts/gate104-speed-fixes-shard-smoke-20260708/
```

Command shape:

```text
2026.01.01..2026.01.08
ShardDays=4
MEDIUM_50000
OpenPrices
CompactLongRun
MaxParallel=1
```

Result:

```text
status=PASS_SHARD_LEDGER
shards=2
failed_shards=0
wall_seconds=89.122
```

### One-Month Serial Shard Ledger

Artifact:

```text
docs/research/gates/gate104/artifacts/gate104-speed-fixes-one-month-shards-20260708/
```

Command shape:

```text
2026.01.01..2026.02.01
ShardDays=16
MEDIUM_50000
OpenPrices
CompactLongRun
MaxParallel=1
```

Result:

```text
status=PASS_SHARD_LEDGER
shards=2
failed_shards=0
wall_seconds=133.235
```

Shard details:

```text
S001 2026.01.01..2026.01.17 wall_seconds=58.505 receipt_rows=3500 skipped=331274 final_managed=0 max_managed=119 worst_net_open_pct=-2.307053
S002 2026.01.17..2026.02.01 wall_seconds=66.474 receipt_rows=6889 skipped=316420 final_managed=0 max_managed=392 worst_net_open_pct=-19.108974
```

These are benchmark/harness receipts only. The one-month window is not a
profitability or promotion result.

## Parallel Worker Finding

True parallel terminal workers are not accepted yet.

Live logs showed the configured terminal compile roots and runtime launch roots
do not currently line up cleanly:

- one configured launcher opens the primary `94497...` live tester root while
  the manifest entry is named `14275`;
- the other configured launcher can route through `14275...`, which currently
  has an invalid tester account state.

Because of that, `Run-LimniPortfolioEA-Gate104Shards.ps1` now defaults to
`MaxParallel=1` and refuses `MaxParallel > 1` unless the caller passes
`-AllowUnverifiedParallel` for diagnostics. This prevents false parallel speed
evidence.

## Current Read

Gate 104 is ready for one normal MT5 GUI all-28 six-year run using the
recommended Open Prices / `MEDIUM_50000` / `CompactLongRun` settings.

It is still not ready to claim true parallel terminal speedup.

Next valid choices:

1. Run the controlled normal MT5 GUI six-year test and review it as research
   evidence only.
2. Fix MT5 terminal launcher/data-root mapping later if true parallel workers
   are still needed.
3. Use the serial shard runner only for diagnostics or bounded regime splits,
   not as Freedom's required manual workflow.

Do not make promotion/live-readiness claims from the six-year run by itself.

## EA-Internal Speed Follow-Up

Freedom rejected manual month-by-month operation as the solution. A follow-up
EA-internal tester-throughput pass was applied without changing Revma strategy
behavior.

Additional source files touched:

```text
automation/mt5/Experts/Include/Core/Types.mqh
automation/mt5/Experts/Include/Market/M1Clock.mqh
automation/mt5/Experts/Include/Signals/RevmaSignalState.mqh
automation/mt5/Experts/Include/Portfolio/PositionCommissionCache.mqh
automation/mt5/Experts/Include/Portfolio/PositionIndex.mqh
automation/mt5/Experts/Include/Portfolio/GridBook.mqh
automation/mt5/Experts/Include/Portfolio/PortfolioStopTakeProfitGuard.mqh
automation/mt5/Experts/Include/Strategies/RevmaTypes.mqh
automation/mt5/Experts/Include/Strategies/RevmaGridSleeve.mqh
automation/mt5/Experts/Include/Strategies/Revma/RevmaLifecycleGate.mqh
automation/mt5/Indicators/Include/LimniPairDirectionCore.mqh
```

Compile/sync proof:

```text
docs/research/gates/gate104/artifacts/gate104-ea-prebuild-skip-sync-20260708/
```

Result:

```text
MT5 terminal sync gate PASS
Source hash mismatches: 0
Tester profile hash mismatches: 0
Compile failures: 0
Active Experts stale-input matches: 0
Tester profile stale-input matches: 0
Unknown running terminal64.exe count: 0
```

Runtime proof:

```text
docs/research/gates/gate104/artifacts/gate104-ea-prebuild-skip-medium-openprices-1m-20260708/
docs/research/gates/gate104/artifacts/gate104-ea-prebuild-skip-medium-openprices-6m-20260708/
docs/research/gates/gate104/artifacts/gate104-ea-prebuild-skip-medium-openprices-1y-20260708/
```

Results:

```text
2026.01.01..2026.02.01 MEDIUM_50000 OpenPrices CompactLongRun wall_seconds=40.385 final_open=0 final_managed=0
2020.01.01..2020.07.01 MEDIUM_50000 OpenPrices CompactLongRun wall_seconds=166.941 final_open=0 final_managed=0
2020.01.01..2021.01.01 MEDIUM_50000 OpenPrices CompactLongRun wall_seconds=277.295 final_open=0 final_managed=0
```

Read:

- The normal MT5 GUI all-28 six-year run is now reasonable as a controlled
  single run using Open Prices, M1, `MEDIUM_50000`, `CompactLongRun`, and
  dashboard disabled.
- Expected wall-clock is around the low-30-minute range on this machine, based
  on the continuous one-year run.
- This remains speed/readiness evidence only, not profitability, promotion, or
  live-readiness evidence.

# Gate 104 - Revma Speed Code Review Packet

Date: 2026-07-08

Mode: OUTSIDER CODE REVIEW

## Context

Revma remains mean-reversion only. This packet is not asking for strategy or
formula review. It is asking whether the MT5 tester-output and benchmark
harness changes are safe, non-destructive, and sufficient before the next chat
tries to improve long-run speed.

The immediate problem: a six-year FX28 `MEDIUM_50000 / TP 0.75%` open-prices
run projected roughly two hours, which is too slow for the intended research
loop. Before that, full receipts produced multi-gigabyte output and some Medium
AUTO folder names could create a folder but fail to open CSVs near the MT5/path
length limit.

## Files To Review

Primary code:

```text
automation/mt5/Experts/Include/Core/Types.mqh
automation/mt5/Experts/Include/Core/Config.mqh
automation/mt5/Experts/Include/Receipts/ReceiptWriter.mqh
automation/mt5/Experts/Include/Receipts/RunManifest.mqh
automation/mt5/tools/Run-LimniPortfolioEA-FX28Smoke.ps1
automation/mt5/tester-presets/limni-portfolio-revma-fx28-fast-smoke.set
automation/mt5/README.md
```

Evidence:

```text
docs/research/gates/gate104/GATE104_REVMA_TESTER_SPEED_BENCHMARK_2026-07-08.md
docs/research/gates/gate104/artifacts/speed-benchmark-20260708/
```

Compile/sync proof:

```text
docs/research/gates/gate104/artifacts/speed-benchmark-20260708/terminal-sync-short-run-id/terminal-compile-summary.txt
```

All MQL compiles in that artifact report `Result: 0 errors, 0 warnings` for
repo, terminal `14275`, and terminal `94497`.

## What Changed

1. Added `ReceiptMode`:
   - `Full`
   - `CompactLongRun`

2. `OutputFolder=AUTO` now names folders with useful run settings:
   - universe
   - q profile
   - account TP/SL
   - lot size
   - grid spacing
   - receipt mode (`RF` or `RC`)
   - guard/account-close states
   - run stamp

3. `CompactLongRun` suppresses repeated no-change/noise receipt rows and keeps:
   - run start/end
   - manifest/summary
   - failures and rejected/invalid/no-money/market-closed evidence
   - order results
   - intent evidence
   - grid birth/add/exit
   - changed inventory/position/currency snapshots
   - sampled engine-step rows
   - sampled/extreme stop-take-profit monitor rows

4. Receipt file run IDs were shortened to `LPEA_<stamp>` to avoid folder +
   filename path-length failures.

5. The smoke runner became a benchmark harness:
   - selectable q profile
   - selectable tester model: open prices, 1-minute OHLC, every tick
   - compact/full receipt mode
   - benchmark summary output without importing giant CSVs
   - killed/failed benchmark runs no longer report PASS just because CSVs exist

## Known Speed Results

See the benchmark report for full table. Key read:

```text
2020-01-01..2020-07-01 open prices: 514.00s, 152.85 MB
2020-01-01..2020-07-01 1-minute OHLC: 809.30s, 154.49 MB
2020-01-01..2026-07-01 open prices: stopped at 482.36s, MT5 projected about 2 hours
```

The output-size problem is mostly solved. The long-window runtime problem is
not solved.

## Review Questions

1. Is `CompactLongRun` filtering safe enough for research review, given that it
   is not meant to be a full schema/forensic proof?
2. Are any suppressed receipt classes required to reconstruct:
   - final inventory,
   - max positions,
   - grid birth/add/close counts,
   - account TP hits,
   - no-money / market-closed failures,
   - worst net open percent?
3. Is the `LPEA_*` short run ID a good enough path-length fix, or should the
   folder naming also be shortened while preserving settings?
4. Did the harness correctly separate:
   - completed benchmark evidence,
   - stopped/partial speed evidence,
   - strategy evidence?
5. What is the safest next speed step that does not alter strategy logic?

## Preferred Next Direction

Do not tune Revma formula or TP settings in the speed chat.

Recommended non-destructive speed work:

```text
1. Add a shard runner for fixed date windows.
2. Support multiple configured MT5 terminals as parallel workers.
3. Aggregate shard benchmark/proof summaries into one ledger.
4. Keep per-shard output folders archived after capture.
5. Only after sharding/parallelism, retry six-year coverage.
```

Secondary ideas to review:

```text
- Add a shorter AUTO folder convention if path length remains fragile.
- Add a receipt-class histogram tool to identify remaining output noise.
- Add a benchmark-only timeout classification that always marks partial runs.
- Add per-run generated config/profile manifest to avoid relying on MT5 UI memory.
```

Hard boundary: no strategy behavior change, no formula optimization, no Kyma,
no risk-guard design, and no promotion evidence from speed runs.

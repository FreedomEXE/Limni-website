# Gate 105 - Revma Account HWM Trail Implementation

Date: 2026-07-08

Status: PATCHED, COMPILE/SYNC PASS, and PUSH-READY for code review. Runtime HWM
mechanics are intentionally not accepted yet; Freedom owns MT5 test execution.

Scope:
- Revma only.
- No Revma q/state/signal formula change.
- No grid birth/add direction change.
- No Kyma or Katarakti.
- No parameter optimization.
- Existing fixed TP/SL modes preserved.

## Implemented

- Added `LP_SLTP_MULTI_CURRENCY_HWM_TRAIL_AFTER_FEES`.
- Added operator inputs:
  - `HwmTrailArmPct`
  - `HwmTrailMinLockPct`
  - `HwmTrailGivebackPct`
  - `HwmTrailBlockNewEntriesWhenArmed`
  - `HwmTrailHardStopLossPct`
- Split account stop/take-profit decisions into:
  - `block_new_entries`
  - `close_required`
- Added HWM cycle state, armed state, high-watermark percent, trailing floor,
  hard-stop breach, floor-breach liquidation, and flat-cycle reset receipts.
- Added HWM fields to run manifest, config hash, summaries, and close-all
  intent reasons.
- Updated compact receipt handling so HWM event receipts are retained while
  routine HWM monitoring is sampled like existing monitoring.
- Added runner controls for HWM mode and raw receipt retention.
- Updated MT5 README with HWM contract and raw receipt retention policy.
- Added MT5 execution boundary: Codex may compile/sync MT5 code, but must not
  run Strategy Tester, shard runners, FX28 smoke runners, benchmarks,
  optimization, or any backtest/test execution.
- Added disk-safe defaults:
  - `ReceiptMode=Off`
  - `OutputFolder=OFF`
  - `OutputFolder=AUTO` intentionally saves review evidence and forces
    `ReceiptMode=CompactLongRun`
- Made receipt-file open failure non-fatal. If receipts cannot be opened, the
  EA prints a warning and continues with receipt output disabled instead of
  returning `INIT_FAILED`.

## Raw Receipt Cleanup

Disk was full before implementation could continue. Following explicit operator
approval, giant generated `*_receipts.csv` files were deleted while leaving
summary/proof/manifest-style artifacts intact.

Cleanup ledger:

```text
docs/research/gates/gate105/artifacts/receipt-cleanup-20260708/deleted-raw-receipts.csv
```

Result:

```text
deleted_raw_receipt_files=15
deleted_raw_receipt_gb=64.40
```

## Compile / Sync Proof

Artifact:

```text
docs/research/gates/gate101/artifacts/mt5-terminal-sync-20260708-221936/
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
repo Result: 0 errors, 0 warnings
terminal-14275 Result: 0 errors, 0 warnings
terminal-94497 Result: 0 errors, 0 warnings
```

Latest compile/sync after the receipt-off and non-fatal receipt-open patch:

```text
docs/research/gates/gate101/artifacts/mt5-terminal-sync-20260708-224524/
repo Result: 0 errors, 0 warnings
terminal-14275 Result: 0 errors, 0 warnings
terminal-94497 Result: 0 errors, 0 warnings
Source hash mismatches: 0
Tester profile hash mismatches: 0
Compile failures: 0
```

## Runtime Smoke Attempts

Attempt 1:

```text
docs/research/gates/gate105/artifacts/hwm-mechanics-smoke-20260708/
```

Result:

```text
status=MISSING_RECEIPTS_BENCHMARK
strategy_evidence=false
```

Attempt 2:

```text
docs/research/gates/gate105/artifacts/hwm-mechanics-smoke-94497-20260708/
```

Result:

```text
status=TIMED_OUT_BENCHMARK_NO_RECEIPTS
strategy_evidence=false
```

Read: runtime mechanics are not accepted yet. The smoke attempts were generated
before the final receipt-open fix and are non-evidence. Do not treat HWM mode as
mechanics-proven until Freedom chooses to run a normal MT5 GUI test and asks
Codex to review the resulting outputs.

## Next Review Questions

1. Confirm the lifecycle separation is correct: armed HWM blocks new risk but
   does not close until floor breach.
2. Confirm `PortfolioStopTakeProfitGuard` remains the right ownership boundary.
3. Confirm compact retention keeps all required HWM event receipts.
4. After code review and high-level strategy discussion, Freedom may run one
   short normal MT5 GUI HWM mechanics smoke. Codex should only review outputs
   Freedom produced.

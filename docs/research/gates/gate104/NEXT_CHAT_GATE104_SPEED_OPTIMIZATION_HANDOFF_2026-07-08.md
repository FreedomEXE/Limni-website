# Next Chat Handoff - Gate 104 Speed Optimization

Copy/paste prompt for the next Codex chat:

```text
You are Codex working inside the Limni/Poseidon repo.

Repo:
C:/Users/User/Documents/GitHub/limni-website

Branch:
codex/gate88-mt5-lifecycle-protection-controls

Current gate:
Gate 104 - Revma MT5 Tester Speed Optimization - SIX-YEAR GUI RUN READY FOR OPERATOR

Recovery order:
1. Read C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_SESSION.md
2. Read C:/Users/User/Documents/GitHub/freedom-ops/.codex/CODEX_CKB.md
3. Read AGENTS.md
4. Read automation/mt5/README.md
5. Read docs/research/gates/gate104/GATE104_REVMA_TESTER_SPEED_BENCHMARK_2026-07-08.md
6. Read docs/research/gates/gate104/GATE104_SPEED_FIXES_AND_SHARD_LEDGER_2026-07-08.md
7. Read docs/research/gates/gate104/GATE104_REVMA_SPEED_CODE_REVIEW_PACKET_2026-07-08.md
8. Run git status --branch --short and verify live repo truth.

Current state:
- Revma remains mean-reversion only.
- No strategy formula or risk-control work is open.
- CompactLongRun receipts exist and compile cleanly.
- AUTO output naming exists.
- Receipt file run IDs were shortened to LPEA_* to avoid MT5/path length CSV-open failures.
- The benchmark harness can run q profiles and tester models.
- Initial speed benchmarks showed compact output was manageable, but the first six-year open-prices run still projected about 2 hours and was stopped.
- The stopped six-year run is partial speed evidence only, not strategy evidence.
- Completed benchmark output folders were archived under Common Files/LimniPortfolioEA_Archive.
- Follow-up speed fixes were implemented after review in docs/research/gates/gate104/GATE104_SPEED_FIXES_AND_SHARD_LEDGER_2026-07-08.md.
- Serial shard runner exists and passed a one-month MEDIUM/OpenPrices/CompactLongRun ledger: 2 shards, 0 failures, 133.235s wall-clock.
- True parallel terminal workers are not accepted yet; live logs showed configured compile roots and runtime launch roots are crossed/unclean, so MaxParallel > 1 is guarded unless explicitly allowed for diagnostics.
- EA-internal speed pass now supports a normal MT5 GUI all-28 six-year run without manual sharding.
- Latest compile/sync proof: docs/research/gates/gate104/artifacts/gate104-ea-prebuild-skip-sync-20260708/ PASS, source mismatches 0, tester profile mismatches 0, compile failures 0.
- Latest continuous benchmarks:
  - 2026.01.01..2026.02.01 MEDIUM_50000 OpenPrices CompactLongRun: 40.385s, final open/managed 0/0.
  - 2020.01.01..2020.07.01 MEDIUM_50000 OpenPrices CompactLongRun: 166.941s, final open/managed 0/0.
  - 2020.01.01..2021.01.01 MEDIUM_50000 OpenPrices CompactLongRun: 277.295s, final open/managed 0/0.
- Six-year projection is now around the low-30-minute range on this machine.

Primary objective:
Run the next normal MT5 GUI six-year all-28 Revma test as a controlled speed/strategy evidence collection, not as a promotion claim.

Expected approach:
- Review the speed-fixes report first, then verify live repo truth.
- Do not change Revma strategy behavior.
- Do not ask Freedom to manually shard month by month.
- Use normal MT5 Strategy Tester GUI settings:
  - Model: Open prices only
  - Period: M1
  - From: 2020.01.01
  - To: 2026.07.01
  - RevmaUniverseMode: FX28
  - RevmaQProfile: Medium
  - RevmaCustomMaxM1Bars: 50000
  - ReceiptMode: CompactLongRun
  - RevmaShowVisualDashboard: false
  - TakeProfit: 0.750
  - StopLoss: 0.0
  - EnableCloseExecution: true
  - EnableAccountCloseExecution: true
  - NewsGuardMode: Disabled
  - EnableCurrencyExposureGuard: false
  - OutputFolder: AUTO
- Keep output cleanup workflow: root has only Archive plus current/unreviewed runs.

Hard boundaries:
- No Revma formula changes.
- No TP/parameter optimization.
- No Kyma/trend-following.
- No risk-guard design.
- No promotion/live-readiness claims.
- No promotion/live-readiness claim from the six-year run by itself.
- Do not reopen TP, formula, risk guard, or parallel terminal work while the six-year run is being reviewed.

First response:
Identify Gate 104 speed optimization as active, verify git status, summarize that the EA-internal speed pass reduced one-month runtime from about 88.56s to 40.385s, six-month runtime from 514.00s to 166.941s, and one-year runtime to 277.295s. Tell Freedom he is good to run the normal MT5 GUI six-year all-28 test with the listed settings, while keeping the result as research evidence only.
```

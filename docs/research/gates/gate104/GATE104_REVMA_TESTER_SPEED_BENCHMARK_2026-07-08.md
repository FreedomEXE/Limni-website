# Gate 104 - Revma Tester Speed Benchmark

Date: 2026-07-08

Status: PASS for tester-output hygiene and speed benchmark evidence.

Scope:
- Revma mean-reversion only.
- FX28.
- `MEDIUM_50000`.
- Fixed `0.01` lots.
- Account TP `0.75%`.
- SL disabled.
- Equity/currency/news guards disabled.
- `ReceiptMode=CompactLongRun`.
- Strategy logic unchanged.

## Finding

The stopped six-year run was being crushed by receipt output and path length,
not by strategy logic alone.

Two fixes were required:

1. `CompactLongRun` receipts suppressed repeated no-change rows.
2. Receipt file names were shortened from the full EA/server name to `LPEA_*`
   because Medium AUTO folder names could create a folder but fail to open CSVs
   near the Windows/MT5 path limit.

## Benchmark Matrix

| Window | Tester model | Runtime | Receipt size | Rows | Skipped rows | Final balance | Final inventory |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-01-01..2026-01-08 | Open prices | 44.41s | 0.91 MB | 903 | 120,829 | 10066.51 | flat |
| 2026-01-01..2026-01-08 | 1-minute OHLC | 46.43s | 0.96 MB | 947 | 134,478 | 10070.67 | flat |
| 2026-01-01..2026-01-08 | Every tick | 58.49s | 0.97 MB | 955 | 186,167 | 10069.81 | flat |
| 2026-01-01..2026-02-01 | Open prices | 88.56s | 12.62 MB | 11,392 | 655,190 | 11055.95 | flat |
| 2026-01-01..2026-02-01 | 1-minute OHLC | 98.55s | 13.13 MB | 12,141 | 743,227 | 11245.03 | flat |
| 2020-01-01..2020-07-01 | Open prices | 514.00s | 152.85 MB | 127,526 | 3,945,122 | 22699.62 | flat |
| 2020-01-01..2020-07-01 | 1-minute OHLC | 809.30s | 154.49 MB | 130,005 | 4,591,429 | 22681.10 | flat |

Aborted test:

| Window | Tester model | Runtime before stop | Receipt size | Rows | Status | Read |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2020-01-01..2026-07-01 | Open prices | 482.36s | 136.07 MB | 112,845 | stopped | MT5 projected about 2 hours; too slow for iterative research |

Artifacts:

```text
docs/research/gates/gate104/artifacts/speed-benchmark-20260708/
```

Compile/sync proof for the receipt-name fix:

```text
docs/research/gates/gate104/artifacts/speed-benchmark-20260708/terminal-sync-short-run-id/
```

## Read

Open prices remains the right broad scouting model.

1-minute OHLC is now practical as a validation layer. On the one-month 2026
window it was only about `1.11x` open-prices runtime. On the COVID six-month
window it was about `1.57x` open-prices runtime.

Every tick is not absurd on a one-week spot check, but it should stay a narrow
validation tool until a longer tick benchmark is justified.

Compact receipts are usable for review: run start, summary, order evidence,
grid lifecycle, account TP evidence, sampled engine/TP state, and skipped-row
counts remain available. Compact is not a full forensic schema proof.

## Working Protocol

Use this ladder for speed and evidence quality:

1. Broad scouting: `OpenPrices + CompactLongRun`.
2. Candidate validation: `1-minute OHLC + CompactLongRun`.
3. Spot realism check only: small `EveryTick + CompactLongRun` windows.
4. Full forensic debugging only: `Full` receipts on short windows.

Do not use full receipts for multi-month or multi-year tests unless debugging a
specific missing receipt or schema problem.

## Historical Stopped Six-Year Test

The attempted full six-year run was stopped after MT5 projected about two
hours. Do not use that partial folder as strategy evidence.

This warning is historical. The later EA-internal speed pass below supersedes
the old "do not start another full six-year run" boundary for one controlled
normal MT5 GUI six-year run using the recommended settings in this report.

## Follow-Up Harness Fixes

Follow-up report:

```text
docs/research/gates/gate104/GATE104_SPEED_FIXES_AND_SHARD_LEDGER_2026-07-08.md
```

Summary:
- benchmark timeout classification is fixed;
- benchmark runs now write generated profile/config hashes and receipt
  histograms;
- compact summaries now include exact observed max-position and worst/best
  account-TP net-open metrics;
- deterministic serial sharding is working and wrote a one-month two-shard
  ledger in `133.235s`;
- true parallel terminal workers are blocked because configured compile roots
  and runtime launch data roots do not currently map cleanly.

## EA-Internal Speed Pass

After Freedom rejected manual month-by-month operation, Gate 104 continued as an
EA-internal tester-throughput pass for the normal MT5 GUI workflow. Revma
strategy behavior stayed unchanged.

Applied speed fixes:

1. Cached per-symbol effective q median; q only changes when a completed day is
   appended.
2. Removed unused per-symbol tick refresh from the Revma hot loop.
3. Removed unused `SERIES_SYNCHRONIZED` query after closed-bar history already
   loads.
4. Reused the closed M1 bar fetched by the clock instead of asking MT5 for the
   same bar again in signal build.
5. Combined portfolio-state and grid-book position scans into one selected
   position pass.
6. Cached constant formula hashes and q-profile ids instead of rebuilding and
   hashing strings per bar.
7. Skipped routine compact add-skip/reentry receipt payload construction before
   metadata/dashboard strings are built.
8. Avoided dashboard string construction when `RevmaShowVisualDashboard=false`.

Post-fix benchmark matrix:

| Window | Tester model | Runtime | Rows | Skipped rows | Final balance | Final inventory | Artifact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 2026-01-01..2026-02-01 | Open prices | 40.385s | 10,216 | 655,185 | 11055.95 | flat | `gate104-ea-prebuild-skip-medium-openprices-1m-20260708` |
| 2020-01-01..2020-07-01 | Open prices | 166.941s | 115,322 | 3,945,120 | 22699.62 | flat | `gate104-ea-prebuild-skip-medium-openprices-6m-20260708` |
| 2020-01-01..2021-01-01 | Open prices | 277.295s | 169,619 | 7,755,544 | 30095.06 | flat in final summary | `gate104-ea-prebuild-skip-medium-openprices-1y-20260708` |

Read:

- The original one-month Open Prices benchmark was `88.56s`; the current
  one-month benchmark is `40.385s`.
- The original six-month Open Prices benchmark was `514.00s`; the current
  six-month benchmark is `166.941s`.
- The one-year continuous Open Prices run completed in `277.295s`.
- A normal MT5 GUI six-year run is now reasonable as a single controlled
  operator run, projected around the low-30-minute range on this machine.
- This is speed/readiness evidence only. It is not a promotion or
  live-readiness claim.

Recommended six-year MT5 GUI settings:

```text
Model: Open prices only
Period: M1
From: 2020.01.01
To: 2026.07.01
RevmaUniverseMode: FX28
RevmaQProfile: Medium
RevmaCustomMaxM1Bars: 50000
ReceiptMode: CompactLongRun
RevmaShowVisualDashboard: false
TakeProfit: 0.750
StopLoss: 0.0
EnableCloseExecution: true
EnableAccountCloseExecution: true
NewsGuardMode: Disabled
EnableCurrencyExposureGuard: false
OutputFolder: AUTO
```

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

## Next Speed Test

The attempted full six-year run was stopped after MT5 projected about two
hours. Do not use that partial folder as strategy evidence. The speed fix made
receipts manageable, but the tester runtime is still not fast enough for
hundreds of six-year full-universe passes.

Next work should improve runtime before reopening six-year survival:

```text
MEDIUM_50000
TP 0.75%
short/medium windows first
parallel terminal workers or smaller fixed regime shards
aggregate ledger after each shard
```

Do not start another full six-year run until the harness can split/parallelize
or otherwise reduce wall-clock time.
